import { mount } from '@vue/test-utils'
import { afterEach, expect, test } from 'vite-plus/test'
import { createAgent } from '@ui-sdk/vue/agent'
import { effectScope, h, nextTick, shallowRef } from 'vue'
import { createFormulaEngine, useFormulaBar } from './formulas'
import {
	createTableController,
	Table,
	useTableView,
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
				cellSelection: true,
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

test('an agent reads and writes formulas with actions, and a wrong argument names what is valid', async () => {
	const { controller } = owned(start(), shared)
	const agent = createAgent()
	const seen = agent.snapshot().find((component) => component.label === 'Sums')
	expect(seen?.actions).toEqual(
		expect.arrayContaining([
			'getCellFormula',
			'setCellFormula',
			'getFormulaSummary',
			'evaluateFormula',
			'getFormulaFunctions',
			'recalculate',
		]),
	)
	const done = await agent.act({
		steps: [{ ref: 'Sums', action: 'setCellFormula', args: ['c', 'total', '=[price@a]+[price]'] }],
	})
	expect(done.ok).toBe(true)
	await nextTick()
	expect(controller.getCellFormula('c', 'total')).toMatchObject({ text: '=A1+A3', value: 3 })
	expect(controller.evaluateFormula('=A1*10', { rowId: 'b', columnId: 'total' })).toBe(20)
	expect(
		controller.getFormulaFunctions().find((entry) => entry.name === 'WEEKOF')?.args,
	).toBeTruthy()
	expect(controller.getFormulaSummary()).toEqual({
		lines: [
			{ columnId: 'total', formula: '=[price]*[qty]', cells: 2, rowId: 'a', ofColumn: false },
			{
				columnId: 'sum',
				formula: '=SUM([price@a]:[price@b])',
				cells: 1,
				rowId: 'c',
				ofColumn: false,
			},
			{ columnId: 'total', formula: '=[price@a]+[price]', cells: 1, rowId: 'c', ofColumn: false },
		],
		more: 0,
	})
	expect(controller.getFormulaSummary(1).more).toBe(2)

	const wrong = await agent.act({
		steps: [{ ref: 'Sums', action: 'getCellFormula', args: ['c', 'cost'] }],
	})
	expect(wrong.error?.message).toContain('Columns: price, qty, total, sum.')
	expect(() => controller.getFormulaSummary(0)).toThrow('a whole number from 1 to 500')
	expect(() => controller.evaluateFormula('=SUMM(1)', { rowId: 'a', columnId: 'total' })).toThrow(
		'No function `SUMM`',
	)
	expect(() => controller.evaluateFormula('5', { rowId: 'a', columnId: 'total' })).toThrow(
		'A formula is a text that starts with `=`',
	)
	expect(() => controller.evaluateFormula('=1')).toThrow('No cell is active')
	expect(() => controller.setCellFormula('zz', 'total', '=1')).toThrow('No row "zz"')
})

test('the snapshot of an agent is as large with 300 formula cells as without them', () => {
	const many = Array.from({ length: 300 }, (_, index) => ({
		id: `r${index}`,
		price: index,
		qty: 2,
	}))
	const cells: Record<string, Record<string, string>> = {}
	for (const row of many) cells[row.id] = { total: '=[price]*[qty]' }
	const size = (cellFormulas: CellFormulas, label: string) => {
		const wrapper = mount(
			() =>
				h(Table<Sum>, {
					rows: many,
					columns: sumColumns,
					formulas: engine,
					cellFormulas,
					'aria-label': label,
				}),
			{ attachTo: document.body },
		)
		wrappers.push(wrapper)
		const found = createAgent()
			.snapshot()
			.find((component) => component.label === label)
		return JSON.stringify(found).length - label.length
	}
	expect(size({ cells }, 'With')).toBe(size({}, 'Bare'))
})

test('`useFormulaBar` follows the active cell, keeps a draft with its cell, saves it, and keeps a refusal with its words', async () => {
	const { controller, held, rows } = owned(start(), shared)
	await nextTick()
	const scope = effectScope()
	const bar = scope.run(() => useFormulaBar(controller))
	if (!bar) throw new Error('No bar.')
	expect(bar.ready.value).toBe(false)
	controller.selectCells({ rowId: 'a', columnId: 'total' })
	await nextTick()
	expect([bar.address.value, bar.text.value, bar.dirty.value]).toEqual(['C1', '=A1*B1', false])

	bar.input('=A1*B1*2')
	// The active cell moves; the draft stays with its cell.
	controller.selectCells({ rowId: 'b', columnId: 'price' })
	await nextTick()
	expect([bar.address.value, bar.text.value, bar.dirty.value]).toEqual(['C1', '=A1*B1*2', true])
	expect(bar.commit()).toBe(true)
	await nextTick()
	expect(held.value.cells?.a?.total).toBe('=[price]*[qty]*2')
	expect(rows.value[0]?.total).toBe(12)
	expect([bar.address.value, bar.text.value]).toEqual(['A2', '1.5'])

	bar.input('=SUMM(1)')
	expect(bar.commit()).toBe(false)
	expect(bar.error.value).toContain('No function `SUMM`')
	expect(bar.text.value).toBe('=SUMM(1)')
	bar.cancel()
	expect([bar.text.value, bar.error.value, bar.dirty.value]).toEqual(['1.5', '', false])
	scope.stop()
})

test('a table with `manualPage` does no check after new rows', async () => {
	let calls = 0
	const counted = {
		...engine,
		recheck: (...args: Parameters<typeof engine.recheck>) => {
			calls++
			return engine.recheck(...args)
		},
	}
	const rows = shallowRef<Sum[]>(start())
	const reasons: string[] = []
	const wrapper = mount(
		() =>
			h(Table<Sum>, {
				rows: rows.value,
				columns: sumColumns,
				formulas: counted,
				manualPage: true,
				rowCount: 3,
				cellFormulas: shared,
				'aria-label': 'Paged',
				onCellEdit: (_edits: readonly CellEdit[], details: TableEditDetails) =>
					reasons.push(details.reason),
			}),
		{ attachTo: document.body },
	)
	wrappers.push(wrapper)
	await nextTick()
	rows.value = rows.value.map((row) => ({ ...row, price: row.price + 1 }))
	await nextTick()
	await Promise.resolve()
	await nextTick()
	expect(calls).toBe(0)
	expect(reasons).toEqual([])
})

test('in a table that holds its formulas, a new formula of a cell that keeps its value renders that cell and no other, and its slot reads the formula', async () => {
	const rendered: string[] = []
	const rows = shallowRef<Sum[]>(start())
	const controller = createTableController()
	const cell = (props: {
		node: { id: string }
		column: { id: string }
		text: string
		formula?: { text: string }
	}) => {
		rendered.push(`${props.node.id}|${props.column.id}`)
		return `${props.text} ${props.formula?.text ?? '-'}`
	}
	const wrapper = mount(
		() =>
			h(
				Table<Sum>,
				{
					rows: rows.value,
					columns: sumColumns,
					controller,
					formulas: engine,
					editable: true,
					'aria-label': 'Renders',
					// A prop of the owner renders the whole table when it changes, as every prop of `Table` does.
					defaultCellFormulas: shared,
					// The owner gives new rows only when a value changed.
					onCellEdit: (edits: readonly CellEdit[]) => {
						if (edits.every((edit) => edit.value === edit.previous)) return
						rows.value = rows.value.map((row) => {
							const mine = edits.filter((edit) => edit.rowId === row.id)
							return mine.length
								? { ...row, ...Object.fromEntries(mine.map((edit) => [edit.columnId, edit.value])) }
								: row
						})
					},
				},
				{ cell },
			),
		{ attachTo: document.body },
	)
	wrappers.push(wrapper)
	await nextTick()
	rendered.length = 0
	const b = () => wrapper.get('tbody tr:nth-child(2) td[data-column="total"]')
	expect(b().text()).toBe('6 =A2*B2')
	// The total of b stays 6, so only its formula changes.
	controller.setCellFormula('b', 'total', '=6')
	await nextTick()
	expect(rendered).toEqual(['b|total'])
	expect(b().text()).toBe('6 =6')
	controller.setCellFormula('b', 'total', null)
	await nextTick()
	expect(b().text()).toBe('6 -')
	expect(b().attributes('data-formula')).toBeUndefined()
})

test('a new locale of the table reaches the view and the formula bar, with no other change', async () => {
	const locale = shallowRef('en-US')
	// The rows and the columns stay the same objects, so only the locale is new.
	const rows: Line[] = [{ id: 'a', price: 2, qty: 3 }]
	const controller = createTableController()
	const scope = effectScope()
	const { view, bar } =
		scope.run(() => ({ view: useTableView(controller), bar: useFormulaBar(controller) })) ?? {}
	const wrapper = mount(
		() =>
			h(Table<Line>, {
				rows,
				columns,
				controller,
				formulas: engine,
				locale: locale.value,
				sheet: true,
				defaultCellFormulas: { cells: { a: { total: '=ROUND([price]*1.5, 1)' } } },
				'aria-label': 'Lines',
			}),
		{ attachTo: document.body },
	)
	wrappers.push(wrapper)
	await nextTick()
	controller.selectCells({ rowId: 'a', columnId: 'total' })
	await nextTick()
	expect(view?.value?.formula?.text).toBe('=ROUND(A1*1.5, 1)')
	expect(bar?.text.value).toBe('=ROUND(A1*1.5, 1)')

	locale.value = 'de-DE'
	await nextTick()
	expect(view?.value?.formula?.text).toBe('=ROUND(A1*1,5; 1)')
	expect(bar?.text.value).toBe('=ROUND(A1*1,5; 1)')
	scope.stop()
})
