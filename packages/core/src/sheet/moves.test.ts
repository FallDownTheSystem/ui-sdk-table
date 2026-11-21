import { describe, expect, test } from 'vite-plus/test'
import { moveFrom, type Move } from './moves'

// A grid with one header row: the body is the rows 1 to 4, with 3 columns.
const limits = { first: 1, last: 4, cols: 3 }
const at = (row: number, col: number) => ({ row, col })

describe('the cell after a cell', () => {
	test('without a range, forward and back go on in the next row and stop at the last cell', () => {
		expect(moveFrom(at(1, 0), 'forward', limits)).toEqual(at(1, 1))
		expect(moveFrom(at(1, 2), 'forward', limits)).toEqual(at(2, 0))
		expect(moveFrom(at(4, 2), 'forward', limits)).toEqual(at(4, 2))
		expect(moveFrom(at(2, 0), 'back', limits)).toEqual(at(1, 2))
		expect(moveFrom(at(1, 0), 'back', limits)).toEqual(at(1, 0))
	})

	test('without a range, down and up stay in their column and stop at the edge', () => {
		expect(moveFrom(at(1, 1), 'down', limits)).toEqual(at(2, 1))
		expect(moveFrom(at(4, 1), 'down', limits)).toEqual(at(4, 1))
		expect(moveFrom(at(2, 2), 'up', limits)).toEqual(at(1, 2))
		expect(moveFrom(at(1, 2), 'up', limits)).toEqual(at(1, 2))
	})

	test('inside a range, each move walks the range and starts again at its other end', () => {
		const bounds = { top: 2, bottom: 3, left: 1, right: 2 }
		const walk = (move: Move, from = at(2, 1)) => {
			const seen = [from]
			for (let step = 0; step < 4; step++)
				seen.push(moveFrom(seen.at(-1) ?? from, move, limits, bounds))
			return seen.map((cell) => `${cell.row}:${cell.col}`)
		}
		expect(walk('forward')).toEqual(['2:1', '2:2', '3:1', '3:2', '2:1'])
		expect(walk('back')).toEqual(['2:1', '3:2', '3:1', '2:2', '2:1'])
		expect(walk('down')).toEqual(['2:1', '3:1', '2:2', '3:2', '2:1'])
		expect(walk('up')).toEqual(['2:1', '3:2', '2:2', '3:1', '2:1'])
	})

	test('a range that does not hold the cell is no range for it', () => {
		const bounds = { top: 2, bottom: 3, left: 1, right: 2 }
		expect(moveFrom(at(1, 0), 'down', limits, bounds)).toEqual(at(2, 0))
		expect(moveFrom(at(4, 2), 'forward', limits, bounds)).toEqual(at(4, 2))
	})

	test('a row that holds no cell, such as a group row, is passed over', () => {
		const holds = (cell: { row: number }) => cell.row !== 2
		expect(moveFrom(at(1, 1), 'down', limits, undefined, holds)).toEqual(at(3, 1))
		expect(moveFrom(at(3, 1), 'up', limits, undefined, holds)).toEqual(at(1, 1))
		expect(moveFrom(at(1, 2), 'forward', limits, undefined, holds)).toEqual(at(3, 0))
		expect(moveFrom(at(3, 0), 'back', limits, undefined, holds)).toEqual(at(1, 2))
		// In a range too, and at its end the walk starts again.
		const bounds = { top: 1, bottom: 3, left: 0, right: 0 }
		expect(moveFrom(at(1, 0), 'down', limits, bounds, holds)).toEqual(at(3, 0))
		expect(moveFrom(at(3, 0), 'down', limits, bounds, holds)).toEqual(at(1, 0))
		// When only a group row is left below, the move stays.
		const last = (cell: { row: number }) => cell.row !== 4
		expect(moveFrom(at(3, 1), 'down', limits, undefined, last)).toEqual(at(3, 1))
	})

	test('one row, one column, one cell, and a body without rows', () => {
		const one = { top: 2, bottom: 2, left: 1, right: 1 }
		expect(moveFrom(at(2, 1), 'forward', limits, one)).toEqual(at(2, 1))
		expect(moveFrom(at(2, 1), 'down', limits, one)).toEqual(at(2, 1))
		const row = { top: 2, bottom: 2, left: 0, right: 2 }
		expect(moveFrom(at(2, 2), 'forward', limits, row)).toEqual(at(2, 0))
		// Down in one row goes on to the next column, as Enter does in a sheet.
		expect(moveFrom(at(2, 0), 'down', limits, row)).toEqual(at(2, 1))
		const column = { top: 1, bottom: 4, left: 1, right: 1 }
		expect(moveFrom(at(4, 1), 'forward', limits, column)).toEqual(at(1, 1))
		expect(moveFrom(at(1, 0), 'down', { first: 1, last: 0, cols: 3 })).toEqual(at(1, 0))
	})
})
