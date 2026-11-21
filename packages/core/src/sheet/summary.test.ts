import { expect, test } from 'vite-plus/test'
import { aggregates } from '../rows/aggregate'
import { summarize } from './summary'

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
