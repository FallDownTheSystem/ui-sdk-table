import { decimalsOf } from '@ui-sdk/core/number'
import { aggregates } from '../rows/aggregate'

/** What the selected cells add up to, for a status bar. */
export type RangeSummary = {
	/** How many cells of data rows the selection holds. */
	cells: number
	/** How many of them hold a value. */
	count: number
	/** How many hold a number. The four values after it are of these cells. */
	numbers: number
	sum: number
	mean: number | undefined
	min: number | undefined
	max: number | undefined
	/**
	 * Each value as text: in the format of the column when the selection is
	 * inside one column that shows numbers, else as a plain number of the
	 * locale, where the mean has the decimals of `meanDecimals`. An empty text
	 * for a value that does not exist.
	 */
	texts: { sum: string; mean: string; min: string; max: string }
}

const number = (value: unknown): number | undefined =>
	typeof value === 'number' ? value : undefined

/**
 * Counts a list of cell values. It asks the functions that count the footer
 * and the group rows (`aggregates`), so a sum has one rule in the library:
 * numbers only, `NaN` left out, and an empty cell is no zero. The smallest
 * and the largest value are of the cells that hold a number.
 */
export function summarize(values: readonly unknown[]): Omit<RangeSummary, 'cells' | 'texts'> {
	const numeric = values.filter(
		(value): value is number => typeof value === 'number' && !Number.isNaN(value),
	)
	return {
		count: number(aggregates.count(values)) ?? 0,
		numbers: numeric.length,
		sum: number(aggregates.sum(numeric)) ?? 0,
		mean: number(aggregates.mean(numeric)),
		min: number(aggregates.min(numeric)),
		max: number(aggregates.max(numeric)),
	}
}

/**
 * How many decimals a plain mean shows: two more than the smallest and the
 * largest value have, and six at most. A division seldom ends, and a mean of
 * whole amounts with six decimals says more than the values know.
 */
export function meanDecimals(min: number | undefined, max: number | undefined): number {
	return Math.min(6, Math.max(decimalsOf(min ?? 0), decimalsOf(max ?? 0)) + 2)
}
