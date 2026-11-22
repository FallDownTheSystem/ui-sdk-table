import { expect, test } from 'vite-plus/test'
import { sheetTable } from '../sheet/harness'

// The pick mode with the arrow keys. The header is grid row 0, the rows a to d
// are 1 to 4, and the columns name, kind, price and stock are 0 to 3.

test("an arrow in the table's own editor picks the next cell, more arrows move it, Shift grows a range, Control goes to the edge, and a typed character ends the pick", () => {
	const { view, cell, field, press } = sheetTable({
		editable: true,
		cellSelection: true,
		pickCells: true,
	})
	try {
		cell('b', 'stock').focus()
		view.api.startEdit('b', 'stock')
		const input = field()
		input.focus()
		const active = view.state.active
		const picked = () => view.state.pickedCells

		expect(press(input, 'ArrowDown').defaultPrevented).toBe(true)
		expect(picked()).toEqual({
			anchor: { row: 3, col: 3 },
			end: { row: 3, col: 3 },
			columns: false,
		})
		press(input, 'ArrowDown')
		expect(picked()?.end).toEqual({ row: 4, col: 3 })
		// The last row stops the pick.
		press(input, 'ArrowDown')
		expect(picked()?.end).toEqual({ row: 4, col: 3 })
		press(input, 'ArrowLeft', { shiftKey: true })
		expect(picked()).toEqual({
			anchor: { row: 4, col: 3 },
			end: { row: 4, col: 2 },
			columns: false,
		})
		press(input, 'ArrowUp', { ctrlKey: true })
		expect(picked()).toEqual({
			anchor: { row: 1, col: 2 },
			end: { row: 1, col: 2 },
			columns: false,
		})

		// A typed character ends the pick; the next arrow starts from the edited cell again.
		expect(press(input, '+').defaultPrevented).toBe(false)
		expect(picked()).toBeNull()
		press(input, 'ArrowLeft')
		expect(picked()?.end).toEqual({ row: 2, col: 2 })

		expect(view.state.editing).toBe(JSON.stringify(['b', 'stock']))
		expect(view.state.active).toEqual(active)
		expect(view.state.cellRange).toBeNull()
		expect(document.activeElement).toBe(input)
	} finally {
		view.unmount()
	}
})

test('`movePick` starts from the active cell without an editor, starts anew with `start`, and names the valid keys', () => {
	const { view, cell } = sheetTable({ cellSelection: true, pickCells: true })
	try {
		cell('a', 'name').focus()
		view.api.grid.focus({ row: 1, col: 0 })
		expect(view.api.movePick('ArrowRight')?.end).toEqual({ row: 1, col: 1 })
		expect(view.api.movePick('ArrowDown', { extend: true })).toEqual({
			anchor: { row: 1, col: 1 },
			end: { row: 2, col: 1 },
			columns: false,
		})
		expect(view.api.movePick('ArrowDown', { start: true })?.anchor).toEqual({ row: 2, col: 0 })
		expect(view.api.movePick('ArrowRight', { edge: true })?.end).toEqual({ row: 2, col: 3 })
		expect(() => view.api.movePick('Down' as 'ArrowDown')).toThrow(
			'No key "Down" to move a pick. Keys: ArrowUp, ArrowDown, ArrowLeft, ArrowRight.',
		)
		expect(view.state.active).toEqual({ row: 1, col: 0 })
	} finally {
		view.unmount()
	}
})

test('a first move with no cell in its direction picks nothing, and a later move at the edge keeps the pick', () => {
	const { view, cell, field, press, reports } = sheetTable({
		editable: true,
		cellSelection: true,
		pickCells: true,
	})
	try {
		cell('a', 'stock').focus()
		view.api.startEdit('a', 'stock')
		const input = field()
		input.focus()
		// The first row and the last column: Up and Right have no cell, and never pick the edited cell.
		expect(press(input, 'ArrowUp').defaultPrevented).toBe(true)
		expect(view.state.pickedCells).toBeNull()
		expect(view.api.movePick('ArrowRight')).toBeNull()
		expect(view.state.pickedCells).toBeNull()
		press(input, 'ArrowDown')
		const picked = view.state.pickedCells
		expect(picked?.end).toEqual({ row: 2, col: 3 })
		expect(view.api.movePick('ArrowRight')).toBe(picked)
		expect(view.state.pickedCells).toBe(picked)
		expect(reports).toEqual([])
	} finally {
		view.unmount()
	}
})

test('in a right-to-left table the Left arrow picks the next column and Control with it the last one', () => {
	const { view, cell, field, press } = sheetTable({
		editable: true,
		cellSelection: true,
		pickCells: true,
	})
	try {
		view.root.style.direction = 'rtl'
		cell('b', 'price').focus()
		view.api.startEdit('b', 'price')
		const input = field()
		input.focus()
		press(input, 'ArrowLeft')
		expect(view.state.pickedCells?.end).toEqual({ row: 2, col: 3 })
		press(input, 'ArrowRight')
		press(input, 'ArrowRight')
		expect(view.state.pickedCells?.end).toEqual({ row: 2, col: 1 })
		press(input, 'ArrowLeft', { ctrlKey: true })
		expect(view.state.pickedCells?.end).toEqual({ row: 2, col: 3 })
	} finally {
		view.unmount()
	}
})
