import { mount } from '@vue/test-utils'
import { afterEach, expect, test } from 'vite-plus/test'
import { h, nextTick, shallowRef } from 'vue'
import { createFormulaEngine } from './formulas'
import {
	createTableController,
	Table,
	type CellFormulas,
	type ColumnDef,
	type TableChangeDetails,
} from './index'

// Formulas of columns with an owner that holds `cellFormulas` through
// `v-model`, and rows that come after the formula.

type Line = { id: string; price: number; qty: number }

const columns: ColumnDef<Line>[] = [
	{ id: 'price', header: 'Price' },
	{ id: 'qty', header: 'Quantity' },
	{ id: 'total', header: 'Total' },
]

const engine = createFormulaEngine()

const wrappers: { unmount: () => void }[] = []
afterEach(() => {
	for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

function setup() {
	const rows = shallowRef<Line[]>([
		{ id: 'a', price: 2, qty: 3 },
		{ id: 'b', price: 1.5, qty: 4 },
	])
	const formulas = shallowRef<CellFormulas>({})
	const reasons: string[] = []
	const controller = createTableController()
	const wrapper = mount(
		() =>
			h(Table<Line>, {
				rows: rows.value,
				columns,
				controller,
				formulas: engine,
				history: true,
				'aria-label': 'Lines',
				cellFormulas: formulas.value,
				'onUpdate:cellFormulas': (value: CellFormulas) => (formulas.value = value),
				onCellFormulasChange: (_value: CellFormulas, details: TableChangeDetails) =>
					reasons.push(details.reason),
			}),
		{ attachTo: document.body },
	)
	wrappers.push(wrapper)
	const totals = () => wrapper.findAll('tbody tr').map((row) => row.findAll('td')[2]?.text() ?? '')
	return { wrapper, rows, formulas, reasons, controller, totals }
}

test('`v-model:cell-formulas`: a formula of a column reaches the owner and every row, also a row that comes later', async () => {
	const { rows, formulas, controller, totals, wrapper } = setup()
	await nextTick()
	controller.setColumnFormula('total', '=[Price]*[Quantity]')
	await nextTick()
	expect(formulas.value).toEqual({ columns: { total: '=[price]*[qty]' } })
	expect(totals()).toEqual(['6', '6'])
	expect(wrapper.find('th[data-formula-column]').text()).toBe('Total')

	rows.value = [...rows.value, { id: 'c', price: 10, qty: 2 }]
	await nextTick()
	expect(totals()).toEqual(['6', '6', '20'])
	// A changed row is a new object, and it is computed again.
	rows.value = rows.value.map((row) => (row.id === 'a' ? { ...row, qty: 5 } : row))
	await nextTick()
	expect(totals()).toEqual(['10', '6', '20'])
})

test('`v-model:cell-formulas`: a change and its undo in one turn, then a redo', async () => {
	const { formulas, reasons, controller, totals } = setup()
	await nextTick()
	controller.setColumnFormula('total', '=[price]+[qty]')
	controller.undo()
	await nextTick()
	expect(reasons).toEqual(['imperative', 'undo'])
	expect(formulas.value).toEqual({})
	expect(totals()).toEqual(['', ''])
	controller.redo()
	await nextTick()
	expect(formulas.value).toEqual({ columns: { total: '=[price]+[qty]' } })
	expect(totals()).toEqual(['5', '5.5'])
})

test('a formula of a cell with an owner that holds the rows and `v-model:cell-formulas`: the result and its dependents render, and a cell slot reads the formula', async () => {
	const rows = shallowRef<Line[]>([
		{ id: 'a', price: 2, qty: 3 },
		{ id: 'b', price: 1.5, qty: 4 },
	])
	const formulas = shallowRef<CellFormulas>({})
	const controller = createTableController()
	const wrapper = mount(
		() =>
			h(
				Table<Line>,
				{
					rows: rows.value,
					columns,
					controller,
					formulas: engine,
					editable: true,
					history: true,
					'aria-label': 'Lines',
					cellFormulas: formulas.value,
					'onUpdate:cellFormulas': (value: CellFormulas) => (formulas.value = value),
					onCellEdit: (edits: readonly { rowId: string; columnId: string; value: unknown }[]) => {
						rows.value = rows.value.map((row) => {
							const mine = edits.filter((edit) => edit.rowId === row.id)
							return mine.length
								? { ...row, ...Object.fromEntries(mine.map((edit) => [edit.columnId, edit.value])) }
								: row
						})
					},
				},
				{
					'col-total': (props: { text: string; formula?: { text: string } }) =>
						`${props.text} ${props.formula?.text ?? '-'}`,
				},
			),
		{ attachTo: document.body },
	)
	wrappers.push(wrapper)
	const totals = () => wrapper.findAll('tbody tr').map((row) => row.findAll('td')[2]?.text() ?? '')

	void controller.editCell('a', 'total', '=A1*B1')
	void controller.editCell('b', 'total', '=C1+1')
	await nextTick()
	expect(formulas.value).toEqual({
		cells: { a: { total: '=[price]*[qty]' }, b: { total: '=[total@a]+1' } },
	})
	expect(totals()).toEqual(['6 =A1*B1', '7 =C1+1'])

	void controller.editCell('a', 'qty', 10)
	await nextTick()
	expect(totals()).toEqual(['20 =A1*B1', '21 =C1+1'])
	const cell = wrapper.find('td[data-formula]')
	expect(cell.exists()).toBe(true)

	// One undo takes back the value and both results that followed from it.
	controller.undo()
	await nextTick()
	expect(totals()).toEqual(['6 =A1*B1', '7 =C1+1'])
})
