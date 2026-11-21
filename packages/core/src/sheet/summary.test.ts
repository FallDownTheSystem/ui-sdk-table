import { expect, test } from 'vite-plus/test'
import { aggregates } from '../rows/aggregate'
import { meanDecimals, summarize } from './summary'

test('summarize counts values and numbers apart, and leaves out what is no number', () => {
	const values = [4, '7', null, undefined, '', Number.NaN, true, new Date(0), -1.5, 0]
	expect(summarize(values)).toEqual({
		// A text, a boolean, a date, NaN and the three numbers hold a value; the three empty cells do not.
		count: 7,
		numbers: 3,
		sum: 2.5,
		mean: 2.5 / 3,
		min: -1.5,
		max: 4,
	})
})

test('summarize of no numbers has a sum of 0 and no mean, smallest or largest value', () => {
	expect(summarize(['a', null])).toEqual({
		count: 1,
		numbers: 0,
		sum: 0,
		mean: undefined,
		min: undefined,
		max: undefined,
	})
	expect(summarize([])).toMatchObject({ count: 0, numbers: 0, sum: 0 })
})

test('summarize answers as the functions of the footer do, for the same values', () => {
	const values = [3, 9, null, 'x', 1, Number.NaN]
	const summary = summarize(values)
	expect(summary.sum).toBe(aggregates.sum(values))
	expect(summary.mean).toBe(aggregates.mean(values))
	expect(summary.count).toBe(aggregates.count(values))
	expect(summary.min).toBe(aggregates.min(values.filter((value) => typeof value === 'number')))
})

test('meanDecimals gives two decimals more than the ends of the values have, and six at most', () => {
	expect(meanDecimals(8200, 101_500)).toBe(2)
	expect(meanDecimals(0.2, 90)).toBe(3)
	expect(meanDecimals(-3.25, 4)).toBe(4)
	expect(meanDecimals(0.00001, 1)).toBe(6)
	// A sum of floats as a value has more digits than any cell shows.
	expect(meanDecimals(0.1 + 0.2, 1)).toBe(6)
	expect(meanDecimals(undefined, undefined)).toBe(2)
})
