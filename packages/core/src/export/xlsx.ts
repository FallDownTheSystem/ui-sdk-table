import {
	DEFAULT_LOCALE,
	formatValue,
	isNumericFormat,
	type DateFormatOptions,
	type FormatOptionsByName,
} from '../format'
import { dateFormats, toDate } from '../format/date'
import { PERIOD_FIELDS } from '../format/period'
import type { PeriodFormatOptions } from '../format/types'
import { isFormulaError } from '../formula/errors'
import { getDateTimeFormat } from '../format/intl'
import { numberPlan, readNumber, type NumericFormatName } from '../format/number'
import type { ColumnDef } from '../rows'
import { decidesText } from '../sheet/formats'
import type { ExportCell, ExportData } from './data'
import { zip } from './zip'

export type XlsxOptions = {
	/** The name of the sheet. Defaults to `Sheet1`. */
	sheetName?: string
	/** Whether the header row stays in view while the rows scroll. Defaults to true. */
	freezeHeader?: boolean
	/** Whether the file is compressed, where the environment can do that. Defaults to true. */
	compress?: boolean
	/**
	 * Writes the formulas of the cells as formulas of the file, with the
	 * result beside each: `excelFormulas()` of the entry
	 * `ui-sdk-table-core/formulas`. Without it, a cell holds its result.
	 */
	formula?: XlsxFormulas
}

/**
 * Gives the text of the formula of a cell of the file, without its `=`, or
 * `undefined` for a cell that holds its result. `row` and `column` count the
 * `rows` and `columns` of the data from 0, and so does `exact`: whether the
 * file holds in a cell the value that the table holds, so that a formula of
 * the file that reads it computes what the table computed.
 */
export type XlsxFormulas = (
	data: ExportData,
	exact: (row: number, column: number) => boolean,
) => (row: number, column: number) => string | undefined

type Typed =
	| { kind: 'empty' }
	| { kind: 'text'; text: string }
	| { kind: 'number'; value: number; pattern?: string }
	| { kind: 'boolean'; value: boolean }

const EMPTY: Typed = { kind: 'empty' }
const DAY = 86_400_000
// The day number that a spreadsheet gives to 1970-01-01.
const EPOCH_DAY = 25_569
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** A piece of a pattern: a code of the spreadsheet, or a text that shows as it is. */
type Token = { code: string } | { text: string }

function literal(text: string): string {
	if (!text) return ''
	// Intl writes a no-break space before a unit. A plain space reads the same,
	// and every reader of a pattern knows it without quotes.
	if (/^[ \u00a0\u202f]+$/.test(text)) return ' '.repeat(text.length)
	// A quote cannot be inside quotes, so each character gets its own escape.
	return text.includes('"') ? text.replace(/./gsu, '\\$&') : `"${text}"`
}

/** The pattern of the tokens. Texts that touch become one text, because two quoted texts in a row read as a quote inside one. */
function render(tokens: readonly Token[]): string {
	let out = ''
	let run = ''
	for (const token of tokens) {
		if ('text' in token) run += token.text
		else {
			out += literal(run) + token.code
			run = ''
		}
	}
	return out + literal(run)
}

const DIGITS = '\u0000'

/** The parts of a formatted number as tokens, with one `DIGITS` code where the number is. */
function numberSection(parts: readonly Intl.NumberFormatPart[]): Token[] | null {
	const tokens: Token[] = []
	let placed = false
	for (const part of parts) {
		if (
			part.type === 'integer' ||
			part.type === 'group' ||
			part.type === 'decimal' ||
			part.type === 'fraction'
		) {
			if (!placed) tokens.push({ code: DIGITS })
			placed = true
		} else if (part.type === 'minusSign') tokens.push({ code: '-' })
		else if (part.type === 'plusSign') tokens.push({ code: '+' })
		else if (part.type === 'percentSign') tokens.push({ code: '%' })
		else if (part.type === 'currency' || part.type === 'literal') tokens.push({ text: part.value })
		// A compact unit, an exponent: a spreadsheet pattern cannot say these.
		else return null
	}
	return placed ? tokens : null
}

type NumberWriter = (value: number) => { value: number; pattern: string }

/**
 * Gives a number the spreadsheet pattern that shows it as the Intl format of
 * the column shows it, or `null` when no pattern can.
 */
function numberWriter(
	name: NumericFormatName,
	options: FormatOptionsByName[NumericFormatName] | undefined,
	locale: string,
): NumberWriter | null {
	let plan
	try {
		plan = numberPlan(name, options ?? {}, locale)
	} catch {
		return null
	}
	const resolved = plan.intl.resolvedOptions()
	if (resolved.notation !== 'standard' || resolved.minimumSignificantDigits !== undefined) {
		return null
	}
	// A pattern writes the digits 0 to 9 in groups of three. Other digits, or
	// groups of another size such as "12,34,567", are the text of the screen.
	if (resolved.numberingSystem !== 'latn') return null
	const groups = plan.intl
		.formatToParts(plan.scale(1234567890))
		.filter((part) => part.type === 'integer')
	if (groups.slice(1).some((group) => group.value.length !== 3)) return null
	// The name of a currency has a plural ("1 US dollar", "5 US dollars"), and a pattern holds one text.
	if (resolved.style === 'currency' && resolved.currencyDisplay === 'name') return null
	const whole = resolved.minimumIntegerDigits
	if (whole > 3) return null
	const min = resolved.minimumFractionDigits ?? 0
	const max = Math.max(min, resolved.maximumFractionDigits ?? min)
	const grouped = (resolved.useGrouping as unknown) !== false
	const integer = grouped ? `#,${'#'.repeat(3 - whole)}${'0'.repeat(whole)}` : '0'.repeat(whole)

	const positive = numberSection(plan.intl.formatToParts(1))
	const negative = numberSection(plan.intl.formatToParts(-1))
	if (!positive || !negative) return null
	const wrap = (section: readonly Token[]) =>
		render([{ text: options?.prefix ?? '' }, ...section, { text: options?.suffix ?? '' }])
	const plus = wrap(positive)
	const minus = wrap(negative)
	// A spreadsheet puts the minus sign first by itself. Another form, such as
	// an amount in brackets, needs a section of its own.
	const template = minus === `-${plus}` ? plus : `${plus};${minus}`

	// A pattern with optional digits shows "150." for 150. So each value gets
	// the pattern with the number of digits that the value shows.
	const patterns = new Map<number, string>()
	const patternFor = (digits: number): string => {
		let pattern = patterns.get(digits)
		if (pattern === undefined) {
			const code = integer + (digits > 0 ? `.${'0'.repeat(digits)}` : '')
			pattern = template.replaceAll(DIGITS, code)
			patterns.set(digits, pattern)
		}
		return pattern
	}

	// A spreadsheet rounds half away from zero, as Intl does by default. For
	// another rule, the value is rounded here, at the digits that show.
	const mode = resolved.roundingMode
	const round =
		mode === 'ceil'
			? Math.ceil
			: mode === 'floor'
				? Math.floor
				: mode === 'trunc'
					? Math.trunc
					: undefined
	// The percent style shows the value times 100.
	const shift = resolved.style === 'percent' ? 100 : 1
	const factor = 10 ** max * shift
	return (input) => {
		const scaled = plan.scale(input)
		const value = round ? round(Number((scaled * factor).toPrecision(15))) / factor : scaled
		let digits = max
		if (min < max) {
			// The digits that the screen shows. A count of the digits of the
			// number itself would show the noise of a binary number.
			const fraction = plan.intl.formatToParts(scaled).find((part) => part.type === 'fraction')
			digits = Math.max(min, fraction?.value.length ?? 0)
		}
		return { value, pattern: patternFor(digits) }
	}
}

// A Saturday with one digit in each part: 2001-02-03 04:05:06.
const PROBE = Date.UTC(2001, 1, 3, 4, 5, 6)

function nameCode(value: string, locale: string, field: 'month' | 'weekday'): string {
	const short = getDateTimeFormat(locale, { [field]: 'short', timeZone: 'UTC' }).format(PROBE)
	const letters = (text: string) => text.replace(/\./g, '').length
	const code = field === 'month' ? 'm' : 'd'
	if (field === 'month' && value.length === 1) return 'mmmmm'
	return code.repeat(letters(value) <= letters(short) ? 3 : 4)
}

// Every month, every day of the week, and a time before and after noon.
const NAME_PROBES = [
	...Array.from({ length: 12 }, (_, month) => Date.UTC(2001, month, 3, 4, 5, 6)),
	...Array.from({ length: 7 }, (_, day) => Date.UTC(2001, 1, day + 1, 16, 5, 6)),
]
const ENGLISH = {
	mmm: getDateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }),
	mmmm: getDateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }),
	mmmmm: getDateTimeFormat('en-US', { month: 'narrow', timeZone: 'UTC' }),
	ddd: getDateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }),
	dddd: getDateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }),
}

/**
 * Whether the format writes its names as a spreadsheet does. A spreadsheet
 * program writes the names of months and days, and AM and PM, in its own
 * language, which a file cannot set. The English ones are the ones that
 * every program can show, so only a format that writes those gets a pattern.
 */
function englishNames(format: Intl.DateTimeFormat, locale: string): boolean {
	return NAME_PROBES.every((probe) =>
		format.formatToParts(probe).every((part) => {
			if (part.type === 'dayPeriod') {
				return part.value === (new Date(probe).getUTCHours() < 12 ? 'AM' : 'PM')
			}
			if ((part.type !== 'month' && part.type !== 'weekday') || /^\d+$/.test(part.value)) {
				return true
			}
			const code = nameCode(part.value, locale, part.type)
			return code in ENGLISH && ENGLISH[code as keyof typeof ENGLISH].format(probe) === part.value
		}),
	)
}

function dateSection(format: Intl.DateTimeFormat, locale: string): string | null {
	const resolved = format.resolvedOptions()
	// A pattern counts years as the Gregorian calendar does, and writes the digits 0 to 9.
	if (resolved.numberingSystem !== 'latn' || resolved.calendar !== 'gregory') return null
	// A spreadsheet counts the hours of half a day from 12 to 11, and of a day from 0 to 23.
	if (resolved.hourCycle === 'h11' || resolved.hourCycle === 'h24') return null
	if (!englishNames(format, locale)) return null
	const parts = format.formatToParts(PROBE)
	const has = (type: string) => parts.some((part) => part.type === type)
	// Without an hour before it or a second after it, a spreadsheet reads `m` as a month.
	if (has('minute') && !has('hour') && !has('second')) return null
	let out = ''
	for (const part of parts) {
		const digits = /^\d+$/.test(part.value)
		const width = part.value.length > 1 ? 2 : 1
		if (part.type === 'year') out += part.value.length <= 2 ? 'yy' : 'yyyy'
		else if (part.type === 'month') {
			out += digits ? 'm'.repeat(width) : nameCode(part.value, locale, 'month')
		} else if (part.type === 'day') out += 'd'.repeat(width)
		else if (part.type === 'weekday') out += nameCode(part.value, locale, 'weekday')
		else if (part.type === 'hour') out += 'h'.repeat(width)
		else if (part.type === 'minute') out += 'm'.repeat(width)
		else if (part.type === 'second') out += 's'.repeat(width)
		else if (part.type === 'dayPeriod') out += 'AM/PM'
		else if (part.type === 'literal') {
			// Intl writes a narrow no-break space before "AM"; a pattern takes a plain one.
			const text = part.value.replace(/[\u00a0\u202f]/g, ' ')
			// A point stays in quotes: after a time, some readers take a bare one for a part of a second.
			out += /^[ :/,-]*$/.test(text) ? text : literal(text)
		}
		// An era, a zone name: a spreadsheet pattern cannot say these.
		else return null
	}
	return out
}

type DateWriter = { pattern: string; value: (value: unknown) => number | undefined }

function wallTime(date: Date, timeZone: string | undefined): number {
	if (!timeZone) return date.getTime() - date.getTimezoneOffset() * 60_000
	const parts = getDateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
	}).formatToParts(date)
	const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
	return Date.UTC(
		read('year'),
		read('month') - 1,
		read('day'),
		read('hour'),
		read('minute'),
		read('second'),
	)
}

// The day number of 9999-12-31, the last day that a spreadsheet shows.
const LAST_DAY = 2_958_465

/** The day number of a moment on the wall clock, or `undefined` outside the days that a spreadsheet counts right. */
function dayNumber(wall: number): number | undefined {
	// Intl cuts the parts of a second off, and a spreadsheet rounds them:
	// 22:30:59.789 must not read as 22:31.
	const day = (Math.floor(wall / 1000) * 1000) / DAY + EPOCH_DAY
	// Day 60 is 1900-02-29, a day that never was; the numbers before it are one off.
	return day >= 61 && day < LAST_DAY + 1 ? day : undefined
}

function dateWriter(
	name: 'date' | 'time' | 'datetime',
	options: DateFormatOptions | undefined,
	locale: string,
): DateWriter | null {
	// The name of a time zone changes with the date, and a pattern holds one text.
	if (options?.timeZoneName) return null
	let sections: (string | null)[]
	try {
		sections = dateFormats(name, options ?? {}, locale, 'UTC').map((format) =>
			dateSection(format, locale),
		)
		// A time zone that Intl refuses fails here, once, and not for each cell.
		if (options?.timeZone) wallTime(new Date(PROBE), options.timeZone)
	} catch {
		return null
	}
	if (!sections.length || sections.some((section) => section === null)) return null
	return {
		pattern: literal(options?.prefix ?? '') + sections.join(' ') + literal(options?.suffix ?? ''),
		value: (value) => {
			// A calendar day is that day in every time zone, as on the screen.
			if (typeof value === 'string' && DATE_ONLY.test(value)) {
				const day = new Date(`${value}T00:00:00Z`).getTime()
				return Number.isNaN(day) ? undefined : dayNumber(day)
			}
			const date = toDate(value)
			return date ? dayNumber(wallTime(date, options?.timeZone)) : undefined
		},
	}
}

/** A value without a format: a number stays a number, a date becomes a date, the rest is text. */
function plain(value: unknown, text: string): Typed {
	if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'number', value }
	if (typeof value === 'boolean') return { kind: 'boolean', value }
	if (value instanceof Date) {
		// The screen shows such a value as an ISO text, which is in UTC.
		const day = Number.isNaN(value.getTime()) ? undefined : dayNumber(value.getTime())
		if (day !== undefined) return { kind: 'number', value: day, pattern: 'yyyy-mm-dd hh:mm:ss' }
	}
	return text ? { kind: 'text', text } : EMPTY
}

/** How the cells of one column become cells of the sheet. */
function columnWriter(column: ColumnDef, locale: string): (cell: ExportCell) => Typed {
	const format = column.format
	if (column.exportValue || !format) return (cell) => plain(cell.value, cell.text)
	const text = (cell: ExportCell): Typed => (cell.text ? { kind: 'text', text: cell.text } : EMPTY)
	const options = column.formatOptions
	const cellLocale = options?.locale ?? locale

	if (isNumericFormat(format)) {
		// The format is a number format, so its options are number options.
		const writer = numberWriter(
			format as NumericFormatName,
			options as FormatOptionsByName[NumericFormatName] | undefined,
			cellLocale,
		)
		if (!writer) return text
		return (cell) => {
			const value = readNumber(cell.value)
			return value === undefined || !Number.isFinite(value)
				? text(cell)
				: { kind: 'number', ...writer(value) }
		}
	}
	if (format === 'date' || format === 'time' || format === 'datetime') {
		const writer = dateWriter(format, options, cellLocale)
		if (!writer) return text
		return (cell) => {
			const missing = cell.value === null || cell.value === undefined || cell.value === ''
			const value = missing ? undefined : writer.value(cell.value)
			return value === undefined ? text(cell) : { kind: 'number', value, pattern: writer.pattern }
		}
	}
	if (format === 'period') {
		// A day, a month and a year are dates when a pattern shows them as the screen does.
		const fields = PERIOD_FIELDS[(options as PeriodFormatOptions | undefined)?.unit ?? 'day']
		let pattern: string | null = null
		try {
			if (fields)
				pattern = dateSection(
					getDateTimeFormat(cellLocale, { ...fields, timeZone: 'UTC' }),
					cellLocale,
				)
		} catch {
			pattern = null
		}
		if (pattern === null) return text
		return (cell) => {
			const day =
				typeof cell.value === 'string' && DATE_ONLY.test(cell.value)
					? dayNumber(Date.parse(`${cell.value}T00:00:00Z`))
					: undefined
			return day === undefined ? text(cell) : { kind: 'number', value: day, pattern }
		}
	}
	// A link, a yes or no, a cut text, a time ago: the file holds the text of the screen.
	return text
}

// Everything that XML 1.0 cannot hold: control characters, and half of a surrogate pair.
const INVALID_XML = /[^\t\n\r\u{20}-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/gu
// The longest text that a cell of a spreadsheet holds.
const MAX_TEXT = 32_767

function xml(text: string): string {
	return text
		.slice(0, MAX_TEXT)
		.replace(INVALID_XML, '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

/** The text of a cell. A reader takes `_x000D_` in it for an escaped character, so the first `_` is escaped. */
function cellText(text: string): string {
	return xml(text).replace(/_(?=x[0-9A-Fa-f]{4}_)/g, '_x005F_')
}

function columnName(index: number): string {
	let name = ''
	for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
		name = String.fromCharCode(65 + ((n - 1) % 26)) + name
	}
	return name
}

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const RELS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const TYPES = 'application/vnd.openxmlformats-officedocument.spreadsheetml'

/** The MIME type of an Excel file. */
export const XLSX_TYPE = `${TYPES}.sheet`

function sheetName(name: string | undefined): string {
	// These characters are not allowed in the name of a sheet, it holds 31 at
	// most, and a quote cannot be its first or its last character.
	const clean = (name ?? '')
		.replace(/[[\]:*?/\\]/g, ' ')
		.trim()
		.slice(0, 31)
		.replace(/^'+|'+$/g, '')
		.trim()
	return clean || 'Sheet1'
}

/**
 * Writes the cells as an Excel file (`.xlsx`) with one sheet. A number, a
 * percentage, an amount and a date are cells of that type, and each has a
 * pattern that shows it as the format of its column shows it on the screen.
 * A value that no pattern can show that way is text, the text of the screen.
 */
export async function toXlsx(data: ExportData, options: XlsxOptions = {}): Promise<Uint8Array> {
	const locale = data.locale ?? DEFAULT_LOCALE
	const writers = data.columns.map((item) => columnWriter(item.column, locale))

	// The styles: one for each pair of a weight and a pattern. Style 0 is a plain cell.
	const patterns = new Map<string, number>()
	const styles = new Map<string, number>([['0|', 0]])
	const styleOf = (bold: boolean, pattern = ''): number => {
		const key = `${bold ? 1 : 0}|${pattern}`
		let index = styles.get(key)
		if (index === undefined) {
			if (pattern && !patterns.has(pattern)) patterns.set(pattern, 164 + patterns.size)
			index = styles.size
			styles.set(key, index)
		}
		return index
	}

	const widths = data.columns.map((item) => item.header.length)
	const out: string[] = []
	/** A cell; with `formula`, the formula and its result beside it; with `error`, an error of the file. */
	const write = (
		ref: string,
		typed: Typed,
		bold: boolean,
		formula?: string,
		error?: string,
	): void => {
		const f = formula === undefined ? '' : `<f>${xml(formula)}</f>`
		// Only a cell that needs it asks for the style, so a file has the styles it had before.
		const weight = () => (bold ? ` s="${styleOf(true)}"` : '')
		if (error !== undefined) {
			out.push(`<c r="${ref}"${weight()} t="e">${f}<v>${xml(error)}</v></c>`)
		} else if (typed.kind === 'empty') {
			if (f) out.push(`<c r="${ref}">${f}</c>`)
		} else if (typed.kind === 'text') {
			out.push(
				f
					? `<c r="${ref}"${weight()} t="str">${f}<v>${cellText(typed.text)}</v></c>`
					: `<c r="${ref}"${weight()} t="inlineStr"><is><t xml:space="preserve">${cellText(typed.text)}</t></is></c>`,
			)
		} else if (typed.kind === 'boolean') {
			out.push(`<c r="${ref}"${weight()} t="b">${f}<v>${typed.value ? 1 : 0}</v></c>`)
		} else {
			const style = styleOf(bold, typed.pattern)
			out.push(`<c r="${ref}"${style ? ` s="${style}"` : ''}>${f}<v>${typed.value}</v></c>`)
		}
	}

	out.push('<row r="1">')
	data.columns.forEach((item, index) => {
		write(`${columnName(index)}1`, { kind: 'text', text: item.header }, true)
	})
	out.push('</row>')

	// Each cell as a cell of the sheet, before any is written: a formula looks at the cells it reads.
	const typedRows = data.rows.map((row) =>
		row.cells.map((cell, index): Typed => {
			const item = data.columns[index]
			const writer = writers[index]
			if (!item || !writer) return EMPTY
			let typed: Typed
			if (row.kind === 'row') {
				// A cell with a format of its own shows another text than its column
				// writes. Its text on the screen is what the file must hold.
				typed = decidesText(cell.format)
					? cell.text
						? { kind: 'text', text: cell.text }
						: EMPTY
					: writer(cell)
			} else {
				// A total has the type of its column when it reads as a cell of the
				// column reads. A count of texts, for one, does not.
				const { format, formatOptions } = item.column
				const same =
					format !== undefined &&
					formatValue(cell.value, format, formatOptions, { locale }) === cell.text
				typed = same
					? writer(cell)
					: typeof cell.value === 'number' && String(cell.value) === cell.text
						? { kind: 'number', value: cell.value }
						: cell.text
							? { kind: 'text', text: cell.text }
							: EMPTY
			}
			return typed
		}),
	)
	// With formulas, an error of a formula is an error of the file, which a formula there can test.
	const errorOf = (row: ExportData['rows'][number], cell: ExportCell) =>
		options.formula && row.kind === 'row' && isFormulaError(cell.value) && cell.value !== '#CYCLE!'
			? cell.value
			: undefined
	const exact = (rowIndex: number, index: number): boolean => {
		const row = data.rows[rowIndex]
		const cell = row?.cells[index]
		const typed = typedRows[rowIndex]?.[index]
		if (!row || row.kind !== 'row' || !cell || !typed) return false
		const value = cell.value
		// An error that the file does not know, such as `#CYCLE!`, is a text there.
		if (isFormulaError(value)) return errorOf(row, cell) !== undefined
		if (typed.kind === 'empty') return value === null || value === undefined || value === ''
		if (typed.kind === 'number' || typed.kind === 'boolean') return typed.value === value
		// A day is a date of the table and a text of the file.
		return typeof value === 'string' && typed.text === value && !DATE_ONLY.test(value)
	}
	const formulaAt = options.formula?.(data, exact)

	data.rows.forEach((row, rowIndex) => {
		const r = rowIndex + 2
		const bold = row.kind !== 'row'
		out.push(`<row r="${r}">`)
		row.cells.forEach((cell, index) => {
			const typed = typedRows[rowIndex]?.[index]
			if (!typed) return
			write(
				`${columnName(index)}${r}`,
				typed,
				bold,
				formulaAt?.(rowIndex, index),
				errorOf(row, cell),
			)
			// The first rows say enough about the width of a column.
			if (rowIndex < 200) widths[index] = Math.max(widths[index] ?? 0, cell.text.length)
		})
		out.push('</row>')
	})

	const cols = widths
		.map((width, index) => {
			const chars = Math.min(60, Math.max(8, width + 2))
			return `<col min="${index + 1}" max="${index + 1}" width="${chars}" customWidth="1"/>`
		})
		.join('')
	const pane =
		options.freezeHeader === false
			? ''
			: '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
	const sheet = `${HEAD}<worksheet xmlns="${MAIN}">${pane}${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${out.join('')}</sheetData></worksheet>`

	const numFmts = patterns.size
		? `<numFmts count="${patterns.size}">${[...patterns]
				.map(([pattern, id]) => `<numFmt numFmtId="${id}" formatCode="${xml(pattern)}"/>`)
				.join('')}</numFmts>`
		: ''
	const xfs = [...styles.keys()]
		.map((key) => {
			const bold = key.startsWith('1')
			const pattern = key.slice(2)
			const id = pattern ? (patterns.get(pattern) ?? 0) : 0
			return `<xf numFmtId="${id}" fontId="${bold ? 1 : 0}" fillId="0" borderId="0" xfId="0"${id ? ' applyNumberFormat="1"' : ''}${bold ? ' applyFont="1"' : ''}/>`
		})
		.join('')
	const font = '<sz val="11"/><name val="Calibri"/>'
	const stylesheet = `${HEAD}<styleSheet xmlns="${MAIN}">${numFmts}<fonts count="2"><font>${font}</font><font><b/>${font}</font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.size}">${xfs}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

	const workbook = `${HEAD}<workbook xmlns="${MAIN}" xmlns:r="${DOC}"><bookViews><workbookView/></bookViews><sheets><sheet name="${xml(sheetName(options.sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`
	const workbookRels = `${HEAD}<Relationships xmlns="${RELS}"><Relationship Id="rId1" Type="${DOC}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${DOC}/styles" Target="styles.xml"/></Relationships>`
	const rootRels = `${HEAD}<Relationships xmlns="${RELS}"><Relationship Id="rId1" Type="${DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
	const contentTypes = `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${TYPES}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${TYPES}.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="${TYPES}.styles+xml"/></Types>`

	const encoder = new TextEncoder()
	return zip(
		[
			{ name: '[Content_Types].xml', data: encoder.encode(contentTypes) },
			{ name: '_rels/.rels', data: encoder.encode(rootRels) },
			{ name: 'xl/workbook.xml', data: encoder.encode(workbook) },
			{ name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRels) },
			{ name: 'xl/styles.xml', data: encoder.encode(stylesheet) },
			{ name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheet) },
		],
		options.compress !== false,
	)
}
