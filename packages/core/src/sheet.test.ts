import { describe, expect, test } from 'vite-plus/test'
import { emptyValue } from './edit'
import type { ColumnDef } from './rows'
import { COLUMN_IDS, priceSchema, sheetTable } from './sheet/harness'

describe('the keys of a sheet', () => {
	test('`sheet` is a preset: cells can be edited and selected, the history and the fill handle are on, unless one is set to false', () => {
		const { view, cell } = sheetTable({ sheet: true })
		try {
			expect(view.root.getAttribute('data-sheet')).toBe('')
			expect(view.root.getAttribute('data-cell-selection')).toBe('')
			expect(cell('a', 'name').getAttribute('data-editable')).toBe('')
			view.api.selectCells({ rowId: 'a', columnId: 'stock' })
			expect(view.api.fillHandleAt(view.state.active ?? { row: -1, col: -1 })).toBe(true)
			// A column that says otherwise wins, as before.
			expect(cell('a', 'kind').getAttribute('aria-readonly')).toBe('true')
			void view.api.editCell('a', 'stock', 41)
			expect(view.api.getView().canUndo).toBe(true)
		} finally {
			view.unmount()
		}
		const off = sheetTable({ sheet: true, editable: false, cellSelection: false, history: false })
		try {
			expect(off.view.root.getAttribute('data-sheet')).toBe('')
			expect(off.view.root.getAttribute('data-cell-selection')).toBeNull()
			expect(off.cell('a', 'name').getAttribute('data-editable')).toBeNull()
			expect(() => off.view.api.undo()).toThrow('This table has no history.')
		} finally {
			off.view.unmount()
		}
		// One feature off leaves the others on.
		const noFill = sheetTable({ sheet: true, fillHandle: false })
		try {
			noFill.view.api.selectCells({ rowId: 'a', columnId: 'stock' })
			expect(noFill.view.api.fillHandleAt(noFill.view.state.active ?? { row: -1, col: -1 })).toBe(
				false,
			)
			expect(noFill.cell('a', 'name').getAttribute('data-editable')).toBe('')
			void noFill.view.api.editCell('a', 'stock', 41)
			expect(noFill.view.api.getView().canUndo).toBe(true)
		} finally {
			noFill.view.unmount()
		}
	})

	test('Enter in the editor saves and moves down, and Shift+Enter moves up', async () => {
		const { view, values, reports, cell, field, press } = sheetTable({ sheet: true })
		try {
			cell('a', 'stock').focus()
			press(cell('a', 'stock'), '5')
			expect(view.api.edit.mode()).toBe('replace')
			expect(view.api.edit.typed()).toBe('5')
			press(field(), 'Enter')
			expect(values.a?.stock).toBe(5)
			expect(reports[0]?.details.reason).toBe('enter-key')
			expect(view.state.active).toEqual({ row: 2, col: 3 })
			expect(document.activeElement).toBe(cell('b', 'stock'))
			await view.settle()

			press(cell('b', 'stock'), '6')
			press(field(), 'Enter', { shiftKey: true })
			expect(values.b?.stock).toBe(6)
			expect(view.state.active).toEqual({ row: 1, col: 3 })
			await view.settle()

			// At the last row, Enter saves and focus stays on the cell.
			cell('d', 'stock').focus()
			press(cell('d', 'stock'), '7')
			press(field(), 'Enter')
			expect(values.d?.stock).toBe(7)
			expect(view.state.active).toEqual({ row: 4, col: 3 })
		} finally {
			view.unmount()
		}
	})

	test('an arrow in an editor that a character opened saves and moves; after F2 it moves the caret', async () => {
		const { view, values, reports, cell, field, press } = sheetTable({ sheet: true })
		try {
			cell('a', 'name').focus()
			press(cell('a', 'name'), 'R')
			const first = field()
			first.value = 'Rivet'
			const arrow = press(first, 'ArrowDown')
			expect(arrow.defaultPrevented).toBe(true)
			expect(values.a?.name).toBe('Rivet')
			expect(reports[0]?.details.reason).toBe('list-navigation')
			expect(view.state.active).toEqual({ row: 2, col: 0 })
			await view.settle()

			// F2 turns the editor to the mode where arrows are the caret's.
			press(cell('b', 'name'), 'P')
			const second = field()
			second.value = 'Pin'
			press(second, 'F2')
			expect(view.api.edit.mode()).toBe('edit')
			const caret = press(second, 'ArrowRight')
			expect(caret.defaultPrevented).toBe(false)
			expect(view.state.editing).not.toBeNull()
			expect(reports).toHaveLength(1)
			view.api.cancelEdit()
			await view.settle()

			// An editor that Enter or F2 opened holds a value to change: arrows move the caret.
			press(cell('b', 'name'), 'F2')
			expect(view.api.edit.mode()).toBe('edit')
			expect(view.api.edit.typed()).toBeUndefined()
			expect(press(field(), 'ArrowDown').defaultPrevented).toBe(false)
			expect(view.state.editing).not.toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('an arrow that saved moves as an arrow on a cell does: one cell, and a range goes', async () => {
		const { view, values, cell, field, press } = sheetTable({ sheet: true })
		try {
			view.api.selectCells({ rowId: 'a', columnId: 'price' }, { rowId: 'b', columnId: 'stock' })
			cell('a', 'price').focus()
			press(cell('a', 'price'), '9')
			press(field(), 'ArrowRight')
			expect(values.a?.price).toBe(9)
			expect(view.state.active).toEqual({ row: 1, col: 3 })
			expect(view.state.cellRange).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('a key of an input method, and an arrow with a modifier, are not a move', () => {
		const { view, cell, field, press } = sheetTable({ sheet: true })
		try {
			cell('a', 'name').focus()
			press(cell('a', 'name'), 'x')
			const input = field()
			press(input, 'ArrowDown', { isComposing: true })
			expect(view.state.editing).not.toBeNull()
			press(input, 'ArrowLeft', { shiftKey: true })
			expect(view.state.editing).not.toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('inside a range, Enter and Tab walk the range, start again at its first cell, and the range stays', async () => {
		const { view, values, cell, field, press } = sheetTable({ sheet: true })
		try {
			const range = { anchor: { row: 1, col: 2 }, end: { row: 2, col: 3 } }
			view.api.selectCells({ rowId: 'a', columnId: 'price' }, { rowId: 'b', columnId: 'stock' })
			cell('a', 'price').focus()
			const seen: unknown[] = []
			for (const digit of ['1', '2', '3', '4']) {
				const active = view.state.active
				if (!active) throw new Error('No active cell.')
				const el = cell(['a', 'b', 'c', 'd'][active.row - 1] ?? '', COLUMN_IDS[active.col] ?? '')
				press(el, digit)
				press(field(), 'Enter')
				seen.push(view.state.active)
				expect(view.state.cellRange).toEqual(range)
				await view.settle()
			}
			// Down the first column, then the second, and back to the start.
			expect(seen).toEqual([
				{ row: 2, col: 2 },
				{ row: 1, col: 3 },
				{ row: 2, col: 3 },
				{ row: 1, col: 2 },
			])
			expect([values.a?.price, values.b?.price, values.a?.stock, values.b?.stock]).toEqual([
				1, 2, 3, 4,
			])

			// Tab in the editor walks the range row by row.
			press(cell('a', 'price'), '5')
			press(field(), 'Tab')
			expect(view.state.active).toEqual({ row: 1, col: 3 })
			await view.settle()
			press(cell('a', 'stock'), '6')
			press(field(), 'Tab')
			expect(view.state.active).toEqual({ row: 2, col: 2 })
			expect(view.state.cellRange).toEqual(range)
		} finally {
			view.unmount()
		}
	})

	test('Tab on a cell leaves the table, but with a range it moves inside the range until Escape drops it', async () => {
		const { view, cell, press } = sheetTable({ sheet: true })
		try {
			cell('a', 'price').focus()
			view.api.selectCells({ rowId: 'a', columnId: 'price' })
			// No range: the key is not the table's, so the browser moves focus out.
			expect(press(cell('a', 'price'), 'Tab').defaultPrevented).toBe(false)

			view.api.selectCells({ rowId: 'a', columnId: 'price' }, { rowId: 'b', columnId: 'stock' })
			const range = view.state.cellRange
			expect(press(cell('a', 'price'), 'Tab').defaultPrevented).toBe(true)
			expect(view.state.active).toEqual({ row: 1, col: 3 })
			expect(document.activeElement).toBe(cell('a', 'stock'))
			press(cell('a', 'stock'), 'Tab')
			expect(view.state.active).toEqual({ row: 2, col: 2 })
			press(cell('b', 'price'), 'Tab', { shiftKey: true })
			expect(view.state.active).toEqual({ row: 1, col: 3 })
			press(cell('a', 'stock'), 'Tab', { shiftKey: true })
			press(cell('a', 'price'), 'Tab', { shiftKey: true })
			// Back from the first cell is the last cell of the range.
			expect(view.state.active).toEqual({ row: 2, col: 3 })
			expect(view.state.cellRange).toEqual(range)

			await view.keys('Escape')
			expect(view.state.cellRange).toBeNull()
			expect(press(cell('b', 'stock'), 'Tab').defaultPrevented).toBe(false)
			// A header cell never keeps Tab.
			expect(press(cell('h', 'name'), 'Tab').defaultPrevented).toBe(false)
		} finally {
			view.unmount()
		}
	})

	test('a refused value keeps the editor and does not move, and a slow check moves at its answer', async () => {
		const { view, values, cell, field, press } = sheetTable(
			{ sheet: true },
			{ schema: priceSchema(true) },
		)
		try {
			cell('a', 'price').focus()
			press(cell('a', 'price'), '-')
			const input = field()
			input.value = '-4'
			press(input, 'Enter')
			expect(view.state.editChecking).not.toBeNull()
			expect(view.state.active).toEqual({ row: 1, col: 2 })
			await view.settle()
			expect(view.state.editing).not.toBeNull()
			expect(view.state.active).toEqual({ row: 1, col: 2 })
			expect(view.announced.at(-1)).toBe('The price must be 0 or more.')

			input.value = '4'
			input.dispatchEvent(new Event('input', { bubbles: true }))
			press(input, 'Enter')
			expect(view.state.active).toEqual({ row: 1, col: 2 })
			await view.settle()
			expect(values.a?.price).toBe(4)
			expect(view.state.editing).toBeNull()
			expect(view.state.active).toEqual({ row: 2, col: 2 })
		} finally {
			view.unmount()
		}
	})

	test('an editor of the caller saves with Enter and moves down too', () => {
		const { view, values, cell, press } = sheetTable({ sheet: true })
		try {
			cell('a', 'stock').focus()
			press(cell('a', 'stock'), 'Enter')
			const enter = new KeyboardEvent('keydown', { key: 'Enter' })
			view.api.saveEdit(77, enter)
			expect(values.a?.stock).toBe(77)
			expect(view.state.active).toEqual({ row: 2, col: 3 })
		} finally {
			view.unmount()
		}
	})
})

describe('clear and cut', () => {
	test('the empty value of a cell follows the value that it holds, or the `parse` of its column', () => {
		const row = { text: 'x', count: 3, big: 3n, done: true, when: new Date(0), none: null }
		const empty = (column: ColumnDef) => emptyValue(row, column)
		expect(empty({ id: 'text' })).toBe('')
		expect(empty({ id: 'count' })).toBeNull()
		expect(empty({ id: 'big' })).toBeNull()
		expect(empty({ id: 'when' })).toBeNull()
		expect(empty({ id: 'done' })).toBe(false)
		expect(empty({ id: 'none' })).toBe('')
		expect(empty({ id: 'none', format: 'currency' })).toBeNull()
		expect(empty({ id: 'count', parse: (text) => (text === '' ? 0 : Number(text)) })).toBe(0)
	})

	test('Delete empties one cell, and Backspace every cell of a range that can be edited, as one report', async () => {
		const { view, values, reports, told, cell, press } = sheetTable({ sheet: true })
		try {
			cell('a', 'stock').focus()
			view.api.selectCells({ rowId: 'a', columnId: 'stock' })
			const key = press(cell('a', 'stock'), 'Delete')
			expect(key.defaultPrevented).toBe(true)
			expect(told()).toEqual([[['a', 'stock', 40, null]]])
			expect(reports[0]?.details.reason).toBe('clear')
			expect(view.announced.at(-1)).toBe('1 cell cleared.')
			await view.settle()

			view.api.selectCells({ rowId: 'b', columnId: 'name' }, { rowId: 'c', columnId: 'price' })
			press(cell('b', 'name'), 'Backspace')
			// The kind column cannot be edited, and is left as it is.
			expect(told()[1]).toEqual([
				['b', 'name', 'Nut', ''],
				['b', 'price', 0.5, null],
				['c', 'name', 'Washer', ''],
				['c', 'price', 0.2, null],
			])
			expect(values.b?.kind).toBe('Steel')
			expect(view.announced.at(-1)).toBe('4 cells cleared.')
			// One step: one undo brings all four back.
			await view.settle()
			view.api.undo()
			expect(values.b).toMatchObject({ name: 'Nut', price: 0.5 })
			expect(values.c).toMatchObject({ name: 'Washer', price: 0.2 })
		} finally {
			view.unmount()
		}
	})

	test('a column that refuses an empty value stops the whole clear, with its words', () => {
		const { view, reports, cell, press } = sheetTable({ sheet: true }, { schema: priceSchema() })
		try {
			view.api.selectCells({ rowId: 'a', columnId: 'name' }, { rowId: 'a', columnId: 'price' })
			cell('a', 'name').focus()
			press(cell('a', 'name'), 'Delete')
			expect(reports).toEqual([])
			expect(view.announced.at(-1)).toBe(
				'Nothing was cleared. Price refuses an empty value: The price must be 0 or more.',
			)
			expect(() => view.api.clearCells()).toThrow(
				'Nothing was cleared. Price refuses an empty value',
			)
			// Where no cell can be edited, the clear says so.
			view.api.selectCells({ rowId: 'a', columnId: 'kind' })
			expect(() => view.api.clearCells()).toThrow(
				'Nothing was cleared. No cell here can be edited.',
			)
		} finally {
			view.unmount()
		}
	})

	test('a cut puts the text of a copy on the clipboard and empties the cells, with the reason `cut`', async () => {
		const { view, values, reports, cell, clipboard } = sheetTable({ sheet: true })
		try {
			view.api.selectCells({ rowId: 'a', columnId: 'name' }, { rowId: 'b', columnId: 'kind' })
			cell('a', 'name').focus()
			const { event, data } = clipboard('cut')
			cell('a', 'name').dispatchEvent(event)
			expect(event.defaultPrevented).toBe(true)
			expect(data.get('text/plain')).toBe('Bolt\tSteel\nNut\tSteel')
			expect(reports[0]?.details.reason).toBe('cut')
			expect(values.a?.name).toBe('')
			expect(values.b?.name).toBe('')
			expect(values.a?.kind).toBe('Steel')
			expect(view.announced.at(-1)).toBe('2 cells cut.')
			expect(view.api.getHistory().entries.at(-1)).toMatchObject({ reason: 'cut', cells: 2 })
			await view.settle()

			// From code, the text is the answer.
			view.api.selectCells({ rowId: 'c', columnId: 'stock' }, { rowId: 'd', columnId: 'stock' })
			expect(view.api.cutCells()).toBe('15\n60')
			expect(values.d?.stock).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('a cut that is refused leaves the values, and the text stays on the clipboard as after a copy', () => {
		const { view, values, cell, clipboard } = sheetTable({ sheet: true }, { schema: priceSchema() })
		try {
			view.api.selectCells({ rowId: 'a', columnId: 'price' }, { rowId: 'b', columnId: 'price' })
			cell('a', 'price').focus()
			const { event, data } = clipboard('cut')
			cell('a', 'price').dispatchEvent(event)
			expect(data.get('text/plain')).toBe('2.5\n0.5')
			expect(values.a?.price).toBe(2.5)
			expect(view.announced.at(-1)).toContain('Nothing was cleared. Price refuses an empty value')
		} finally {
			view.unmount()
		}
	})

	test('a clear waits for a check that takes time, and then empties every cell at once', async () => {
		const later = priceSchema(true)
		const lenient = {
			'~standard': {
				...later['~standard'],
				validate: (value: unknown) => Promise.resolve({ value }),
			},
		}
		const { view, values, reports } = sheetTable({ sheet: true }, { schema: lenient })
		try {
			view.api.selectCells({ rowId: 'a', columnId: 'price' }, { rowId: 'b', columnId: 'stock' })
			const cleared = view.api.clearCells()
			expect(cleared).toBeInstanceOf(Promise)
			expect(reports).toEqual([])
			await cleared
			expect(reports).toHaveLength(1)
			expect(reports[0]?.edits).toHaveLength(4)
			expect(values.b).toMatchObject({ price: null, stock: null })
		} finally {
			view.unmount()
		}
	})
})

describe('a range from code, and the selection in the view', () => {
	test('`selectAllCells`, `selectCellRows` and `selectCellColumns` select body cells only, and move the active cell into the range', () => {
		const { view } = sheetTable({ cellSelection: true })
		try {
			view.api.selectAllCells()
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 0 }, end: { row: 4, col: 3 } })
			expect(view.state.active).toEqual({ row: 1, col: 0 })
			view.api.selectCellRows('b', 'c')
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 0 }, end: { row: 3, col: 3 } })
			expect(view.state.active).toEqual({ row: 2, col: 0 })
			view.api.selectCellRows('d')
			expect(view.state.cellRange).toEqual({ anchor: { row: 4, col: 0 }, end: { row: 4, col: 3 } })
			view.api.selectCellColumns('price', 'stock')
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 2 }, end: { row: 4, col: 3 } })
			expect(view.state.active).toEqual({ row: 1, col: 2 })
			// The active cell that is inside the new range stays.
			view.api.selectCells({ rowId: 'c', columnId: 'stock' })
			view.api.selectCellColumns('stock')
			expect(view.state.active).toEqual({ row: 3, col: 3 })
			expect(view.api.copyCells()).toBe('40\n90\n15\n60')
		} finally {
			view.unmount()
		}
	})

	test('each of them says what is wrong, with the valid ids', () => {
		const off = sheetTable({ editable: true })
		try {
			expect(() => off.view.api.selectAllCells()).toThrow('This table has no cell selection.')
			expect(() => off.view.api.selectCellRows('a')).toThrow('This table has no cell selection.')
			expect(() => off.view.api.selectCellColumns('name')).toThrow(
				'This table has no cell selection.',
			)
		} finally {
			off.view.unmount()
		}
		const { view } = sheetTable({ cellSelection: true })
		try {
			expect(() => view.api.selectCellRows('z')).toThrow('No row "z" to select. Rows: a, b, c, d.')
			expect(() => view.api.selectCellRows('a', 'z')).toThrow('No row "z" to select.')
			expect(() => view.api.selectCellColumns('size')).toThrow(
				'No column "size" to select. Columns: name, kind, price, stock.',
			)
			view.api.setColumnVisibility('kind', false)
			expect(() => view.api.selectCellColumns('kind')).toThrow('Column "kind" is hidden')
		} finally {
			view.unmount()
		}
	})

	test('the view holds the active cell and the corners of the selection by id', () => {
		const { view } = sheetTable({ cellSelection: true })
		try {
			expect(view.api.getView()).toMatchObject({ activeCell: null, cellSelection: null })
			view.api.selectCells({ rowId: 'b', columnId: 'kind' })
			expect(view.api.getView()).toMatchObject({
				activeCell: { rowId: 'b', columnId: 'kind' },
				cellSelection: {
					from: { rowId: 'b', columnId: 'kind' },
					to: { rowId: 'b', columnId: 'kind' },
					rows: 1,
					columns: 1,
				},
			})
			view.api.selectCells({ rowId: 'c', columnId: 'stock' }, { rowId: 'a', columnId: 'kind' })
			expect(view.api.getView()).toMatchObject({
				activeCell: { rowId: 'c', columnId: 'stock' },
				cellSelection: {
					from: { rowId: 'a', columnId: 'kind' },
					to: { rowId: 'c', columnId: 'stock' },
					rows: 3,
					columns: 3,
				},
			})
			const seen: (readonly string[])[] = []
			view.api.subscribe((keys) => seen.push(keys))
			view.api.selectAllCells()
			expect(seen.flat()).toContain('cellRange')
		} finally {
			view.unmount()
		}
		// Without cell selection, the view still says where the active cell is.
		const plain = sheetTable({ editable: true })
		try {
			plain.cell('a', 'name').focus()
			expect(plain.view.api.getView()).toMatchObject({
				activeCell: { rowId: 'a', columnId: 'name' },
				cellSelection: null,
			})
			plain.cell('h', 'name').focus()
			expect(plain.view.api.getView().activeCell).toBeNull()
		} finally {
			plain.view.unmount()
		}
	})

	test('in a sheet, a block repeats over a range that it fits a whole number of times', async () => {
		const { view, values, told } = sheetTable({ sheet: true })
		try {
			// One row of two cells into four rows of two cells: four copies.
			view.api.selectCells({ rowId: 'a', columnId: 'price' }, { rowId: 'd', columnId: 'stock' })
			void view.api.pasteCells('1\t10')
			expect(told()[0]).toHaveLength(8)
			expect(Object.values(values).map((item) => [item.price, item.stock])).toEqual([
				[1, 10],
				[1, 10],
				[1, 10],
				[1, 10],
			])
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 2 }, end: { row: 4, col: 3 } })
			await view.settle()

			// Two rows into three rows do not fit: the block is pasted once, from the first cell.
			view.api.selectCells({ rowId: 'a', columnId: 'stock' }, { rowId: 'c', columnId: 'stock' })
			void view.api.pasteCells('7\n8')
			expect(told()[1]).toEqual([
				['a', 'stock', 10, 7],
				['b', 'stock', 10, 8],
			])
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 3 }, end: { row: 2, col: 3 } })
		} finally {
			view.unmount()
		}
	})

	test('in a table, a block never repeats', () => {
		const { view, told } = sheetTable({ editable: true, cellSelection: true })
		try {
			view.api.selectCells({ rowId: 'a', columnId: 'price' }, { rowId: 'd', columnId: 'stock' })
			void view.api.pasteCells('1\t10')
			expect(told()[0]).toEqual([
				['a', 'price', 2.5, 1],
				['a', 'stock', 40, 10],
			])
		} finally {
			view.unmount()
		}
	})
})
