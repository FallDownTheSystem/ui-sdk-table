import { cellValue, dayOf, isDay, timeZoneOf, toTime, valueKey } from './columns'
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
	const counts = new Map<string, FacetValue>()
	const add = (value: unknown) => {
		// A value without a text is no choice: its rows are the rows without a value.
		const key = valueKey(value)
		if (key === '') return
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

/**
 * The first and the last day of a column of dates, as `YYYY-MM-DD`, or `null`
 * when it holds no date. A moment falls on a day in the zone of the column,
 * or in local time for a column without one; a value that is a calendar day
 * is that day in every zone. A range of dates is matched the same way.
 */
export function dayRange<Row>(
	rows: readonly DataRow<Row>[],
	column: ColumnDef<Row>,
): { from: string; to: string } | null {
	const zone = timeZoneOf(column)
	let from = ''
	let to = ''
	walkRows(rows, (node) => {
		const value = cellValue(node.row, column)
		if (value === null || value === undefined || value === '') return
		let day: string
		if (isDay(value)) day = value
		else {
			const time = toTime(value)
			if (time === undefined) return
			day = dayOf(time, zone)
		}
		if (from === '' || day < from) from = day
		if (to === '' || day > to) to = day
	})
	return from === '' ? null : { from, to }
}
