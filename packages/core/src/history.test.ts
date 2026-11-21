import { describe, expect, test } from 'vite-plus/test'
import { priceSchema, sheetTable } from './sheet/harness'

const MOD = { ctrlKey: true }

describe('history of cell values', () => {
	test('an edit in the editor, a paste and `editCell` are one step each', async () => {
		const { view, cell, field, press } = sheetTable({
			editable: true,
			cellSelection: true,
			history: true,
		})
		try {
			expect(view.api.getView()).toMatchObject({ canUndo: false, canRedo: false })
			const changed: (readonly string[])[] = []
			view.api.subscribe((keys) => changed.push(keys))

			cell('a', 'name').focus()
			press(cell('a', 'name'), 'Enter')
			const input = field()
			input.value = 'Bolt M6'
			press(input, 'Enter')
			expect(changed.some((keys) => keys.includes('history'))).toBe(true)

			view.api.selectCells({ rowId: 'b', columnId: 'price' })
			void view.api.pasteCells('1\t10\n2\t20')
			void view.api.editCell('d', 'stock', 61)

			expect(view.api.getHistory()).toEqual({
				entries: [
					// A key that a test dispatches comes from a script. A browser test shows `keyboard` here.
					{
						id: 1,
						reason: 'enter-key',
						source: 'programmatic',
						cells: 1,
						formats: false,
						formulas: false,
					},
					{
						id: 2,
						reason: 'paste',
						source: 'programmatic',
						cells: 4,
						formats: false,
						formulas: false,
					},
					{
						id: 3,
						reason: 'imperative',
						source: 'programmatic',
						cells: 1,
						formats: false,
						formulas: false,
					},
				],
				position: 3,
			})
			expect(view.api.getView()).toMatchObject({ canUndo: true, canRedo: false })
			expect(view.state.history).toEqual({ undo: 3, redo: 0 })
		} finally {
			view.unmount()
		}
	})

	test('an undo reports the old values with the reason `undo`, the value of now and the row of now, and a redo puts them on again', async () => {
		const { view, values, rows, reports, told } = sheetTable({
			editable: true,
			cellSelection: true,
			history: true,
		})
		try {
			view.api.selectCells({ rowId: 'b', columnId: 'price' })
			void view.api.pasteCells('1\t10\n2\t20')
			await view.settle()
			view.api.undo()
			expect(reports[1]?.details.reason).toBe('undo')
			expect(told()[1]).toEqual([
				['b', 'price', 1, 0.5],
				['b', 'stock', 10, 90],
				['c', 'price', 2, 0.2],
				['c', 'stock', 20, 15],
			])
			expect(reports[1]?.edits[0]?.row).toBe(rows[1])
			expect(values.b).toMatchObject({ price: 0.5, stock: 90 })
			expect(view.announced.at(-1)).toBe('4 cells changed back.')
			expect(view.api.getView()).toMatchObject({ canUndo: false, canRedo: true })
			// The cells of the step are the range, and the active cell is the first of them.
			expect(view.state.active).toEqual({ row: 2, col: 2 })
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 2 }, end: { row: 3, col: 3 } })

			await view.settle()
			view.api.redo()
			expect(reports[2]?.details.reason).toBe('redo')
			expect(told()[2]?.[0]).toEqual(['b', 'price', 0.5, 1])
			expect(values.c).toMatchObject({ price: 2, stock: 20 })
			expect(view.announced.at(-1)).toBe('4 cells changed again.')
			expect(view.api.getHistory().position).toBe(1)
		} finally {
			view.unmount()
		}
	})

	test('the keys: Control+Z takes a step back, Control+Y and Control+Shift+Z put it on again, from any cell', () => {
		const { view, values, cell, press } = sheetTable({ editable: true, history: true })
		try {
			void view.api.editCell('a', 'stock', 41)
			const undo = press(cell('c', 'name'), 'z', MOD)
			expect(undo.defaultPrevented).toBe(true)
			expect(values.a?.stock).toBe(40)
			press(cell('c', 'name'), 'y', MOD)
			expect(values.a?.stock).toBe(41)
			// From a header cell too.
			press(cell('h', 'name'), 'z', MOD)
			expect(values.a?.stock).toBe(40)
			press(cell('h', 'name'), 'Z', { ...MOD, shiftKey: true })
			expect(values.a?.stock).toBe(41)
		} finally {
			view.unmount()
		}
	})

	test("a key with no step is the table's all the same, and silent", () => {
		const { view, reports, cell, press } = sheetTable({ editable: true, history: true })
		try {
			const said = view.announced.length
			expect(press(cell('a', 'name'), 'z', MOD).defaultPrevented).toBe(true)
			expect(press(cell('a', 'name'), 'y', MOD).defaultPrevented).toBe(true)
			expect(reports).toEqual([])
			expect(view.announced).toHaveLength(said)
		} finally {
			view.unmount()
		}
	})

	test("a key in a field inside a cell is the field's: the browser undoes the typing there", () => {
		const { view, reports, cell, press } = sheetTable({ editable: true, history: true })
		try {
			void view.api.editCell('a', 'stock', 41)
			const inner = document.createElement('input')
			cell('b', 'name').append(inner)
			const event = press(inner, 'z', MOD)
			expect(event.defaultPrevented).toBe(false)
			expect(reports).toHaveLength(1)
			// The editor of the table stops its keys before they reach the cell.
			cell('a', 'name').focus()
			press(cell('a', 'name'), 'Enter')
			expect(view.state.editing).not.toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('an edit that the owner cancels is no step', () => {
		const { view } = sheetTable(
			{ editable: true, history: true },
			{ owner: (report) => report.details.cancel() },
		)
		try {
			expect(() => view.api.editCell('a', 'stock', 41)).toThrow('The change was not saved.')
			expect(view.api.getHistory().entries).toEqual([])
			expect(view.api.getView().canUndo).toBe(false)
		} finally {
			view.unmount()
		}
	})

	test('an undo that the owner cancels keeps its step: code gets the reason, and a key says it', () => {
		let refuse = false
		const { view, values, cell, press } = sheetTable(
			{ editable: true, history: true },
			{ owner: (report, apply) => (refuse ? report.details.cancel() : apply()) },
		)
		try {
			void view.api.editCell('a', 'stock', 41)
			refuse = true
			expect(() => view.api.undo()).toThrow('The change was not taken back.')
			expect(view.api.getHistory().position).toBe(1)
			expect(values.a?.stock).toBe(41)
			press(cell('a', 'name'), 'z', MOD)
			expect(view.announced.at(-1)).toBe('The change was not taken back.')
			expect(view.api.getView().canUndo).toBe(true)
			refuse = false
			view.api.undo()
			expect(values.a?.stock).toBe(40)
		} finally {
			view.unmount()
		}
	})

	test('an owner that never put the value in gets no report at the undo', async () => {
		const { view, reports } = sheetTable({ editable: true, history: true }, { owner: () => {} })
		try {
			void view.api.editCell('a', 'stock', 41)
			// After the turn, the table reads the rows of the owner again: the stock is 40.
			await view.settle()
			view.api.undo()
			expect(reports).toHaveLength(1)
			expect(view.announced.at(-1)).toBe('No cell changed back.')
			expect(view.api.getHistory().position).toBe(0)
		} finally {
			view.unmount()
		}
	})

	test('an owner that changes the value: the undo puts back what was there, and says what the cell holds now', async () => {
		const { view, values, told } = sheetTable(
			{ editable: true, history: true },
			{
				owner: (report, apply) => {
					apply()
					// The owner rounds a stock to tens.
					for (const edit of report.edits) {
						const item = values[edit.rowId]
						if (item && report.details.reason !== 'undo')
							item.stock = Math.round(item.stock / 10) * 10
					}
				},
			},
		)
		try {
			void view.api.editCell('a', 'stock', 44)
			expect(values.a?.stock).toBe(40)
			void view.api.editCell('a', 'stock', 57)
			expect(values.a?.stock).toBe(60)
			await view.settle()
			view.api.undo()
			// The step holds 44 to 57, as the table reported it. The cell holds 60 now.
			expect(told().at(-1)).toEqual([['a', 'stock', 60, 44]])
			expect(values.a?.stock).toBe(44)
		} finally {
			view.unmount()
		}
	})

	test('two undos in one turn both reach the owner, also when the second value is the one of the last render', () => {
		const { view, values, told } = sheetTable({ editable: true, history: true })
		try {
			void view.api.editCell('a', 'name', 'Rivet')
			void view.api.editCell('a', 'name', 'Bolt')
			void view.api.editCell('a', 'name', 'Pin')
			view.api.undo()
			view.api.undo()
			view.api.undo()
			expect(told().slice(3)).toEqual([
				[['a', 'name', 'Pin', 'Bolt']],
				[['a', 'name', 'Bolt', 'Rivet']],
				[['a', 'name', 'Rivet', 'Bolt']],
			])
			expect(values.a?.name).toBe('Bolt')
			view.api.redo()
			view.api.redo()
			expect(values.a?.name).toBe('Bolt')
			expect(told().at(-1)).toEqual([['a', 'name', 'Rivet', 'Bolt']])
		} finally {
			view.unmount()
		}
	})

	test('an undo runs no schema: a value that the data held is put back without a check', async () => {
		const seen: unknown[] = []
		const { view, values } = sheetTable(
			{ editable: true, history: true },
			{ schema: priceSchema(true, seen) },
		)
		try {
			// The data holds a price that the schema of today refuses.
			if (values.a) values.a.price = -1
			await view.api.editCell('a', 'price', 3)
			expect(seen).toEqual([3])
			view.api.undo()
			expect(values.a?.price).toBe(-1)
			expect(seen).toEqual([3])
		} finally {
			view.unmount()
		}
	})

	test('while a value is checked, a key does nothing and `undo` throws: the step of the check is not there yet', async () => {
		const { view, values, reports, cell, press } = sheetTable(
			{ editable: true, cellSelection: true, history: true },
			{ schema: priceSchema(true) },
		)
		try {
			void view.api.editCell('a', 'stock', 41)
			view.api.selectCells({ rowId: 'b', columnId: 'price' })
			const paste = view.api.pasteCells('7')
			const key = press(cell('a', 'name'), 'z', MOD)
			expect(key.defaultPrevented).toBe(true)
			expect(() => view.api.undo()).toThrow(
				'A value is checked now. Undo and redo wait for the answer.',
			)
			expect(values.a?.stock).toBe(41)
			await paste
			expect(reports).toHaveLength(2)
			view.api.undo()
			expect(values.b?.price).toBe(0.5)
			expect(values.a?.stock).toBe(41)
		} finally {
			view.unmount()
		}
	})

	test('`undo` from code saves an open editor first, and that save is the step it takes back', async () => {
		const { view, values, cell, field, press, told } = sheetTable({ editable: true, history: true })
		try {
			cell('a', 'name').focus()
			press(cell('a', 'name'), 'Enter')
			const input = field()
			input.value = 'Rivet'
			view.api.undo()
			expect(view.state.editing).toBeNull()
			expect(told()).toEqual([[['a', 'name', 'Bolt', 'Rivet']], [['a', 'name', 'Rivet', 'Bolt']]])
			expect(values.a?.name).toBe('Bolt')
		} finally {
			view.unmount()
		}
	})

	test('a cell that a filter or a hidden column takes out of view gets its value back, and the table says that it is not in view', async () => {
		const { view, values } = sheetTable({ editable: true, history: true })
		try {
			void view.api.editCell('a', 'stock', 41)
			void view.api.editCell('b', 'name', 'Hex nut')
			await view.settle()
			view.api.setColumnVisibility('name', false)
			view.api.undo()
			expect(values.b?.name).toBe('Nut')
			expect(view.announced.at(-1)).toBe('1 cell changed back. 1 cell of them is not in view.')
			view.api.setColumnFilter('kind', { values: ['Brass'] })
			await view.settle()
			view.api.undo()
			expect(values.a?.stock).toBe(40)
			expect(view.announced.at(-1)).toBe('1 cell changed back. 1 cell of them is not in view.')
		} finally {
			view.unmount()
		}
	})

	test('the limits: `limit` keeps the newest steps, and a step over `maxCells` empties the history with a word', () => {
		const { view } = sheetTable({
			editable: true,
			cellSelection: true,
			history: { limit: 2, maxCells: 3 },
		})
		try {
			void view.api.editCell('a', 'stock', 41)
			void view.api.editCell('a', 'stock', 42)
			void view.api.editCell('a', 'stock', 43)
			expect(view.api.getHistory().entries.map((entry) => entry.id)).toEqual([2, 3])
			view.api.selectCells({ rowId: 'b', columnId: 'price' })
			void view.api.pasteCells('1\t10\n2\t20')
			expect(view.api.getHistory().entries).toEqual([])
			expect(view.announced).toContain(
				'A change of 4 cells is too large to undo. The history is empty now.',
			)
			expect(view.api.getView().canUndo).toBe(false)
		} finally {
			view.unmount()
		}
	})

	test('`undo` and `redo` say why they cannot run, and `clearHistory` forgets the steps', () => {
		const off = sheetTable({ editable: true })
		try {
			expect(() => off.view.api.undo()).toThrow(
				'This table has no history. Set its `history` option.',
			)
			expect(() => off.view.api.redo()).toThrow('This table has no history.')
			expect(() => off.view.api.clearHistory()).toThrow('This table has no history.')
			void off.view.api.editCell('a', 'stock', 41)
			expect(off.view.api.getHistory()).toEqual({ entries: [], position: 0 })
			expect(off.view.api.getView()).toMatchObject({ canUndo: false, canRedo: false })
		} finally {
			off.view.unmount()
		}
		const { view } = sheetTable({ editable: true, history: true })
		try {
			expect(() => view.api.undo()).toThrow('Nothing to undo.')
			expect(() => view.api.redo()).toThrow('Nothing to redo.')
			void view.api.editCell('a', 'stock', 41)
			view.api.clearHistory()
			expect(() => view.api.undo()).toThrow('Nothing to undo.')
			expect(view.state.history).toEqual({ undo: 0, redo: 0 })
		} finally {
			view.unmount()
		}
	})

	test('an undo and a redo are no steps themselves, and an edit after an undo drops the redo', () => {
		const { view } = sheetTable({ editable: true, history: true })
		try {
			void view.api.editCell('a', 'stock', 41)
			void view.api.editCell('a', 'stock', 42)
			view.api.undo()
			expect(view.api.getHistory()).toMatchObject({ position: 1 })
			expect(view.api.getHistory().entries).toHaveLength(2)
			void view.api.editCell('b', 'stock', 91)
			expect(view.api.getHistory().entries.map((entry) => entry.id)).toEqual([1, 3])
			expect(() => view.api.redo()).toThrow('Nothing to redo.')
		} finally {
			view.unmount()
		}
	})
})
