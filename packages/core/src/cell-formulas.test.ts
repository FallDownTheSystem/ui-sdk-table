import { describe, expect, test } from 'vite-plus/test'
import type { CellFormulas } from './formula/types'
import { createFormulaEngine } from './formulas'
import { sheetTable, type Report } from './sheet/harness'
import type { TableChangeDetails } from './table'

// The formulas of the `cells` layer of `cellFormulas`: a cell that holds a
// formula, whose result is reported as a value of the row. The columns are
// Name A, Kind B, Price C, Stock D and Total E, and the rows a to d are 1 to 4.

const engine = createFormulaEngine()

function setup(
	extra: Record<string, unknown> = {},
	given: { owner?: (report: Report, apply: () => void) => void } = {},
) {
	const formulas: CellFormulas[] = []
	const harness = sheetTable(
		{
			sheet: true,
			formulas: engine,
			onCellFormulasChange: (value: CellFormulas) => {
				formulas.push(value)
			},
			...extra,
		},
		{ more: ['total'], ...given },
	)
	return { ...harness, formulas }
}

describe('a formula of a cell', () => {
	test('reports its value with the formula, holds the stored form and reads back as addresses', () => {
		const { view, told, reports, values, formulas } = setup()
		try {
			void view.api.editCell('a', 'total', '=C1*D1')
			expect(told()).toEqual([[['a', 'total', undefined, 100]]])
			expect(reports[0]?.edits[0]?.formula).toBe('=[price]*[stock]')
			expect(formulas).toEqual([{ cells: { a: { total: '=[price]*[stock]' } } }])
			expect(values.a).toMatchObject({ total: 100 })
			expect(view.api.getCellFormula('a', 'total')).toEqual({
				rowId: 'a',
				columnId: 'total',
				address: 'E1',
				formula: '=[price]*[stock]',
				text: '=C1*D1',
				value: 100,
				error: null,
				ofColumn: false,
			})
			expect(view.api.getCellFormula('b', 'total')).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('an edit of a value that a formula reads reports the formula cell in the same report', () => {
		const { view, told } = setup()
		try {
			void view.api.editCell('a', 'total', '=C1*D1+C2')
			void view.api.editCell('b', 'total', '=E1*2')
			void view.api.editCell('b', 'price', 1)
			// Each formula cell comes after the cells it reads, with the value before the report.
			expect(told().at(-1)).toEqual([
				['b', 'price', 0.5, 1],
				['a', 'total', 100.5, 101],
				['b', 'total', 201, 202],
			])
			expect(view.api.getHistory().entries.at(-1)).toMatchObject({ cells: 3, formulas: false })
		} finally {
			view.unmount()
		}
	})

	test('a value over a formula takes the formula away in the same report', () => {
		const { view, reports, formulas } = setup()
		try {
			void view.api.editCell('a', 'total', '=C1*D1')
			void view.api.editCell('a', 'total', 7)
			expect(reports.at(-1)?.edits.map((edit) => [edit.value, edit.formula])).toEqual([[7, null]])
			expect(formulas.at(-1)).toEqual({})
			expect(view.api.getCellFormula('a', 'total')).toBeNull()
			view.api.undo()
			expect(view.api.getCellFormula('a', 'total')?.value).toBe(100)
			expect(formulas.at(-1)).toEqual({ cells: { a: { total: '=[price]*[stock]' } } })
		} finally {
			view.unmount()
		}
	})

	test('undo and redo take back and put on the value and the formula, also two in one turn', () => {
		const { view, values, formulas } = setup()
		try {
			view.api.setCellFormula('a', 'total', '=C1+1')
			// No render between the two: the undo starts from the formulas of this turn.
			view.api.undo()
			expect(values.a).toMatchObject({ total: undefined })
			expect(formulas.at(-1)).toEqual({})
			view.api.redo()
			expect(values.a).toMatchObject({ total: 3.5 })
			expect(formulas.at(-1)).toEqual({ cells: { a: { total: '=[price]+1' } } })
			expect(view.api.getHistory().entries.map((entry) => entry.formulas)).toEqual([true])
		} finally {
			view.unmount()
		}
	})

	test('a refusal of each kind names what is valid, and a circle names its path', () => {
		const { view, reports } = setup()
		try {
			expect(() => view.api.editCell('a', 'total', '=SUMM(C1)')).toThrow(/No function `SUMM`/)
			expect(() => view.api.editCell('a', 'total', '=C9')).toThrow(/The table has 4 rows/)
			void view.api.editCell('a', 'total', '=E2')
			expect(() => view.api.editCell('b', 'total', '=E1+1')).toThrow(
				'The formula would read its own cell: E2 reads E1 reads E2.',
			)
			expect(() => view.api.setCellFormula('b', 'total', '=E2')).toThrow(/read its own cell/)
			// Nothing of a refused formula reached the owner.
			expect(reports).toHaveLength(1)
		} finally {
			view.unmount()
		}
	})

	test('a refusal keeps the editor open with its words', () => {
		const { view, cell, field, press } = setup()
		try {
			view.api.startEdit('a', 'total')
			const input = field()
			input.value = '=SUMM(1)'
			press(input, 'Enter')
			expect(view.state.editing).not.toBeNull()
			expect(Object.values(view.state.editErrors)[0]).toMatch(/No function `SUMM`\. Functions: ABS/)
			press(input, 'Escape')
			expect(view.api.getCellFormula('a', 'total')).toBeNull()
			expect(cell('a', 'total').hasAttribute('data-formula')).toBe(false)
		} finally {
			view.unmount()
		}
	})

	test('the field of a formula cell starts with the formula, and Enter on it changes nothing', () => {
		const { view, field, press, reports } = setup()
		try {
			void view.api.editCell('a', 'total', '=C1*D1')
			view.api.startEdit('a', 'total')
			const input = field()
			expect(input.value).toBe('=C1*D1')
			press(input, 'Enter')
			expect(reports).toHaveLength(1)
		} finally {
			view.unmount()
		}
	})

	test("a text after ' is a value that starts with =, and its field starts with ' again", () => {
		const { view, values, field } = setup()
		try {
			void view.api.editCell('a', 'name', "'=Bolt")
			expect(values.a?.name).toBe('=Bolt')
			expect(view.api.getCellFormula('a', 'name')).toBeNull()
			view.api.startEdit('a', 'name')
			expect(field().value).toBe("'=Bolt")
		} finally {
			view.unmount()
		}
	})

	test('a column with `allowFormula: false` keeps a text with = as its value', () => {
		const names: Record<string, string> = { a: 'Bolt' }
		const plain = sheetTable({
			sheet: true,
			formulas: engine,
			columns: [{ id: 'name', header: 'Name', allowFormula: false, value: (row) => names[row.id] }],
			onCellEdit: (edits) => {
				for (const edit of edits) names[edit.rowId] = String(edit.value)
			},
		})
		try {
			void plain.view.api.editCell('a', 'name', '=1+1')
			expect(names.a).toBe('=1+1')
			expect(() => plain.view.api.setCellFormula('a', 'name', '=1+1')).toThrow(
				'A cell of column `name` cannot hold a formula.',
			)
		} finally {
			plain.view.unmount()
		}
	})

	test('an error shows its code, its kind and its words on the cell', () => {
		const { view, cell } = setup()
		try {
			void view.api.editCell('a', 'total', '=C1/0')
			const el = cell('a', 'total')
			expect(el.getAttribute('data-formula')).toBe('')
			expect(el.getAttribute('data-formula-error')).toBe('div0')
			expect(el.getAttribute('aria-description')).toBe('The formula divides by zero.')
			expect(view.api.exportData().rows[0]?.cells[4]?.text).toBe('#DIV/0!')
			expect(view.api.getCellFormula('a', 'total')?.error).toBe('#DIV/0!')
			// The cell beside it heard nothing.
			expect(cell('b', 'total').hasAttribute('data-formula')).toBe(false)
		} finally {
			view.unmount()
		}
	})

	test('a listener that refuses the report refuses all of it; one that refuses the formulas keeps the values', () => {
		const refusing = setup({}, { owner: (report) => report.details.cancel() })
		try {
			expect(() => refusing.view.api.editCell('a', 'total', '=C1*D1')).toThrow(
				'The change was not saved.',
			)
			expect(refusing.formulas).toEqual([])
		} finally {
			refusing.view.unmount()
		}
		const { view, values } = setup({
			onCellFormulasChange: (_value: CellFormulas, details: TableChangeDetails) => details.cancel(),
		})
		try {
			void view.api.editCell('a', 'total', '=C1*D1')
			// The result stays as a plain value, and the step holds the value only.
			expect(values.a).toMatchObject({ total: 100 })
			expect(view.api.getCellFormula('a', 'total')).toBeNull()
			expect(view.api.getHistory().entries).toMatchObject([{ cells: 1, formulas: false }])
		} finally {
			view.unmount()
		}
	})

	test('a table with `manualPage` refuses a formula of a cell', () => {
		const { view } = setup({ manualPage: true, rowCount: 4 })
		try {
			expect(() => view.api.editCell('a', 'total', '=1+1')).toThrow(/gets its rows page by page/)
		} finally {
			view.unmount()
		}
	})

	test('the view holds the formula of the active cell', () => {
		const { view } = setup()
		try {
			void view.api.editCell('a', 'total', '=C1*D1')
			expect(view.api.getView().formula).toBeNull()
			view.api.selectCells({ rowId: 'a', columnId: 'total' })
			expect(view.api.getView().formula).toMatchObject({ address: 'E1', text: '=C1*D1' })
			view.api.selectCells({ rowId: 'a', columnId: 'price' })
			expect(view.api.getView().formula).toMatchObject({ formula: null, text: '2.5' })
		} finally {
			view.unmount()
		}
	})
})

describe('a table without the `formulas` option', () => {
	test('keeps a text with = as a value, holds no formula of a cell, and its actions throw', () => {
		const { view, values, reports, cell, field } = setup({
			formulas: undefined,
			defaultCellFormulas: { cells: { a: { total: '=[price]*2' } } },
		})
		try {
			void view.api.editCell('a', 'total', '=C1*D1')
			expect(values.a).toMatchObject({ total: '=C1*D1' })
			expect(reports[0]?.edits[0]).not.toHaveProperty('formula')
			void view.api.editCell('a', 'name', "'=x")
			expect(values.a?.name).toBe("'=x")
			view.api.startEdit('a', 'name')
			expect(field().value).toBe("'=x")
			expect(cell('a', 'total').hasAttribute('data-formula')).toBe(false)
			expect(view.api.getView().formula).toBeNull()
			expect(() => view.api.getCellFormula('a', 'total')).toThrow('This table has no formulas')
			expect(() => view.api.setCellFormula('a', 'total', '=1')).toThrow(
				'This table has no formulas',
			)
		} finally {
			view.unmount()
		}
	})
})
