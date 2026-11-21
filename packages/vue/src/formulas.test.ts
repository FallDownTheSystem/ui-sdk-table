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
