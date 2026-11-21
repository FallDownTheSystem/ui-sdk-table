import { describe, expect, test } from 'vite-plus/test'
import { layoutColumns } from './columns/layout'
import { lettersByColumn } from './sheet/chrome'
import { sheetTable } from './sheet/harness'

// With `columnLetters`, grid row 0 is the row of letters, row 1 the header
// row, and rows 2 to 5 the rows a to d. With the column of row numbers, grid
// column 0 is the number and the columns of the data are 1 to 4: name, kind,
// price, stock.

const press = (el: Element, init: PointerEventInit = {}) => {
	const event = new PointerEvent('pointerdown', {
		bubbles: true,
		cancelable: true,
		button: 0,
		pointerId: 1,
		...init,
	})
	el.dispatchEvent(event)
	document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }))
	return event
}

describe('the letter of a column', () => {
	const letters = (...args: Parameters<typeof layoutColumns>) =>
		Object.fromEntries(lettersByColumn(layoutColumns(...args)))

	test('is the place of the column among the columns in view, without the columns that lead', () => {
		const columns = [
			{ id: 'check', lead: true },
			{ id: '#', rowHeader: true, lead: true },
			{ id: 'a' },
			{ id: 'group', columns: [{ id: 'b' }, { id: 'c' }] },
			{ id: 'd' },
		]
		expect(letters(columns)).toEqual({ a: 'A', b: 'B', c: 'C', d: 'D' })
		// A hidden column has no letter, and the columns after it take its place.
		expect(letters(columns, { visibility: { b: false } })).toEqual({ a: 'A', c: 'B', d: 'C' })
		// A moved column takes the letter of its new place, and so does a pinned one.
		expect(letters(columns, { order: ['d', 'a'] })).toEqual({ d: 'A', a: 'B', b: 'C', c: 'D' })
		expect(letters(columns, { pinning: { end: ['a'] } })).toEqual({
			b: 'A',
			c: 'B',
			d: 'C',
			a: 'D',
		})
	})

	test('goes on with two letters after Z', () => {
		const columns = Array.from({ length: 28 }, (_unused, index) => ({ id: `c${index}` }))
		expect(Object.values(letters(columns)).slice(24)).toEqual(['Y', 'Z', 'AA', 'AB'])
	})
})

describe('a table with the row of letters', () => {
	test('the letters are the first row of the grid, and the header and the body count after it', () => {
		const { view, cell } = sheetTable({ sheet: true, columnLetters: true }, { numbers: true })
		try {
			expect(view.root.getAttribute('aria-rowcount')).toBe('6')
			expect(view.api.headerRowCount()).toBe(2)
			expect(view.api.headerAt(1, 2)?.column.id).toBe('kind')
			expect(view.api.headerAt(0, 2)).toBeUndefined()
			const price = cell('l', 'price')
			expect(price.getAttribute('role')).toBe('columnheader')
			expect(price.getAttribute('data-kind')).toBe('letter')
			expect(price.getAttribute('aria-colindex')).toBe('4')
			expect(view.api.letterOf('price')).toBe('C')
			// The cell above the numbers is the corner, which has a name and no letter.
			const corner = cell('l', '#')
			expect(corner.getAttribute('aria-label')).toBe('All cells')
			expect(corner.hasAttribute('data-corner')).toBe(true)
			expect(corner.hasAttribute('data-lead')).toBe(true)
			expect(view.api.letterOf('#')).toBeUndefined()
			// The table can be entered on the corner.
			expect(corner.getAttribute('tabindex')).toBe('0')
		} finally {
			view.unmount()
		}
	})

	test('a press on a letter selects the cells of its column, and Shift the columns from the active cell', () => {
		const { view, cell } = sheetTable({ sheet: true, columnLetters: true }, { numbers: true })
		try {
			press(cell('l', 'price'))
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 3 }, end: { row: 5, col: 3 } })
			expect(view.state.active).toEqual({ row: 0, col: 3 })
			expect(cell('l', 'price').hasAttribute('data-selected')).toBe(true)
			expect(cell('l', 'stock').hasAttribute('data-selected')).toBe(false)
			expect(view.api.copyCells()).toBe('2.5\n0.5\n0.2\n1.5')

			press(cell('l', 'name'), { shiftKey: true })
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 3 }, end: { row: 5, col: 1 } })
			expect(view.api.getView().cellSelection).toMatchObject({
				from: { rowId: 'a', columnId: 'name' },
				to: { rowId: 'd', columnId: 'price' },
				columns: 3,
			})
			for (const id of ['name', 'kind', 'price']) {
				expect([id, cell('l', id).hasAttribute('data-selected')]).toEqual([id, true])
			}
			// A range of some rows does not mark the letter: only a whole column does.
			view.api.selectCells({ rowId: 'a', columnId: 'stock' }, { rowId: 'b', columnId: 'stock' })
			expect(cell('l', 'stock').hasAttribute('data-selected')).toBe(false)
		} finally {
			view.unmount()
		}
	})

	test('the corner selects every cell with a letter, and the export holds no letter', () => {
		const { view, cell } = sheetTable({ sheet: true, columnLetters: true }, { numbers: true })
		try {
			press(cell('l', '#'))
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 1 }, end: { row: 5, col: 4 } })
			expect(view.api.copyCells().split('\n')[0]).toBe('Bolt\tSteel\t2.5\t40')
			const data = view.api.exportData()
			expect(data.columns.map((column) => column.header)).toEqual([
				'Name',
				'Kind',
				'Price',
				'Stock',
			])
			expect(data.rows).toHaveLength(4)
		} finally {
			view.unmount()
		}
	})

	test('the corner leaves a column of checkboxes out, and a letter cell of such a column selects nothing', () => {
		const { view, cell } = sheetTable(
			{
				sheet: true,
				columnLetters: true,
				columns: [
					{ id: 'pick', header: '', lead: true },
					{ id: 'name', header: 'Name', value: (row: { id: string }) => row.id },
					{ id: 'kind', header: 'Kind', value: () => 'Steel' },
				],
			},
			{},
		)
		try {
			expect(view.api.isCorner(0)).toBe(true)
			press(cell('l', 'pick'))
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 1 }, end: { row: 5, col: 2 } })
			expect(view.api.copyCells().split('\n')[0]).toBe('a\tSteel')
		} finally {
			view.unmount()
		}
	})

	test('the keys on a letter: Space selects the column, Shift with an arrow the next one, Escape drops it, Delete empties it', async () => {
		const {
			view,
			cell,
			press: key,
			told,
		} = sheetTable({ sheet: true, columnLetters: true }, { numbers: true })
		try {
			cell('l', 'name').focus()
			await view.settle()
			expect(key(cell('l', 'name'), ' ').defaultPrevented).toBe(true)
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 1 }, end: { row: 5, col: 1 } })
			key(cell('l', 'name'), 'ArrowRight', { shiftKey: true })
			key(cell('l', 'name'), 'ArrowRight', { shiftKey: true })
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 1 }, end: { row: 5, col: 3 } })
			// Back over the column of numbers it goes no further than the first letter.
			for (let step = 0; step < 4; step++) key(cell('l', 'name'), 'ArrowLeft', { shiftKey: true })
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 1 }, end: { row: 5, col: 1 } })
			expect(view.announced.at(-1)).toBe('4 rows by 1 column selected.')
			key(cell('l', 'name'), 'Escape')
			expect(view.state.cellRange).toBeNull()

			key(cell('l', 'stock'), ' ', { ctrlKey: true })
			key(cell('l', 'stock'), 'Delete')
			expect(told()[0]?.map(([row, column]) => `${String(row)}.${String(column)}`)).toEqual([
				'a.stock',
				'b.stock',
				'c.stock',
				'd.stock',
			])
			// Control+A on a letter selects what the corner selects.
			key(cell('l', 'stock'), 'a', { ctrlKey: true })
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 1 }, end: { row: 5, col: 4 } })
			// Tab is the browser's: it leaves the table.
			expect(key(cell('l', 'stock'), 'Tab').defaultPrevented).toBe(false)
		} finally {
			view.unmount()
		}
	})

	test('a letter cell of a column that leads and is no corner selects nothing, and code is told why', () => {
		const { view, cell } = sheetTable(
			{
				sheet: true,
				columnLetters: true,
				// In the order of display: the columns that lead go first, in the order of their definition.
				columns: [
					{ id: 'pick', header: '', lead: true },
					{ id: '#', header: '', lead: true, rowHeader: true },
					{ id: 'name', header: 'Name', value: (row: { id: string }) => row.id },
				],
			},
			{},
		)
		try {
			// The first column that leads is the corner, and the second is not.
			expect(view.api.columns().map((column) => column.id)).toEqual(['pick', '#', 'name'])
			press(cell('l', '#'))
			expect(view.state.cellRange).toBeNull()
			expect(() => view.api.selectLetterColumn('#')).toThrow(
				'Column "#" leads the table and has no letter. Columns with a letter: name.',
			)
		} finally {
			view.unmount()
		}
	})
})
