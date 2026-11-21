import { cellValue, toText, type ColumnDef } from '../rows'
import { checkValue, type Checked } from './schema'

const NUMBER_FORMATS: readonly string[] = ['integer', 'decimal', 'number', 'currency', 'percentage']

/** The text that the editor of a cell starts with: the value as plain text, without the format of the column. */
export function editText(row: unknown, column: ColumnDef): string {
	return toText(cellValue(row, column))
}

// The number as code writes it, which is also how the editor shows it.
const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i
const MINUS_SIGNS = /[\u2212\u2012\u2013]/g
// A day as the editor shows a date: an ISO text. `new Date('5')` is a date in 2001, and no person means that.
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/

type NumberReader = { shape: RegExp; group: RegExp; decimal: string }

const readers = new Map<string, NumberReader>()

function numberReader(locale: string): NumberReader {
	let found = readers.get(locale)
	if (!found) {
		let parts: Intl.NumberFormatPart[] = []
		try {
			parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
		} catch {
			// A locale that Intl does not know reads numbers as English writes them.
		}
		const sign = (type: string, fallback: string) =>
			parts.find((part) => part.type === type)?.value ?? fallback
		const escape = (text: string) => text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
		const groupSign = sign('group', ',')
		// Intl writes a no-break space as the group sign; a person types a plain one.
		const group = groupSign.trim() === '' ? '[\\s\\u00a0\\u202f]' : escape(groupSign)
		const decimal = sign('decimal', '.')
		found = {
			// Digits in groups of three (of two before the last, as in India), or digits
			// without groups. A sign in another place, such as in `12,5` in English,
			// is not a number of this language.
			shape: new RegExp(
				`^[+-]?(?:\\d{1,3}(?:${group}\\d{2,3})*${group}\\d{3}|\\d+)(?:${escape(decimal)}\\d*)?$`,
			),
			group: new RegExp(group, 'g'),
			decimal,
		}
		readers.set(locale, found)
	}
	return found
}

/**
 * The number that a text stands for, or `undefined`. A number as code writes
 * it wins, because the editor shows numbers that way: `1.234` is always a
 * little more than one. Any other text is read with the group and decimal
 * signs of the locale, so `12,5` from a spreadsheet in Finnish is 12.5 and
 * `1,234.5` in English is 1234.5.
 */
export function readNumberText(text: string, locale?: string): number | undefined {
	const trimmed = text.trim().replace(MINUS_SIGNS, '-')
	if (PLAIN_NUMBER.test(trimmed)) return Number(trimmed)
	const reader = numberReader(locale ?? 'en-US')
	if (!reader.shape.test(trimmed)) return undefined
	return Number(trimmed.replace(reader.group, '').replace(reader.decimal, '.'))
}

/** The reasons why a text is refused, from the `messages` of the table. */
export type ParseTexts = {
	notNumber: (text: string) => string
	notDate: (text: string) => string
	notBoolean: (text: string) => string
}

/**
 * The value that a text stands for in a column. The `parse` of the column
 * decides. Without it, the value that the cell holds now decides: a number
 * stays a number, a boolean a boolean, a date a date, and anything else gets
 * the text. An empty text empties a number or a date.
 */
export function parseText(
	text: string,
	row: unknown,
	column: ColumnDef,
	texts: ParseTexts,
	locale?: string,
): Checked {
	if (column.parse) return { value: column.parse(text, row) }
	const current = cellValue(row, column)
	const numeric =
		typeof current === 'number' ||
		(current == null && !!column.format && NUMBER_FORMATS.includes(column.format))
	if (numeric) {
		if (text.trim() === '') return { value: null }
		const value = readNumberText(text, column.formatOptions?.locale ?? locale)
		return value === undefined ? { issues: [texts.notNumber(text)] } : { value }
	}
	if (typeof current === 'bigint') {
		try {
			return { value: BigInt(text.trim()) }
		} catch {
			return { issues: [texts.notNumber(text)] }
		}
	}
	if (typeof current === 'boolean') {
		const word = text.trim().toLowerCase()
		if (word === 'true' || word === 'false') return { value: word === 'true' }
		return { issues: [texts.notBoolean(text)] }
	}
	if (current instanceof Date) {
		const trimmed = text.trim()
		if (trimmed === '') return { value: null }
		const value = new Date(trimmed)
		return ISO_DAY.test(trimmed) && !Number.isNaN(value.getTime())
			? { value }
			: { issues: [texts.notDate(text)] }
	}
	return { value: text }
}

/**
 * The value of a cell that a person emptied, as Delete does in a sheet. The
 * `parse` of the column decides, from an empty text. Without it, the value
 * that the cell holds now decides: a number or a date gives `null`, a
 * boolean gives `false`, and anything else gives an empty text.
 */
export function emptyValue(row: unknown, column: ColumnDef): unknown {
	if (column.parse) return column.parse('', row)
	const current = cellValue(row, column)
	if (typeof current === 'number' || typeof current === 'bigint' || current instanceof Date) {
		return null
	}
	if (typeof current === 'boolean') return false
	if (current == null && !!column.format && NUMBER_FORMATS.includes(column.format)) return null
	return ''
}

/** Whether two cell values are the same value, so an edit from one to the other changes nothing. */
export function sameValue(a: unknown, b: unknown): boolean {
	// `===` too: 0 and -0 show the same.
	if (a === b || Object.is(a, b)) return true
	if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
	// An empty cell holds `null`, `undefined` or no text, and each of them shows the same.
	const empty = (value: unknown) => value == null || value === ''
	return empty(a) && empty(b)
}

/**
 * Parses a text when the input is a text, and checks the value with the
 * schema of the column. The answer is a promise only when the schema itself
 * answers with one.
 */
export function resolveValue(
	input: { text: string } | { value: unknown },
	row: unknown,
	column: ColumnDef,
	texts: ParseTexts,
	locale?: string,
): Checked | Promise<Checked> {
	const parsed = 'text' in input ? parseText(input.text, row, column, texts, locale) : input
	if ('issues' in parsed) return parsed
	return checkValue(column.schema, parsed.value)
}
