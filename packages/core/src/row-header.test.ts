import { describe, expect, test } from 'vite-plus/test'
import { sheetTable } from './sheet/harness'

// With the column of row numbers, grid column 0 is the number and the
// columns of the data are 1 to 4: name, kind, price, stock.

const press = (el: Element, init: PointerEventInit = {}) => {
	const event = new PointerEvent('pointerdown', {
		bubbles: true,
		cancelable: true,
		button: 0,
		pointerId: 1,
		...init,
	})
	el.dispatchEvent(event)
	return event
}

describe('a column of row numbers', () => {
	test('its cells are the row headers, with the number of the row as their name', () => {
		const { view, cell } = sheetTable({ sheet: true }, { numbers: true })
		try {
			const number = cell('b', '#')
			expect(number.getAttribute('role')).toBe('rowheader')
			expect(number.getAttribute('aria-label')).toBe('Row 2')
			expect(number.getAttribute('data-row-header')).toBe('')
			expect(number.getAttribute('data-lead')).toBe('')
			// A number is no value: it says neither that it can be edited nor that it cannot.
			expect(number.hasAttribute('aria-readonly')).toBe(false)
			expect(number.hasAttribute('data-editable')).toBe(false)
			expect(number.hasAttribute('aria-selected')).toBe(false)
			// The header of the column is a column header, and a cell of the data is a grid cell.
			expect(cell('h', '#').getAttribute('role')).toBe('columnheader')
			expect(cell('h', '#').hasAttribute('data-row-header')).toBe(false)
			expect(cell('b', 'name').getAttribute('role')).toBe('gridcell')
			expect(view.api.rowNumber('d')).toBe(4)
			expect(view.api.rowNumber('nobody')).toBeUndefined()
		} finally {
			view.unmount()
		}
	})

	test('the number counts the rows of the pages before, and follows a sort', () => {
		const { view } = sheetTable(
			{ sheet: true, defaultPage: { page: 2, pageSize: 3 } },
			{ numbers: true },
		)
		try {
			// Page 2 of pages of three rows holds the fourth row.
			expect(view.api.rowNumber('d')).toBe(4)
			expect(view.api.rowNumber('a')).toBeUndefined()
			view.api.setPage(1)
			view.api.sortBy('price', 'asc')
			// The number is a place: the cheapest row is row 1 now.
			expect(['c', 'b', 'd'].map((id) => view.api.rowNumber(id))).toEqual([1, 2, 3])
		} finally {
			view.unmount()
		}
	})

	test('no range holds it: select all, a copy and a clear leave the numbers out', async () => {
		const { view, told, cell, press: key } = sheetTable({ sheet: true }, { numbers: true })
		try {
			view.api.selectAllCells()
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 1 }, end: { row: 4, col: 4 } })
			expect(view.api.copyCells().split('\n')[0]).toBe('Bolt\tSteel\t2.5\t40')
			expect(view.api.getView().cellSelection).toMatchObject({
				from: { rowId: 'a', columnId: 'name' },
				columns: 4,
			})
			// The active cell went into the range, and not onto a number.
			expect(view.state.active).toEqual({ row: 1, col: 1 })

			// Control+A from a number does the same.
			view.api.clearCellSelection()
			cell('b', '#').focus()
			await view.settle()
			key(cell('b', '#'), 'a', { ctrlKey: true })
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 1 }, end: { row: 4, col: 4 } })

			// A number alone selects no cell: Delete on it changes nothing.
			view.api.clearCellSelection()
			key(cell('b', '#'), 'Delete')
			expect(told()).toEqual([])
			expect(view.api.copyCells()).toBe('')
			expect(view.api.getView().cellSelection).toBeNull()
			// And a character on it opens no editor.
			key(cell('b', '#'), '7')
			expect(view.state.editing).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('a press on a number selects the cells of its row, and Shift takes the rows from the active one', () => {
		const { view, cell } = sheetTable({ sheet: true }, { numbers: true })
		try {
			press(cell('b', '#'))
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 1 }, end: { row: 2, col: 4 } })
			// Focus is on the number, so the next key starts from this row.
			expect(view.state.active).toEqual({ row: 2, col: 0 })
			expect(cell('b', 'name').getAttribute('aria-selected')).toBe('true')
			expect(cell('a', 'name').getAttribute('aria-selected')).toBe('false')
			document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }))

			press(cell('d', '#'), { shiftKey: true })
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 1 }, end: { row: 4, col: 4 } })
			expect(view.api.getView().cellSelection).toMatchObject({
				from: { rowId: 'b', columnId: 'name' },
				to: { rowId: 'd', columnId: 'stock' },
				rows: 3,
				columns: 4,
			})
		} finally {
			view.unmount()
		}
	})

	test('Shift with an arrow on a number takes whole rows, and Delete empties them', async () => {
		const { view, told, cell, press: key } = sheetTable({ sheet: true }, { numbers: true })
		try {
			cell('a', '#').focus()
			await view.settle()
			key(cell('a', '#'), 'ArrowDown', { shiftKey: true })
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 1 }, end: { row: 2, col: 4 } })
			key(document.activeElement ?? cell('a', '#'), 'Delete')
			// The kind cannot be edited, and the numbers are no cells of the range.
			expect(told()[0]?.map(([row, column]) => `${String(row)}.${String(column)}`)).toEqual([
				'a.name',
				'a.price',
				'a.stock',
				'b.name',
				'b.price',
				'b.stock',
			])
		} finally {
			view.unmount()
		}
	})

	test('a range from code cannot name the column, and the error lists the columns that it can', () => {
		const { view } = sheetTable({ sheet: true }, { numbers: true })
		try {
			expect(() => view.api.selectCellColumns('#')).toThrow(
				'Column "#" holds the numbers of the rows, and no range holds them. Columns with cells to select: name, kind, price, stock.',
			)
			view.api.selectCellColumns('price', 'stock')
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 3 }, end: { row: 4, col: 4 } })
			view.api.selectCellRows('c')
			expect(view.state.cellRange).toEqual({ anchor: { row: 3, col: 1 }, end: { row: 3, col: 4 } })
			// A range that the owner starts on a number is cut to the cells of the data.
			view.api.selectCells({ rowId: 'a', columnId: '#' }, { rowId: 'b', columnId: 'kind' })
			expect(view.api.getView().cellSelection).toMatchObject({
				from: { rowId: 'a', columnId: 'name' },
				to: { rowId: 'b', columnId: 'stock' },
			})
		} finally {
			view.unmount()
		}
	})

	test('an export leaves the numbers out unless the column asks for them', () => {
		const { view } = sheetTable({ sheet: true }, { numbers: true })
		try {
			expect(view.api.exportData().columns.map((column) => column.id)).toEqual([
				'name',
				'kind',
				'price',
				'stock',
			])
		} finally {
			view.unmount()
		}
	})
})
