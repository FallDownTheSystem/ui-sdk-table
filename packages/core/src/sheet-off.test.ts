import { describe, expect, test } from 'vite-plus/test'
import { sheetTable } from './sheet/harness'

// A table without the options of a sheet behaves as it did before they
// existed. Each slice of the sheet work adds its keys here.

const MOD = { ctrlKey: true }

describe('a table without `sheet` and without `history`', () => {
	test("the keys of a sheet do nothing on a cell: no report, no change of state, and the key stays the browser's", async () => {
		const { view, values, reports, cell, press, clipboard } = sheetTable({
			editable: true,
			cellSelection: true,
		})
		try {
			const before = JSON.stringify(values)
			view.api.selectCells({ rowId: 'a', columnId: 'name' }, { rowId: 'b', columnId: 'stock' })
			cell('a', 'name').focus()
			await view.settle()
			const state = JSON.stringify(view.state)
			const changes = view.changes.length
			const said = view.announced.length
			const keys: [string, KeyboardEventInit?][] = [
				['Delete'],
				['Backspace'],
				['z', MOD],
				['y', MOD],
				['Z', { ...MOD, shiftKey: true }],
				// The range holds two rows and three columns, so a sheet would fill.
				['d', MOD],
				['r', MOD],
				// A sheet would make the range bold and italic.
				['b', MOD],
				['i', MOD],
				['Tab'],
				['Tab', { shiftKey: true }],
			]
			for (const [key, init] of keys) {
				const event = press(cell('a', 'name'), key, init)
				expect([key, event.defaultPrevented]).toEqual([key, false])
			}
			// Without `entry`, one press opens no editor, and the root shows no mode.
			cell('a', 'price').click()
			expect(view.root.hasAttribute('data-entry')).toBe(false)
			const { event, data } = clipboard('cut')
			cell('a', 'name').dispatchEvent(event)
			expect(event.defaultPrevented).toBe(false)
			expect(data.get('text/plain')).toBe('')

			expect(reports).toEqual([])
			expect(JSON.stringify(values)).toBe(before)
			expect(JSON.stringify(view.state)).toBe(state)
			expect(view.changes).toHaveLength(changes)
			expect(view.announced).toHaveLength(said)
			expect(view.state.editing).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test("Enter in the editor saves and focus stays on the cell, and an arrow in the editor is the caret's", async () => {
		const { view, values, reports, cell, field, press } = sheetTable({
			editable: true,
			cellSelection: true,
		})
		try {
			cell('a', 'stock').focus()
			press(cell('a', 'stock'), '5')
			const input = field()
			for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'F2']) {
				expect([key, press(input, key).defaultPrevented]).toEqual([key, false])
			}
			expect(view.state.editing).not.toBeNull()
			expect(reports).toEqual([])
			press(input, 'Enter')
			expect(values.a?.stock).toBe(5)
			expect(reports[0]?.details.reason).toBe('enter-key')
			expect(view.state.active).toEqual({ row: 1, col: 3 })
			expect(document.activeElement).toBe(cell('a', 'stock'))
			// An editor of the caller that saves with Enter keeps focus on the cell too.
			await view.settle()
			press(cell('a', 'stock'), 'Enter')
			view.api.saveEdit(6, new KeyboardEvent('keydown', { key: 'Enter' }))
			expect(reports[1]?.details.reason).toBe('imperative')
			expect(view.state.active).toEqual({ row: 1, col: 3 })
		} finally {
			view.unmount()
		}
	})

	test('Tab in the editor goes to the next cell and leaves a range alone, as before', async () => {
		const { view, cell, field, press } = sheetTable({ editable: true, cellSelection: true })
		try {
			view.api.selectCells({ rowId: 'a', columnId: 'price' }, { rowId: 'b', columnId: 'stock' })
			cell('a', 'stock').focus()
			view.api.startEdit('a', 'stock')
			const input = field()
			input.value = '5'
			press(input, 'Tab')
			// Not back to the first cell of the range: on to the next row.
			expect(view.state.active).toEqual({ row: 2, col: 0 })
		} finally {
			view.unmount()
		}
	})

	test('the table and its cells carry no attribute of a sheet, a block is pasted once, and edits are no steps', () => {
		const { view, told, cell } = sheetTable({ editable: true, cellSelection: true })
		try {
			expect(view.root.hasAttribute('data-sheet')).toBe(false)
			// No row of letters: the header row is grid row 0, and no column has a letter.
			expect(view.root.getAttribute('aria-rowcount')).toBe('5')
			expect(view.api.headerRowCount()).toBe(1)
			expect(view.api.headerAt(0, 0)?.column.id).toBe('name')
			expect(view.api.letterOf('name')).toBeUndefined()
			expect(view.root.querySelector('[data-kind="letter"], [data-corner]')).toBeNull()
			// No cell holds the fill handle, whatever is selected.
			view.api.selectCells({ rowId: 'a', columnId: 'stock' })
			expect(view.api.fillHandleAt({ row: 1, col: 3 })).toBe(false)
			view.api.clearCellSelection()
			expect(
				cell('a', 'name')
					.getAttributeNames()
					.filter((name) => name.startsWith('data-')),
			).toEqual(['data-slot', 'data-editable', 'data-column'])
			view.api.selectCells({ rowId: 'a', columnId: 'stock' }, { rowId: 'd', columnId: 'stock' })
			void view.api.pasteCells('1\n2')
			expect(told()[0]).toHaveLength(2)
			expect(view.state.history).toEqual({ undo: 0, redo: 0 })
			expect(view.api.getView()).toMatchObject({ canUndo: false, canRedo: false })
		} finally {
			view.unmount()
		}
	})
})
