import { describe, expect, test } from 'vite-plus/test'
import { fillLine, fillValues } from './fill'

describe('fillLine', () => {
	test('one cell repeats, also a number and an empty cell', () => {
		expect(fillLine(['a'], 3)).toEqual(['a', 'a', 'a'])
		expect(fillLine([5], 2)).toEqual(['5', '5'])
		expect(fillLine([null], 2)).toEqual(['', ''])
		expect(fillLine([true], 1)).toEqual(['true'])
		expect(fillLine([5], 0)).toEqual([])
		expect(fillLine([], 3)).toEqual([])
	})

	test('several texts repeat in their order, and backwards the last one is next to the source', () => {
		expect(fillLine(['a', 'b', 'c'], 5)).toEqual(['a', 'b', 'c', 'a', 'b'])
		// Above `a b c`, from the nearest cell up: c, b, a, c, b.
		expect(fillLine(['a', 'b', 'c'], 5, true)).toEqual(['c', 'b', 'a', 'c', 'b'])
	})

	test('numbers with one step go on, up and down', () => {
		expect(fillLine([1, 2], 3)).toEqual(['3', '4', '5'])
		expect(fillLine([10, 20, 30], 2)).toEqual(['40', '50'])
		// A step below zero.
		expect(fillLine([5, 3], 4)).toEqual(['1', '-1', '-3', '-5'])
		// The same number twice has the step 0.
		expect(fillLine([7, 7], 2)).toEqual(['7', '7'])
	})

	test('backwards, a series goes on before its first number', () => {
		expect(fillLine([1, 2], 3, true)).toEqual(['0', '-1', '-2'])
		expect(fillLine([10, 7], 2, true)).toEqual(['13', '16'])
	})

	test('a step with decimals has no noise of floats', () => {
		expect(fillLine([0.1, 0.2], 3)).toEqual(['0.3', '0.4', '0.5'])
		expect(fillLine([1.1, 1.4], 2)).toEqual(['1.7', '2'])
		expect(fillLine([0.3, 0.2], 3)).toEqual(['0.1', '0', '-0.1'])
		expect(fillLine([0.25, 0.5], 2, true)).toEqual(['0', '-0.25'])
		// 0.1, 0.2, 0.3 is one step, though 0.3 - 0.2 is not 0.1 in floats.
		expect(fillLine([0.1, 0.2, 0.3], 1)).toEqual(['0.4'])
	})

	test('numbers without one step repeat, and so does a line of mixed kinds', () => {
		expect(fillLine([1, 2, 4], 4)).toEqual(['1', '2', '4', '1'])
		expect(fillLine([1, 'x'], 3)).toEqual(['1', 'x', '1'])
		expect(fillLine([1, null], 2)).toEqual(['1', ''])
		expect(fillLine([1, Number.NaN], 1)).toEqual(['1'])
		expect(fillLine(['1', '2'], 2)).toEqual(['1', '2'])
		expect(fillLine(['2026-01-01', 3], 2)).toEqual(['2026-01-01', '3'])
	})

	test('days go on over the end of a month, over a leap day, and backwards over a new year', () => {
		expect(fillLine(['2026-01-30', '2026-01-31'], 2)).toEqual(['2026-02-01', '2026-02-02'])
		expect(fillLine(['2024-02-27', '2024-02-28'], 2)).toEqual(['2024-02-29', '2024-03-01'])
		// 2026 is no leap year.
		expect(fillLine(['2026-02-27', '2026-02-28'], 1)).toEqual(['2026-03-01'])
		expect(fillLine(['2026-01-01', '2026-01-08'], 2)).toEqual(['2026-01-15', '2026-01-22'])
		expect(fillLine(['2026-01-02', '2026-01-03'], 3, true)).toEqual([
			'2026-01-01',
			'2025-12-31',
			'2025-12-30',
		])
		// A step back in time.
		expect(fillLine(['2026-03-02', '2026-03-01'], 2)).toEqual(['2026-02-28', '2026-02-27'])
	})

	test('days with unequal steps repeat, and so does a text that is no day of the calendar', () => {
		expect(fillLine(['2026-01-01', '2026-01-02', '2026-01-04'], 2)).toEqual([
			'2026-01-01',
			'2026-01-02',
		])
		expect(fillLine(['2026-02-30', '2026-02-31'], 1)).toEqual(['2026-02-30'])
	})

	test('fillValues keeps the kind of each value: a number is a number, and a date that repeats is a new object', () => {
		expect(fillValues([1, 2], 2)).toEqual([3, 4])
		expect(fillValues([0.3, 0.2, 0.1], 2)).toEqual([0, -0.1])
		expect(Object.is(fillValues([0.3, 0.2, 0.1], 1)[0], -0)).toBe(false)
		const list = ['x']
		expect(fillValues([list], 1)[0]).toBe(list)
		const day = new Date('2026-01-30T12:00:00Z')
		const [copy] = fillValues([day], 1)
		expect(copy).toEqual(day)
		expect(copy).not.toBe(day)
		expect(fillValues([null, 5], 3)).toEqual([null, 5, null])
	})

	test('dates with one step in time go on as ISO texts', () => {
		const first = new Date('2026-01-30T12:00:00Z')
		const second = new Date('2026-01-31T12:00:00Z')
		expect(fillLine([first, second], 2)).toEqual([
			'2026-02-01T12:00:00.000Z',
			'2026-02-02T12:00:00.000Z',
		])
		expect(fillLine([first, second], 1, true)).toEqual(['2026-01-29T12:00:00.000Z'])
	})
})
