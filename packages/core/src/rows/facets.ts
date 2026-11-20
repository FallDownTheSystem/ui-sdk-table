import { cellValue, toTime, valueKey } from './columns'
import { walkRows } from './nodes'
import { compareValues } from './sort'
import type { ColumnDef, DataRow } from './types'

export type FacetValue = { value: unknown; count: number }

/** Each different value of a column with how many rows have it, sorted. A cell that holds a list counts once for each entry. */
export function uniqueValues<Row>(
	rows: readonly DataRow<Row>[],
	column: ColumnDef<Row>,
	locale?: string,
): FacetValue[] {
	const counts = new Map<unknown, FacetValue>()
	const add = (value: unknown) => {
		if (value === null || value === undefined || value === '') return
		const key = valueKey(value)
		const facet = counts.get(key)
		if (facet) facet.count++
		else counts.set(key, { value, count: 1 })
	}
	walkRows(rows, (node) => {
		const value = cellValue(node.row, column)
		if (Array.isArray(value)) value.forEach(add)
		else add(value)
	})
	return [...counts.values()].sort((a, b) => compareValues(a.value, b.value, locale))
}

/** The lowest and highest number of a column, or `null` when it holds no number. */
export function numberRange<Row>(
	rows: readonly DataRow<Row>[],
	column: ColumnDef<Row>,
): { min: number; max: number } | null {
	let min = Infinity
	let max = -Infinity
	walkRows(rows, (node) => {
		const value = cellValue(node.row, column)
		if (typeof value !== 'number' || Number.isNaN(value)) return
		if (value < min) min = value
		if (value > max) max = value
	})
	return min <= max ? { min, max } : null
}

/** The earliest and latest date of a column, or `null` when it holds no date. */
export function dateRange<Row>(
	rows: readonly DataRow<Row>[],
	column: ColumnDef<Row>,
): { from: Date; to: Date } | null {
	let min = Infinity
	let max = -Infinity
	walkRows(rows, (node) => {
		const value = cellValue(node.row, column)
		if (value === null || value === undefined || value === '') return
		const time = toTime(value)
		if (time === undefined) return
		if (time < min) min = time
		if (time > max) max = time
	})
	return min <= max ? { from: new Date(min), to: new Date(max) } : null
}
