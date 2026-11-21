import { mount } from '@vue/test-utils'
import { afterEach, expect, test } from 'vite-plus/test'
import { h, nextTick, shallowRef } from 'vue'
import { createFormulaEngine } from './formulas'
import {
	createTableController,
	Table,
	type CellEdit,
	type CellFormulas,
	type TableEditDetails,
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

type Sum = { id: string; price: number; qty: number; total?: unknown; sum?: unknown }
const sumColumns: ColumnDef<Sum>[] = [
	{ id: 'price', header: 'Price' },
	{ id: 'qty', header: 'Quantity' },
	{ id: 'total', header: 'Total' },
	{ id: 'sum', header: 'Sum' },
]

/** A table whose owner holds the rows. `take` decides what the owner does with a report. */
function owned(
	start: Sum[],
	cellFormulas: CellFormulas,
	take: (edits: readonly CellEdit[], reason: string) => readonly CellEdit[] = (edits) => edits,
	formulas = engine,
) {
	const rows = shallowRef<Sum[]>(start)
	const held = shallowRef<CellFormulas>(cellFormulas)
	const reports: { reason: string; cells: [string, string, unknown][] }[] = []
	const controller = createTableController()
	const wrapper = mount(
		() =>
			h(Table<Sum>, {
				rows: rows.value,
				columns: sumColumns,
				controller,
				formulas,
				editable: true,
				history: true,
				'aria-label': 'Sums',
				cellFormulas: held.value,
				'onUpdate:cellFormulas': (value: CellFormulas) => (held.value = value),
				onCellEdit: (edits: readonly CellEdit[], details: TableEditDetails) => {
					reports.push({
						reason: details.reason,
						cells: edits.map((edit) => [edit.rowId, edit.columnId, edit.value]),
					})
					const taken = take(edits, details.reason)
					rows.value = rows.value.map((row) => {
						const mine = taken.filter((edit) => edit.rowId === row.id)
						return mine.length
							? { ...row, ...Object.fromEntries(mine.map((edit) => [edit.columnId, edit.value])) }
							: row
					})
				},
			}),
		{ attachTo: document.body },
	)
	wrappers.push(wrapper)
	// The check runs in a microtask after the new rows, and the render after it.
	const settle = async () => {
		await nextTick()
		await Promise.resolve()
		await nextTick()
	}
	const checks = () => reports.filter((report) => report.reason === 'recalculate')
	return { rows, held, reports, checks, controller, settle }
}

const start = (): Sum[] => [
	{ id: 'a', price: 2, qty: 3, total: 6 },
	{ id: 'b', price: 1.5, qty: 4, total: 6 },
	{ id: 'c', price: 1, qty: 1, sum: 3.5 },
]
const shared: CellFormulas = {
	cells: {
		a: { total: '=[price]*[qty]' },
		b: { total: '=[price]*[qty]' },
		c: { sum: '=SUM([price@a]:[price@b])' },
	},
}

test('after new rows of the owner, the formula cells that read a changed value follow, and no step is made', async () => {
	const { rows, checks, controller, settle } = owned(start(), shared)
	await settle()
	expect(checks()).toEqual([])
	rows.value = rows.value.map((row) => (row.id === 'a' ? { ...row, price: 5 } : row))
	await settle()
	expect(checks()).toEqual([
		{
			reason: 'recalculate',
			cells: [
				['a', 'total', 15],
				['c', 'sum', 6.5],
			],
		},
	])
	expect(rows.value[0]?.total).toBe(15)
	// The owner took the values: nothing more to report, and the history holds nothing.
	await settle()
	expect(checks()).toHaveLength(1)
	expect(controller.getHistory().entries).toEqual([])
})

test('an owner that clamps an edit gets the result of the clamped value', async () => {
	const { rows, checks, controller, settle } = owned(start(), shared, (edits) =>
		edits.map((edit) =>
			edit.columnId === 'qty' && typeof edit.value === 'number'
				? { ...edit, value: Math.min(edit.value, 10) }
				: edit,
		),
	)
	await settle()
	void controller.editCell('a', 'qty', 50)
	await settle()
	// The report held 2 × 50; the owner kept 10, so the check gives 2 × 10.
	expect(rows.value[0]).toMatchObject({ qty: 10, total: 20 })
	expect(checks()).toEqual([{ reason: 'recalculate', cells: [['a', 'total', 20]] }])
})

test('a row comes inside a range and the range holds it; a row that a formula names goes and the formula gives #REF!', async () => {
	const rowsAtStart = start().map((row) => (row.id === 'c' ? { ...row, total: 3 } : row))
	const { rows, checks, settle } = owned(rowsAtStart, {
		cells: { c: { total: '=[price@b]*2', sum: '=SUM([price@a]:[price@b])' } },
	})
	await settle()
	const [a, b, c] = rows.value
	if (!a || !b || !c) throw new Error('The rows of the test are missing.')
	rows.value = [a, { id: 'x', price: 100, qty: 0 }, b, c]
	await settle()
	expect(checks().at(-1)?.cells).toEqual([['c', 'sum', 103.5]])
	rows.value = rows.value.filter((row) => row.id !== 'b')
	await settle()
	expect(checks().at(-1)?.cells).toEqual([
		['c', 'total', '#REF!'],
		['c', 'sum', '#REF!'],
	])
	expect(rows.value.find((row) => row.id === 'c')).toMatchObject({ total: '#REF!', sum: '#REF!' })
})

test('an owner that never takes a result gets it once, and no loop', async () => {
	// The owner writes another value than each result of a check, so the next rows differ again.
	const { rows, checks, settle } = owned(start(), shared, (edits, reason) =>
		reason === 'recalculate'
			? edits.map((edit) => ({ ...edit, value: Number(edit.value) - 1 }))
			: edits,
	)
	await settle()
	rows.value = rows.value.map((row) => (row.id === 'a' ? { ...row, price: 5 } : row))
	await settle()
	await settle()
	await settle()
	expect(rows.value[0]?.total).toBe(14)
	expect(checks()).toHaveLength(1)
})

test('an undo of an edit that the owner took causes no check report', async () => {
	const { checks, controller, settle } = owned(start(), shared)
	await settle()
	void controller.editCell('a', 'price', 4)
	await settle()
	controller.undo()
	await settle()
	expect(checks()).toEqual([])
})

test('`recalculate` reports every formula cell that does not hold its value, and a table without cell formulas checks nothing', async () => {
	const wrong = start().map((row) => (row.id === 'b' ? { ...row, total: 99 } : row))
	const { checks, controller, settle } = owned(wrong, shared)
	await settle()
	expect(controller.recalculate()).toBe(1)
	expect(checks()).toEqual([{ reason: 'recalculate', cells: [['b', 'total', 6]] }])
	await settle()
	expect(controller.recalculate()).toBe(0)

	let calls = 0
	const counted = {
		...engine,
		recheck: (...args: Parameters<typeof engine.recheck>) => {
			calls++
			return engine.recheck(...args)
		},
	}
	const plain = owned(start(), { columns: { sum: '=[price]+1' } }, undefined, counted)
	await plain.settle()
	plain.rows.value = plain.rows.value.map((row) => ({ ...row, price: row.price + 1 }))
	await plain.settle()
	expect(calls).toBe(0)
	expect(plain.checks()).toEqual([])
})
