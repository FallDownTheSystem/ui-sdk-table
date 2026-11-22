import type { FormatName, FormatOptions } from '../format'
import type { ColumnDef } from '../rows'

/** The ways a cell format can show a value. `text` shows the value as it is. */
export const CELL_FORMAT_NAMES = [
	'text',
	'integer',
	'decimal',
	'currency',
	'percentage',
	'date',
	'datetime',
] as const
export type CellFormatName = (typeof CELL_FORMAT_NAMES)[number]

export const CELL_DATE_STYLES = ['short', 'medium', 'long', 'full'] as const
export const CELL_ALIGNS = ['start', 'center', 'end'] as const
/** The most decimals that a cell format can ask for. */
export const CELL_MAX_DECIMALS = 10

/**
 * The format of a cell: how its value becomes text, and how the cell looks.
 * The looks are data: the table writes them as `data-*` attributes, and the
 * style of the app gives them a meaning. A colour is a name of the
 * `formatColors` option of the table and no colour of CSS, so light and dark
 * mode and the contrast stay with the app.
 */
export type CellFormat = {
	/** How the value becomes text, in place of the `format` of the column. */
	format?: CellFormatName
	/** How many decimals a number shows: 0 to 10. */
	decimals?: number
	/** The currency of the `currency` format, as an ISO 4217 code such as `EUR`. */
	currency?: string
	/** The length of a date: the `dateStyle` of `Intl.DateTimeFormat`. */
	dateStyle?: (typeof CELL_DATE_STYLES)[number]
	/** Where the text stands in the cell, as `data-align`. */
	align?: (typeof CELL_ALIGNS)[number]
	/** Bold text, as `data-bold`. */
	bold?: boolean
	/** Italic text, as `data-italic`. */
	italic?: boolean
	/** The colour of the text: a name of the `formatColors` option. */
	color?: string
	/** The colour behind the text: a name of the `formatColors` option. */
	fill?: string
}

/** A change of a format. A key with `null` takes that property away. */
export type CellFormatPatch = { [Key in keyof CellFormat]?: CellFormat[Key] | null }

/**
 * The formats of a table, in two layers. A property of a cell wins over the
 * same property of its column, and both win over the `format` and the
 * `formatOptions` of the column definition. A format is found by row id and
 * column id, so it follows its row through a sort, a filter and a page.
 */
export type CellFormats = {
	/** By column id: every cell of the column, also of rows that come later. */
	columns?: Readonly<Record<string, CellFormat>>
	/** By row id, then by column id. */
	cells?: Readonly<Record<string, Readonly<Record<string, CellFormat>>>>
}

/** Which formats a change is for: cells by row id and column id, or whole columns. */
export type FormatPlace =
	| { rows: readonly string[]; columns: readonly string[] }
	| { columns: readonly string[] }

export const CELL_FORMAT_KEYS = [
	'format',
	'decimals',
	'currency',
	'dateStyle',
	'align',
	'bold',
	'italic',
	'color',
	'fill',
] as const satisfies readonly (keyof CellFormat)[]

/** A patch that takes every property away. */
export const CLEAR_FORMAT: CellFormatPatch = Object.freeze(
	Object.fromEntries(CELL_FORMAT_KEYS.map((key) => [key, null])),
)

const NO_FORMAT: CellFormat = Object.freeze({})

type RowFormats = Readonly<Record<string, CellFormat>>

const isEmpty = (record: object): boolean => {
	for (const _key in record) return false
	return true
}

/** A format with a patch over it. The format itself when the patch changes nothing, and `undefined` when nothing is left. */
function patched(format: CellFormat | undefined, patch: CellFormatPatch): CellFormat | undefined {
	let next: Record<string, unknown> | undefined
	const now = (format ?? NO_FORMAT) as Record<string, unknown>
	for (const key of CELL_FORMAT_KEYS) {
		if (!(key in patch)) continue
		const value = patch[key]
		if (value === undefined) continue
		if (value === null ? !(key in now) : now[key] === value) continue
		next ??= { ...now }
		if (value === null) delete next[key]
		else next[key] = value
	}
	if (!next) return format
	return isEmpty(next) ? undefined : (next as CellFormat)
}

/** A format without the properties that a patch names. */
function without(format: CellFormat, patch: CellFormatPatch): CellFormat | undefined {
	let next: Record<string, unknown> | undefined
	for (const key of CELL_FORMAT_KEYS) {
		if (!(key in patch) || patch[key] === undefined || !(key in format)) continue
		next ??= { ...format }
		delete next[key]
	}
	if (!next) return format
	return isEmpty(next) ? undefined : (next as CellFormat)
}

/** Runs `change` once for each object that it gets, and gives the same answer for the same object. */
function once<In extends object, Out>(change: (given: In | undefined) => Out) {
	const kept = new Map<In | undefined, Out>()
	return (given: In | undefined): Out => {
		if (kept.has(given)) return kept.get(given) as Out
		const result = change(given)
		kept.set(given, result)
		return result
	}
}

/**
 * The formats with a patch for some cells or some columns. It changes
 * nothing in place and shares what it can: the cells of one call that had
 * the same format before get the same object after, so a format for 50,000
 * cells is one new record with 50,000 keys and one format object. The
 * formats themselves come back when the patch changes nothing.
 *
 * A patch for whole columns goes to the `columns` layer, and takes its
 * properties out of the cells of those columns: the column is the last thing
 * that was said, so it wins.
 */
export function setFormats(
	formats: CellFormats,
	place: FormatPlace,
	patch: CellFormatPatch,
): CellFormats {
	const columnIds = place.columns
	if (!columnIds.length) return formats

	if (!('rows' in place)) {
		let columns: Record<string, CellFormat> | undefined
		for (const id of columnIds) {
			const before = formats.columns?.[id]
			const after = patched(before, patch)
			if (after === before) continue
			columns ??= { ...formats.columns }
			if (after) columns[id] = after
			else delete columns[id]
		}
		// The cells of these columns lose the properties that the column now says.
		const strip = once((format: CellFormat | undefined) =>
			format ? without(format, patch) : format,
		)
		const stripRow = once((row: RowFormats | undefined): RowFormats | undefined => {
			if (!row) return row
			let next: Record<string, CellFormat> | undefined
			for (const id of columnIds) {
				const before = row[id]
				if (!before) continue
				const after = strip(before)
				if (after === before) continue
				next ??= { ...row }
				if (after) next[id] = after
				else delete next[id]
			}
			if (!next) return row
			return isEmpty(next) ? undefined : next
		})
		let cells: Record<string, RowFormats> | undefined
		for (const rowId in formats.cells) {
			const before = formats.cells[rowId]
			const after = stripRow(before)
			if (after === before) continue
			cells ??= { ...formats.cells }
			if (after) cells[rowId] = after
			else delete cells[rowId]
		}
		if (!columns && !cells) return formats
		return tidy({ columns: columns ?? formats.columns, cells: cells ?? formats.cells })
	}

	const change = once((format: CellFormat | undefined) => patched(format, patch))
	const changeRow = once((row: RowFormats | undefined): RowFormats | undefined => {
		let next: Record<string, CellFormat> | undefined
		for (const id of columnIds) {
			const before = row?.[id]
			const after = change(before)
			if (after === before) continue
			next ??= { ...row }
			if (after) next[id] = after
			else delete next[id]
		}
		if (!next) return row
		return isEmpty(next) ? undefined : next
	})
	let cells: Record<string, RowFormats> | undefined
	for (const rowId of place.rows) {
		const before = formats.cells?.[rowId]
		const after = changeRow(before)
		if (after === before) continue
		cells ??= { ...formats.cells }
		if (after) cells[rowId] = after
		else delete cells[rowId]
	}
	if (!cells) return formats
	return tidy({ columns: formats.columns, cells })
}

/** Formats without a layer that holds nothing, so two values with the same formats read the same. */
function tidy(formats: CellFormats): CellFormats {
	const next: { -readonly [Key in keyof CellFormats]: CellFormats[Key] } = {}
	if (formats.columns && !isEmpty(formats.columns)) next.columns = formats.columns
	if (formats.cells && !isEmpty(formats.cells)) next.cells = formats.cells
	return next
}

/** Whether a format changes the text of a value, and not only the looks of its cell. */
export function decidesText(format: CellFormat | undefined): boolean {
	return (
		!!format &&
		(format.format !== undefined ||
			format.decimals !== undefined ||
			format.currency !== undefined ||
			format.dateStyle !== undefined)
	)
}

/** Whether two formats say the same. */
export function sameFormat(a: CellFormat | undefined, b: CellFormat | undefined): boolean {
	if (a === b) return true
	const left = (a ?? NO_FORMAT) as Record<string, unknown>
	const right = (b ?? NO_FORMAT) as Record<string, unknown>
	for (const key of CELL_FORMAT_KEYS) if (left[key] !== right[key]) return false
	return true
}

/** A format with every property that differs between `from` and `to` as `to` has it. The format itself when nothing changes. */
function turned(
	current: CellFormat | undefined,
	from: CellFormat | undefined,
	to: CellFormat | undefined,
): CellFormat | undefined {
	// As the change left it: the old format comes back whole, with the object that other cells share.
	if (current === from) return to
	let next: Record<string, unknown> | undefined
	const now = (current ?? NO_FORMAT) as Record<string, unknown>
	const before = (from ?? NO_FORMAT) as Record<string, unknown>
	const wanted = (to ?? NO_FORMAT) as Record<string, unknown>
	for (const key of CELL_FORMAT_KEYS) {
		if (before[key] === wanted[key] || now[key] === wanted[key]) continue
		next ??= { ...now }
		if (wanted[key] === undefined) delete next[key]
		else next[key] = wanted[key]
	}
	if (!next) return current
	return isEmpty(next) ? undefined : (next as CellFormat)
}

/**
 * Takes a change of formats back, or puts it on again: every property that
 * differs between `from` and `to` gets the value of `to`, in `now`. What the
 * owner changed beside it stays as it is: another cell, another column, and
 * another property of the same cell. `now` itself comes back when nothing
 * differs.
 */
export function revertFormats(now: CellFormats, from: CellFormats, to: CellFormats): CellFormats {
	// Nothing else changed since: the old value is the answer, with every object that it shared.
	if (now === from) return to
	let columns: Record<string, CellFormat> | undefined
	if (from.columns !== to.columns) {
		for (const id of new Set([
			...Object.keys(from.columns ?? {}),
			...Object.keys(to.columns ?? {}),
		])) {
			const current = now.columns?.[id]
			const next = turned(current, from.columns?.[id], to.columns?.[id])
			if (next === current) continue
			columns ??= { ...now.columns }
			if (next) columns[id] = next
			else delete columns[id]
		}
	}
	let cells: Record<string, RowFormats> | undefined
	if (from.cells !== to.cells) {
		const visit = (rowId: string) => {
			const before = from.cells?.[rowId]
			const wanted = to.cells?.[rowId]
			if (before === wanted) return
			const current = now.cells?.[rowId]
			let row: Record<string, CellFormat> | undefined
			if (current === before) {
				// The row is as the change left it, so it gets the old row whole.
				if (current === wanted) return
				cells ??= { ...now.cells }
				if (wanted) cells[rowId] = wanted
				else delete cells[rowId]
				return
			}
			for (const id of new Set([...Object.keys(before ?? {}), ...Object.keys(wanted ?? {})])) {
				const format = turned(current?.[id], before?.[id], wanted?.[id])
				if (format === current?.[id]) continue
				row ??= { ...current }
				if (format) row[id] = format
				else delete row[id]
			}
			if (!row) return
			cells ??= { ...now.cells }
			if (isEmpty(row)) delete cells[rowId]
			else cells[rowId] = row
		}
		for (const rowId in from.cells) visit(rowId)
		for (const rowId in to.cells) if (!from.cells || !(rowId in from.cells)) visit(rowId)
	}
	if (!columns && !cells) return now
	return tidy({ columns: columns ?? now.columns, cells: cells ?? now.cells })
}

/**
 * The formats without the entries of rows and columns that are gone. The
 * table keeps the format of a row that left, because the row can come back
 * with the next page or the next load. An owner that knows better calls this.
 */
export function pruneFormats(
	formats: CellFormats,
	rowIds: Iterable<string>,
	columnIds: Iterable<string>,
): CellFormats {
	const rows = rowIds instanceof Set ? (rowIds as ReadonlySet<string>) : new Set(rowIds)
	const kept = columnIds instanceof Set ? (columnIds as ReadonlySet<string>) : new Set(columnIds)
	let columns: Record<string, CellFormat> | undefined
	for (const id in formats.columns) {
		if (kept.has(id)) continue
		columns ??= { ...formats.columns }
		delete columns[id]
	}
	const prune = once((row: RowFormats | undefined): RowFormats | undefined => {
		if (!row) return row
		let next: Record<string, CellFormat> | undefined
		for (const id in row) {
			if (kept.has(id)) continue
			next ??= { ...row }
			delete next[id]
		}
		if (!next) return row
		return isEmpty(next) ? undefined : next
	})
	let cells: Record<string, RowFormats> | undefined
	for (const rowId in formats.cells) {
		const before = formats.cells[rowId]
		const after = rows.has(rowId) ? prune(before) : undefined
		if (after === before) continue
		cells ??= { ...formats.cells }
		if (after) cells[rowId] = after
		else delete cells[rowId]
	}
	if (!columns && !cells) return formats
	return tidy({ columns: columns ?? formats.columns, cells: cells ?? formats.cells })
}

// The format of a column with the format of a cell over it, kept for each
// pair of objects: 50,000 cells that share one format share one answer.
const merged = new WeakMap<CellFormat, WeakMap<CellFormat, CellFormat>>()

/**
 * The format that a cell has of its own: the format of its column in
 * `formats` with the format of the cell over it, property by property.
 * `undefined` when neither says anything. The `format` and the
 * `formatOptions` of the column definition are not in it.
 */
export function ownFormat(
	formats: CellFormats,
	rowId: string | undefined,
	columnId: string,
): CellFormat | undefined {
	const column = formats.columns?.[columnId]
	const cell = rowId === undefined ? undefined : formats.cells?.[rowId]?.[columnId]
	if (!column || !cell) return cell ?? column
	let byCell = merged.get(column)
	if (!byCell) merged.set(column, (byCell = new WeakMap()))
	let both = byCell.get(cell)
	if (!both) byCell.set(cell, (both = { ...column, ...cell }))
	return both
}

/** How a cell shows its value, after every layer. */
export type ResolvedFormat = {
	/** The name for `data-format`: the format of the cell, else of the column. */
	name: string | undefined
	/** The format that makes the text. `undefined` shows the value as it is. */
	format: FormatName | undefined
	/** The options for `formatValue`: one object for each pair of a column and a format, so its prepared `Intl` formats are used again. */
	options: FormatOptions | undefined
	/** Whether the format of the cell decides the text, and not the definition of the column alone. */
	own: boolean
}

const DATE_FIELDS = [
	'weekday',
	'year',
	'month',
	'day',
	'hour',
	'minute',
	'second',
	'timeStyle',
] as const
const NUMBER_NAMES: readonly string[] = ['integer', 'decimal', 'number', 'currency', 'percentage']
const DATE_NAMES: readonly string[] = ['date', 'datetime', 'time']

const resolved = new WeakMap<CellFormat, WeakMap<ColumnDef<any>, ResolvedFormat>>()

function resolve(column: ColumnDef<any>, own: CellFormat): ResolvedFormat {
	const given = own.format
	const base: Record<string, unknown> = { ...column.formatOptions }
	let format: FormatName | undefined = given === 'text' ? undefined : (given ?? column.format)
	if (!decidesText(own)) {
		return { name: column.format, format: column.format, options: column.formatOptions, own: false }
	}
	if (own.decimals !== undefined && given !== 'text') {
		// A whole number has no decimals to show, and a value without a format has no rule for them.
		if (format === undefined || format === 'integer') format = 'decimal'
		if (NUMBER_NAMES.includes(format)) {
			base.minimumFractionDigits = own.decimals
			base.maximumFractionDigits = own.decimals
		}
	}
	if (format === 'currency') {
		if (own.currency !== undefined) base.currency = own.currency
		// A person who asks for a currency means its sign.
		if (given === 'currency' || own.currency !== undefined) base.showUnit ??= true
	}
	if (format === 'percentage' && given === 'percentage') base.showUnit ??= true
	if (own.dateStyle !== undefined && format !== undefined && DATE_NAMES.includes(format)) {
		// `Intl` refuses a style together with single fields, so the style of the cell takes their place.
		for (const field of DATE_FIELDS) delete base[field]
		base.dateStyle = own.dateStyle
		if (format === 'datetime') base.timeStyle = 'short'
	}
	return {
		name: given ?? format,
		format,
		options: format === undefined ? undefined : (base as FormatOptions),
		own: true,
	}
}

/**
 * How a cell shows its value: the `format` and the `formatOptions` of its
 * column, then the format of the column in `formats`, then the format of the
 * cell. Without a row id, the layers of the column alone, as a footer cell has them.
 */
export function resolveFormat(
	column: ColumnDef<any>,
	formats: CellFormats,
	rowId?: string,
): ResolvedFormat {
	const own = ownFormat(formats, rowId, column.id)
	if (!own) {
		return { name: column.format, format: column.format, options: column.formatOptions, own: false }
	}
	let byColumn = resolved.get(own)
	if (!byColumn) resolved.set(own, (byColumn = new WeakMap()))
	let found = byColumn.get(column)
	if (!found) byColumn.set(column, (found = resolve(column, own)))
	return found
}

/** A value with the two layers of `cellFormats`, as `cellFormulas` has them too. */
type CellLayers = {
	readonly columns?: Readonly<Record<string, unknown>>
	readonly cells?: Readonly<Record<string, unknown>>
}

/**
 * For `selects` of a cell slot: a change of the formats wakes the cells of
 * the rows and of the columns whose formats changed, and no other cell. A
 * cell listens by the names that `formatNames` gives for it.
 */
export const byCellFormat = {
	moved: (
		previous: CellLayers | undefined,
		next: CellLayers | undefined,
		notify: (name: string) => void,
	): void => {
		const diff = (
			before: Readonly<Record<string, unknown>> | undefined,
			after: Readonly<Record<string, unknown>> | undefined,
			prefix: string,
		) => {
			if (before === after) return
			for (const id in before) if (before[id] !== after?.[id]) notify(prefix + id)
			for (const id in after) if (!before || !(id in before)) notify(prefix + id)
		}
		diff(previous?.columns, next?.columns, 'c:')
		diff(previous?.cells, next?.cells, 'r:')
	},
}

/** The names that a cell listens to for its format: its row, when it has one, and its column. */
export function formatNames(rowId: string | undefined, columnId: string | undefined): string[] {
	const names: string[] = []
	if (rowId !== undefined) names.push(`r:${rowId}`)
	if (columnId !== undefined) names.push(`c:${columnId}`)
	return names
}
