import type { ColumnDef } from './types'

/** The columns that hold cells, in order, with header groups removed. */
export function leafColumns<Row>(columns: readonly ColumnDef<Row>[]): ColumnDef<Row>[] {
	const leaves: ColumnDef<Row>[] = []
	const walk = (list: readonly ColumnDef<Row>[]) => {
		for (const column of list) {
			if (column.columns?.length) walk(column.columns)
			else leaves.push(column)
		}
	}
	walk(columns)
	return leaves
}

export function cellValue<Row>(row: Row, column: ColumnDef<Row>): unknown {
	if (column.value) return column.value(row)
	if (typeof row !== 'object' || row === null) return undefined
	return (row as Record<string, unknown>)[column.key ?? column.id]
}

/**
 * A cell value as plain text, for matching, sorting and group keys. A value
 * that is an object has no useful default text, so it becomes JSON.
 */
export function toText(value: unknown): string {
	if (value === null || value === undefined) return ''
	if (typeof value === 'string') return value
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
		return String(value)
	}
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
	if (Array.isArray(value)) return value.map((part) => toText(part)).join(', ')
	return JSON.stringify(value) ?? ''
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

function dayStart(value: unknown, addDays: number): number | undefined {
	const parts = typeof value === 'string' ? DATE_ONLY.exec(value) : null
	if (!parts) return undefined
	const time = new Date(
		Number(parts[1]),
		Number(parts[2]) - 1,
		Number(parts[3]) + addDays,
	).getTime()
	return Number.isNaN(time) ? undefined : time
}

/**
 * The last millisecond of a day given as `YYYY-MM-DD`, or `undefined` for any
 * other value. It comes from the start of the next day, because a day is 23
 * or 25 hours long when the clocks change.
 */
export function dayEnd(value: unknown): number | undefined {
	const next = dayStart(value, 1)
	return next === undefined ? undefined : next - 1
}

/**
 * A cell value as a point in time, or `undefined` when it is not a date. A
 * `YYYY-MM-DD` text is the start of that day in local time, like a date a
 * person picks; the filter and the facets must agree on this.
 */
export function toTime(value: unknown): number | undefined {
	const day = dayStart(value, 0)
	if (day !== undefined) return day
	const time =
		value instanceof Date
			? value.getTime()
			: typeof value === 'string' || typeof value === 'number'
				? new Date(value).getTime()
				: NaN
	return Number.isNaN(time) ? undefined : time
}

/**
 * A key that is the same for two values a person sees as the same. Two `Date`
 * objects for one moment are different objects, so a `Set` or a `Map` keyed
 * on the values themselves never matches them.
 */
export function valueKey(value: unknown): unknown {
	return value instanceof Date ? `date:${value.getTime()}` : value
}

/**
 * Finds columns by id and fails with the valid ids, so a caller (a person or
 * an agent) can correct the id without reading the column definitions.
 */
export function requireColumns<Row>(
	columns: readonly ColumnDef<Row>[],
	ids: readonly string[],
	purpose: string,
): ColumnDef<Row>[] {
	const byId = new Map(columns.map((column) => [column.id, column]))
	return ids.map((id) => {
		const column = byId.get(id)
		if (!column) {
			throw new Error(
				`No column "${id}" to ${purpose}. Columns: ${[...byId.keys()].join(', ') || 'none'}.`,
			)
		}
		return column
	})
}
