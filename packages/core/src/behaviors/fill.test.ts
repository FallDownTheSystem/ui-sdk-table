import { describe, expect, test } from 'vite-plus/test'
import { byFillDraft, fillTarget, type FillDraft } from './fill'

const limits = { top: 1, bottom: 20, left: 1, right: 6 }
const source = { top: 5, bottom: 6, left: 2, right: 3 }

describe('fillTarget', () => {
	test('a cell inside the source fills nothing', () => {
		expect(fillTarget(source, { row: 5, col: 3 }, limits)).toBeUndefined()
		expect(fillTarget(source, { row: 6, col: 2 }, limits)).toBeUndefined()
	})

	test('a cell under, over, after and before the source fills along that side, as wide as the source', () => {
		expect(fillTarget(source, { row: 9, col: 2 }, limits)).toEqual({
			top: 7,
			bottom: 9,
			left: 2,
			right: 3,
		})
		expect(fillTarget(source, { row: 2, col: 3 }, limits)).toEqual({
			top: 2,
			bottom: 4,
			left: 2,
			right: 3,
		})
		expect(fillTarget(source, { row: 5, col: 6 }, limits)).toEqual({
			top: 5,
			bottom: 6,
			left: 4,
			right: 6,
		})
		expect(fillTarget(source, { row: 6, col: 1 }, limits)).toEqual({
			top: 5,
			bottom: 6,
			left: 1,
			right: 1,
		})
	})

	test('off both axes, the axis wins that the pointer went further on, and rows win a tie', () => {
		// Three rows down and one column on: down.
		expect(fillTarget(source, { row: 9, col: 4 }, limits)?.bottom).toBe(9)
		expect(fillTarget(source, { row: 9, col: 4 }, limits)?.right).toBe(3)
		// One row up and two columns back... the grid has one column before the source, so rows win the tie.
		expect(fillTarget(source, { row: 4, col: 1 }, limits)).toEqual({
			top: 4,
			bottom: 4,
			left: 2,
			right: 3,
		})
		// One row down and three columns on: forward.
		expect(fillTarget(source, { row: 7, col: 6 }, limits)).toEqual({
			top: 5,
			bottom: 6,
			left: 4,
			right: 6,
		})
	})

	test('a cell outside the limits ends the fill at their edge', () => {
		expect(fillTarget(source, { row: 40, col: 2 }, limits)?.bottom).toBe(20)
		expect(fillTarget(source, { row: 0, col: 2 }, limits)?.top).toBe(1)
		// A column of row numbers is outside the limits: a fill back ends after it.
		expect(fillTarget(source, { row: 5, col: 0 }, limits)?.left).toBe(1)
	})

	test('a direction keeps the fill on one axis', () => {
		expect(fillTarget(source, { row: 5, col: 6 }, limits, 'vertical')).toBeUndefined()
		expect(fillTarget(source, { row: 9, col: 6 }, limits, 'vertical')?.bottom).toBe(9)
		expect(fillTarget(source, { row: 9, col: 2 }, limits, 'horizontal')).toBeUndefined()
		expect(fillTarget(source, { row: 9, col: 5 }, limits, 'horizontal')?.right).toBe(5)
	})
})

describe('byFillDraft', () => {
	const draft = (top: number, bottom: number, left = 2, right = 2): FillDraft => ({
		source,
		target: { top, bottom, left, right },
	})
	const woken = (previous: FillDraft | null, next: FillDraft | null) => {
		const rows: string[] = []
		byFillDraft.moved(previous, next, (name) => rows.push(name))
		return [...new Set(rows)].toSorted((a, b) => Number(a) - Number(b))
	}

	test('a new draft and a draft that ends wake every row of the target', () => {
		expect(woken(null, draft(7, 9))).toEqual(['7', '8', '9'])
		expect(woken(draft(7, 9), null)).toEqual(['7', '8', '9'])
		expect(woken(null, null)).toEqual([])
	})

	test('a target that grows by a row wakes that row and the row that was the edge, however long it is', () => {
		expect(woken(draft(7, 5_000), draft(7, 5_001))).toEqual(['7', '5000', '5001'])
		// Upward: the top moves, and the bottom row keeps its mark but is named with it.
		expect(woken(draft(3, 4), draft(1, 4))).toEqual(['1', '2', '3', '4'])
	})

	test('other columns wake the rows of both targets', () => {
		expect(woken(draft(5, 6, 4, 4), draft(5, 6, 4, 5))).toEqual(['5', '6'])
	})
})
