import { describe, expect, test } from 'vite-plus/test'
import { fixedMetrics, measuredMetrics, rangeFor, windowSegments } from './metrics'

const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `r${index}` }))

describe('row metrics', () => {
	test('fixed heights: every answer follows from the one height', () => {
		const metrics = fixedMetrics(rows(100), 20)
		expect(metrics.total()).toBe(2000)
		expect(metrics.offset(10)).toBe(200)
		expect(metrics.offset(1000)).toBe(2000)
		expect(metrics.indexAt(0)).toBe(0)
		expect(metrics.indexAt(199)).toBe(9)
		expect(metrics.indexAt(200)).toBe(10)
		expect(metrics.indexAt(99999)).toBe(99)
		expect(metrics.indexAt(-5)).toBe(0)
		expect(metrics.measure('r3', 50)).toBe(0)
		expect(metrics.indexOf('r7')).toBe(7)
		expect(metrics.indexOf('nope')).toBe(-1)
	})

	test('measured heights: a row counts with the estimate until it is measured', () => {
		const known = new Map<string, number>()
		const metrics = measuredMetrics(rows(100), 20, known)
		expect(metrics.total()).toBe(2000)
		expect(metrics.measure('r2', 50)).toBe(30)
		expect(metrics.measure('r2', 50)).toBe(0)
		expect(metrics.offset(2)).toBe(40)
		expect(metrics.offset(3)).toBe(90)
		expect(metrics.total()).toBe(2030)
		expect(metrics.indexAt(89)).toBe(2)
		expect(metrics.indexAt(90)).toBe(3)
		expect(metrics.size(2)).toBe(50)
		// A change near the end is seen after a read of the whole list.
		expect(metrics.measure('r99', 10)).toBe(-10)
		expect(metrics.total()).toBe(2020)
		expect(metrics.indexAt(2019)).toBe(99)
		expect(metrics.measure('nope', 10)).toBe(0)
		expect(metrics.measure('r5', 0)).toBe(0)
		expect(metrics.mean()).toBe(30)
	})

	test('measured heights stay with their rows when the order changes', () => {
		const known = new Map<string, number>()
		measuredMetrics(rows(5), 20, known).measure('r4', 80)
		const reversed = measuredMetrics(rows(5).reverse(), 20, known)
		expect(reversed.size(0)).toBe(80)
		expect(reversed.offset(1)).toBe(80)
		expect(reversed.total()).toBe(160)
	})

	test('an empty list has no rows and no height', () => {
		const metrics = measuredMetrics([], 20, new Map())
		expect(metrics.total()).toBe(0)
		expect(metrics.indexAt(50)).toBe(0)
		expect(rangeFor(metrics, 0, 500, 3)).toEqual({ start: 0, end: 0 })
	})
})

describe('row range', () => {
	test('the range covers the visible part and the overscan, inside the list', () => {
		const metrics = fixedMetrics(rows(100), 20)
		expect(rangeFor(metrics, 0, 100, 2)).toEqual({ start: 0, end: 8 })
		expect(rangeFor(metrics, 400, 500, 2)).toEqual({ start: 18, end: 28 })
		expect(rangeFor(metrics, 1950, 2500, 2)).toEqual({ start: 95, end: 100 })
		expect(rangeFor(metrics, -300, -100, 0)).toEqual({ start: 0, end: 1 })
	})
})

describe('window segments', () => {
	const shape = (range: { start: number; end: number }, keep: number[], count: number) =>
		windowSegments(range, keep, count).map((segment) =>
			segment.kind === 'rows'
				? `rows ${segment.from}-${segment.to}`
				: `${segment.key} ${segment.from}-${segment.to}`,
		)

	test('a first and a last gap are always there', () => {
		expect(shape({ start: 0, end: 10 }, [], 10)).toEqual(['gap-0 0-0', 'rows 0-10', 'gap-1 10-10'])
		expect(shape({ start: 20, end: 30 }, [], 100)).toEqual([
			'gap-0 0-20',
			'rows 20-30',
			'gap-1 30-100',
		])
		expect(shape({ start: 0, end: 0 }, [], 0)).toEqual(['gap-0 0-0', 'gap-1 0-0'])
	})

	test('a kept row outside the range is rendered, with a gap on each side', () => {
		expect(shape({ start: 20, end: 30 }, [5], 100)).toEqual([
			'gap-0 0-5',
			'rows 5-6',
			'gap-1 6-20',
			'rows 20-30',
			'gap-2 30-100',
		])
		expect(shape({ start: 20, end: 30 }, [50], 100)).toEqual([
			'gap-0 0-20',
			'rows 20-30',
			'gap-1 30-50',
			'rows 50-51',
			'gap-2 51-100',
		])
	})

	test('a kept row inside or next to the range adds no gap, and a wrong index is ignored', () => {
		expect(shape({ start: 20, end: 30 }, [25, 19, 30, -1, 500], 100)).toEqual([
			'gap-0 0-19',
			'rows 19-31',
			'gap-1 31-100',
		])
		expect(shape({ start: 20, end: 30 }, [0], 100)).toEqual([
			'gap-0 0-0',
			'rows 0-1',
			'gap-1 1-20',
			'rows 20-30',
			'gap-2 30-100',
		])
	})
})
