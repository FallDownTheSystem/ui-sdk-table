import { describe, expect, test } from 'vite-plus/test'
import type { CellFormulas } from './formula/types'
import { createFormulaEngine } from './formulas'
import type { ColumnDef } from './rows'
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
