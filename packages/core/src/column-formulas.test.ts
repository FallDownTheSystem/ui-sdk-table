import { describe, expect, test } from 'vite-plus/test'
import type { CellFormulas } from './formula/types'
import { createFormulaEngine } from './formulas'
import type { ColumnDef } from './rows'
import { rowNumberColumn } from './sheet/chrome'
import { items, sheetTable, type ItemRow } from './sheet/harness'

// The formulas of the `columns` layer of `cellFormulas`: a column whose
// value is a formula of its own row, set at run time.

const engine = createFormulaEngine()

/** The columns of the harness, and a column `total` that holds no value of its own. */
function columnsOf(values = items()): ColumnDef<ItemRow>[] {
	const read = (key: 'name' | 'kind' | 'price' | 'stock') => (row: ItemRow) => values[row.id]?.[key]
	return [
		{ id: 'name', header: 'Name', value: read('name') },
		{ id: 'kind', header: 'Kind', value: read('kind') },
		{ id: 'price', header: 'Price', value: read('price') },
		{ id: 'stock', header: 'Stock', value: read('stock') },
		{ id: 'total', header: 'Total' },
		{ id: 'band', header: 'Band' },
	]
}

function setup(extra: Record<string, unknown> = {}) {
	const told: CellFormulas[] = []
	const harness = sheetTable({
		sheet: true,
		columns: columnsOf(),
		formulas: engine,
		onCellFormulasChange: (value: CellFormulas) => {
			told.push(value)
		},
		...extra,
	})
	const values = (columnId: string) => {
		const data = harness.view.api.exportData()
		const at = data.columns.findIndex((column) => column.id === columnId)
		return data.rows.map((row) => row.cells[at]?.value)
	}
	return { ...harness, told, values }
}

describe('a formula of a column', () => {
	test('gives every row its value, can be changed and taken away, and each is one step', () => {
		const { view, told, values } = setup()
		try {
			expect(values('total')).toEqual([undefined, undefined, undefined, undefined])
			view.api.setColumnFormula('total', '=[price]*[stock]')
			expect(told).toEqual([{ columns: { total: '=[price]*[stock]' } }])
			expect(values('total')).toEqual([100, 45, 3, 90])
			expect(view.api.getColumnFormula('total')).toEqual({
				formula: '=[price]*[stock]',
				text: '=[Price]*[Stock]',
				error: null,
			})
			expect(view.api.getView().cellFormulas).toEqual({ columns: { total: '=[price]*[stock]' } })

			// A person types the headers; the state holds the ids.
			view.api.setColumnFormula('total', '=[Price]+[Stock]')
			expect(values('total')).toEqual([42.5, 90.5, 15.2, 61.5])
			view.api.setColumnFormula('total', null)
			expect(values('total')).toEqual([undefined, undefined, undefined, undefined])
			expect(view.api.getColumnFormula('total')).toBeNull()

			view.api.undo()
			expect(values('total')).toEqual([42.5, 90.5, 15.2, 61.5])
			view.api.undo()
			view.api.undo()
			expect(told.at(-1)).toEqual({})
			view.api.redo()
			expect(values('total')).toEqual([100, 45, 3, 90])
			expect(view.api.getHistory().entries.map((entry) => [entry.reason, entry.formulas])).toEqual([
				['formula', true],
				['formula', true],
				['formula', true],
			])
		} finally {
			view.unmount()
		}
	})

	test('reads another formula column, and its cells cannot be edited or pasted into', () => {
		const { view, values, cell, reports } = setup()
		try {
			view.api.setColumnFormula('total', '=[price]*[stock]')
			view.api.setColumnFormula(
				'band',
				'=IFS([total]<10, "small", [total]<100, "medium", TRUE, "large")',
			)
			expect(values('band')).toEqual(['large', 'medium', 'small', 'medium'])
			expect(cell('a', 'total').getAttribute('data-formula-column')).toBe('')
			expect(cell('a', 'price').hasAttribute('data-formula-column')).toBe(false)
			expect(view.root.hasAttribute('data-formulas')).toBe(true)

			expect(() => view.api.editCell('a', 'total', 5)).toThrow(
				'The cell of row "a" in column "total" cannot be edited.',
			)
			view.api.selectCells({ rowId: 'a', columnId: 'stock' })
			void view.api.pasteCells('1\t2')
			expect(reports.at(-1)?.edits.map((edit) => edit.columnId)).toEqual(['stock'])
		} finally {
			view.unmount()
		}
	})

	test('a refusal carries the words for a person as its cause, and the message stays for a developer', () => {
		const { view } = setup()
		try {
			let thrown: Error | undefined
			try {
				view.api.setColumnFormula('total', '=[price]*')
			} catch (error) {
				thrown = error as Error
			}
			expect(thrown?.cause).toBe('The formula ends too soon.')
			expect(thrown?.message).toBe(
				'The formula "=[price]*" of column "total" cannot be set: The formula ends too soon.',
			)
		} finally {
			view.unmount()
		}
	})

	test('is refused with the words that say why, and nothing changes', () => {
		const { view, told } = setup()
		try {
			expect(() => view.api.setColumnFormula('total', '=[Pric]*2')).toThrow(
				'No column `Pric`. Columns: Name, Kind, Price, Stock, Total, Band.',
			)
			expect(() => view.api.setColumnFormula('total', '=B2*2')).toThrow('names another row')
			expect(() => view.api.setColumnFormula('total', '=[total]+1')).toThrow(
				'reads that column itself',
			)
			view.api.setColumnFormula('total', '=[band]&"!"')
			expect(() => view.api.setColumnFormula('band', '=[total]&"?"')).toThrow(
				'The formula would read its own cell: Band reads Total reads Band.',
			)
			expect(() => view.api.setColumnFormula('nope', '=1')).toThrow(
				'No column "nope" to give a formula. Columns: name, kind, price, stock, total, band.',
			)
			expect(told).toEqual([{ columns: { total: '=[band]&"!"' } }])
		} finally {
			view.unmount()
		}
	})

	test('of the owner that cannot be read, or that reads in a circle, shows an error in every row', () => {
		const { view, values } = setup({
			defaultCellFormulas: {
				columns: { total: '=[band]+1', band: '=[total]+1', kind: '=SUMM(1)' },
			},
		})
		try {
			expect(values('total')).toEqual(['#CYCLE!', '#CYCLE!', '#CYCLE!', '#CYCLE!'])
			expect(values('kind')).toEqual(['#NAME?', '#NAME?', '#NAME?', '#NAME?'])
			expect(view.api.getColumnFormula('kind')?.error).toMatch(/^No function `SUMM`/)
		} finally {
			view.unmount()
		}
	})

	test('that the owner holds and does not pass back changes nothing on the screen', () => {
		const { view, told, values } = setup({ cellFormulas: {} })
		try {
			view.api.setColumnFormula('total', '=[price]*2')
			expect(told).toEqual([{ columns: { total: '=[price]*2' } }])
			expect(values('total')).toEqual([undefined, undefined, undefined, undefined])
			// A second change in the same turn starts from what was told.
			view.api.setColumnFormula('band', '="x"')
			expect(told.at(-1)).toEqual({ columns: { total: '=[price]*2', band: '="x"' } })
			// The undo goes back to the value of the last render, and the owner hears it.
			view.api.undo()
			view.api.undo()
			expect(told.at(-1)).toEqual({})
		} finally {
			view.unmount()
		}
	})
})

describe('a table without the `formulas` option', () => {
	test('reads no formula, and the actions of formulas throw', () => {
		const { view, values } = setup({
			formulas: undefined,
			defaultCellFormulas: { columns: { total: '=[price]*2' } },
		})
		try {
			expect(values('total')).toEqual([undefined, undefined, undefined, undefined])
			expect(view.api.getView().formulas).toBe(false)
			expect(view.root.hasAttribute('data-formulas')).toBe(false)
			expect(() => view.api.setColumnFormula('total', '=1')).toThrow(
				'This table has no formulas: pass `formulas`.',
			)
			expect(() => view.api.getColumnFormula('total')).toThrow('This table has no formulas')
		} finally {
			view.unmount()
		}
	})
})

describe('the addresses of a table with formulas', () => {
	const numbered = () => {
		const values = items()
		const read = (key: 'name' | 'kind' | 'price' | 'stock') => (row: ItemRow) =>
			values[row.id]?.[key]
		return [
			rowNumberColumn<ItemRow>(),
			{ id: 'name', header: 'Name', value: read('name') },
			{ id: 'kind', header: 'Kind', value: read('kind') },
			{ id: 'price', header: 'Price', value: read('price'), sortable: true },
			{ id: 'stock', header: 'Stock', value: read('stock') },
		] satisfies ColumnDef<ItemRow>[]
	}

	test('the number of a row is its place in the document, also after a sort and on another page', () => {
		const { view, cell } = sheetTable({
			sheet: true,
			columns: numbered(),
			formulas: engine,
			defaultPage: { page: 1, pageSize: 4 },
		})
		try {
			expect(cell('c', '#').getAttribute('aria-label')).toBe('Row 3')
			view.api.sortBy('price', 'asc')
			// The cheapest row (c) is the third row of the document.
			expect(['c', 'b', 'd', 'a'].map((id) => view.api.rowNumber(id))).toEqual([3, 2, 4, 1])
			view.api.setPageSize(2)
			view.api.setPage(2)
			// Page 2 holds the rows d and a, by price: their numbers are still those of the document.
			expect(['d', 'a'].map((id) => view.api.rowNumber(id))).toEqual([4, 1])
			expect(view.api.getAddress('c', 'price')).toBe('C3')
			expect(view.api.cellAt('$d$1')).toEqual({ rowId: 'a', columnId: 'stock' })
			expect(() => view.api.cellAt('A9')).toThrow('No cell `A9`. The table has 4 rows.')
			expect(() => view.api.getAddress('a', 'nope')).toThrow('No column "nope"')
		} finally {
			view.unmount()
		}
	})

	test('a letter is the place among the columns of the owner: a hidden column leaves a gap, and a moved one keeps it', () => {
		const { view } = sheetTable({
			sheet: true,
			columnLetters: true,
			columns: numbered(),
			formulas: engine,
		})
		try {
			const letters = () => ['name', 'kind', 'price', 'stock'].map((id) => view.api.letterOf(id))
			expect(letters()).toEqual(['A', 'B', 'C', 'D'])
			// The hidden column keeps its letter and has no cell in the row of letters: A, C, D.
			view.api.setColumnVisibility('kind', false)
			expect(letters()).toEqual(['A', 'B', 'C', 'D'])
			expect(
				view.api.getView().visibleColumns.map((column) => view.api.letterOf(column.id)),
			).toEqual([undefined, 'A', 'C', 'D'])
			view.api.setColumnVisibility('kind', true)
			view.api.moveColumn('stock', 2)
			expect(letters()).toEqual(['A', 'B', 'C', 'D'])
			expect(view.api.letterOf('#')).toBeUndefined()
		} finally {
			view.unmount()
		}
	})

	test('with pages from a server, and without the option, numbers and letters are places of the view', () => {
		const server = sheetTable({
			sheet: true,
			columns: numbered(),
			formulas: engine,
			manualPage: true,
			rowCount: 40,
			page: { page: 3, pageSize: 4 },
		})
		try {
			expect(server.view.api.rowNumber('a')).toBe(9)
		} finally {
			server.view.unmount()
		}
		const plain = sheetTable({ sheet: true, columnLetters: true, columns: numbered() })
		try {
			plain.view.api.sortBy('price', 'asc')
			expect(plain.view.api.rowNumber('c')).toBe(1)
			plain.view.api.setColumnVisibility('kind', false)
			expect(plain.view.api.letterOf('price')).toBe('B')
		} finally {
			plain.view.unmount()
		}
	})
})

describe('a cell of a computed column', () => {
	test('opens with the formula of the column, and a save changes the column as one step', () => {
		const { view, values, told, field, press } = setup()
		try {
			view.api.setColumnFormula('total', '=[price]*[stock]')
			view.api.startEdit('b', 'total')
			const input = field()
			expect(input.value).toBe('=[Price]*[Stock]')
			input.value = '=[Price]+1'
			press(input, 'Enter')
			expect(view.state.editing).toBeNull()
			expect(told.at(-1)).toEqual({ columns: { total: '=[price]+1' } })
			expect(values('total')).toEqual([3.5, 1.5, 1.2, 2.5])
			expect(view.api.getHistory().entries.at(-1)).toMatchObject({ formulas: true, cells: 0 })
			view.api.undo()
			expect(view.api.getColumnFormula('total')?.formula).toBe('=[price]*[stock]')
			expect(values('total')).toEqual([100, 45, 3, 90])
		} finally {
			view.unmount()
		}
	})

	test('takes no value: a value is refused with words, and the editor stays open', () => {
		const { view, told, field, press } = setup()
		try {
			view.api.setColumnFormula('total', '=[price]*[stock]')
			view.api.startEdit('a', 'total')
			const input = field()
			input.value = '12'
			press(input, 'Enter')
			expect(view.state.editing).not.toBeNull()
			expect(Object.values(view.state.editErrors)[0]).toBe(
				'Column `total` is computed: type a formula that starts with `=` for the whole column.',
			)
			input.value = '=[Pric]'
			press(input, 'Enter')
			expect(Object.values(view.state.editErrors)[0]).toMatch(/No column `Pric`/)
			press(input, 'Escape')
			expect(told).toEqual([{ columns: { total: '=[price]*[stock]' } }])
			// A value through the controller is no formula: the cell stays closed for it.
			expect(() => view.api.editCell('a', 'total', 5)).toThrow('cannot be edited')
		} finally {
			view.unmount()
		}
	})

	test('stays closed when the owner does not let a person edit the column', () => {
		const { view, cell } = setup({
			columns: columnsOf().map((column) =>
				column.id === 'total' ? { ...column, editable: false } : column,
			),
		})
		try {
			view.api.setColumnFormula('total', '=[price]*[stock]')
			expect(() => view.api.startEdit('a', 'total')).toThrow('cannot be edited')
			expect(cell('a', 'total').hasAttribute('data-editable')).toBe(false)
		} finally {
			view.unmount()
		}
	})
})
