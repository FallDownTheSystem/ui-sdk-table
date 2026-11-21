import { DEFAULT_LOCALE, isNumericFormat } from '../format/format'
import { numberPlan, type NumericFormatName } from '../format/number'
import type { FormatOptionsByName } from '../format/types'
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

// A step below this is noise of binary fractions, not a digit that a cell shows.
const SMALLEST_STEP = 6

/** `1`, `0.1`, `0.01` and so on, as exact as a number can hold them. */
const stepOf = (digits: number) => Number(`1e-${Math.max(0, Math.min(SMALLEST_STEP, digits))}`)

/**
 * The step of a slider over the numbers of a column: the smallest change of
 * a value that changes the text of its cell. A column with a number format
 * says it: two digits after the point give 0.01, and a percentage of
 * fractions with no digit gives 0.01 too, because 0.01 shows as 1 %. A column
 * without a number format shows its values as they are, so the step follows
 * the digits that its rows hold.
 */
export function numberStep<Row>(
	rows: readonly DataRow<Row>[],
	column: ColumnDef<Row>,
	locale?: string,
): number {
	if (column.format && isNumericFormat(column.format)) {
		try {
			const name = column.format as NumericFormatName
			const options = (column.formatOptions ?? {}) as FormatOptionsByName[NumericFormatName]
			const plan = numberPlan(name, options, options.locale ?? locale ?? DEFAULT_LOCALE)
			const resolved = plan.intl.resolvedOptions()
			// What the format does to a value before its digits are cut: a multiplier,
			// and the hundred of a percent sign.
			const factor = Math.abs(plan.scale(1)) * (resolved.style === 'percent' ? 100 : 1)
			const step = stepOf(resolved.maximumFractionDigits ?? 0) / factor
			if (Number.isFinite(step) && step > 0) return Number(step.toPrecision(12))
		} catch {
			// Options that the format refuses show no number, and the rows say the step.
		}
	}
	let digits = 0
	walkRows(rows, (node) => {
		const value = cellValue(node.row, column)
		if (typeof value !== 'number' || Number.isInteger(value) || !Number.isFinite(value)) return
		const text = String(value)
		const point = text.indexOf('.')
		// A number in the form 1e-7 is smaller than the smallest step.
		const here = point < 0 || text.includes('e') ? SMALLEST_STEP : text.length - point - 1
		if (here > digits) digits = here
	})
	return stepOf(digits)
}

/**
 * The ends of a slider for a range of numbers: `min` goes down and `max` goes
 * up to the next step, so every value of the range is between them and each
 * end is a place where the thumb can stop.
 *
 * The step of a range is the smallest change that a cell shows, such as 0.01
 * for a currency, and that is too fine for a thumb over a wide range. With
 * `steps`, the step grows to the smallest of 1, 2 or 5 times a power of ten
 * of it that gives that many stops at most, so 100 gives about a hundred
 * stops. It is never finer than the step of the range, and always a multiple
 * of it, so each stop is a value that a cell can show.
 */
export function sliderBounds(
	range: { min: number; max: number; step: number },
	options: { steps?: number } = {},
): {
	min: number
	max: number
	step: number
} {
	let { step } = range
	if (!(step > 0) || !Number.isFinite(step)) return { ...range }
	const most = options.steps
	const span = range.max - range.min
	if (most !== undefined && most >= 1 && Number.isFinite(span)) {
		const fine = step
		search: for (let power = 1; ; power *= 10) {
			for (const factor of [1, 2, 5]) {
				step = Number((fine * factor * power).toPrecision(12))
				if (span / step <= most) break search
			}
		}
	}
	// Without the cut, 0.3 / 0.1 is 2.9999999999999996, and the end would be one step off.
	const steps = (value: number) => Number((value / step).toPrecision(12))
	const at = (count: number) => Number((count * step).toPrecision(12))
	return { min: at(Math.floor(steps(range.min))), max: at(Math.ceil(steps(range.max))), step }
}
