import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { createFormulaEngine } from './formulas'
import {
	applyEdits,
	createTableController,
	Table,
	useEditDraft,
	type CellEdit,
	type CellFormulas,
	type ColumnDef,
	type TableEditDetails,
} from './index'

const engine = createFormulaEngine()

type Item = { id: string; name: string; price: number }

const columns: ColumnDef<Item>[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'price', header: 'Price' },
]

function edit(row: Item, columnId: 'name' | 'price', value: unknown): CellEdit<Item> {
	const column = columns.find((each) => each.id === columnId) as ColumnDef<Item>
	return { rowId: row.id, columnId, row, column, value, previous: row[columnId] }
}

test('a draft shows its values in new rows, counts the cells that differ, and never changes a row of the owner', () => {
	const owner = shallowRef<Item[]>([
		{ id: 'a', name: 'Bolt', price: 2 },
		{ id: 'b', name: 'Nut', price: 1 },
	])
	const [a, b] = owner.value as [Item, Item]
	const draft = useEditDraft(owner)
	draft.onCellEdit([edit(a, 'price', 5), edit(b, 'name', 'Screw')])
	expect(draft.rows.value).toEqual([
		{ id: 'a', name: 'Bolt', price: 5 },
		{ id: 'b', name: 'Screw', price: 1 },
	])
	expect(a.price).toBe(2)
	expect(b.name).toBe('Nut')
	expect(draft.count.value).toBe(2)
	expect(draft.changed('a', 'price')).toBe(true)
	expect(draft.changed('a', 'name')).toBe(false)

	// A cell set back to its first value no longer differs, and its row is the row of the owner again.
	const [shown] = draft.rows.value as [Item]
	draft.onCellEdit([edit(shown, 'price', 2)])
	expect(draft.count.value).toBe(1)
	expect(draft.changed('a', 'price')).toBe(false)
	expect(draft.rows.value[0]).toBe(a)

	draft.cancel()
	expect(draft.count.value).toBe(0)
	expect(draft.rows.value[1]).toBe(b)
})

test('save gives the edits against the rows of the owner, one for each cell that differs, and empties the draft', () => {
	const owner = shallowRef<Item[]>([
		{ id: 'a', name: 'Bolt', price: 2 },
		{ id: 'b', name: 'Nut', price: 1 },
	])
	const [a, b] = owner.value as [Item, Item]
	const draft = useEditDraft(owner)
	// Two edits of one cell, as typing and then a paste: the last value counts, against the value of the owner.
	draft.onCellEdit([edit(a, 'price', 3)])
	draft.onCellEdit([edit({ ...a, price: 3 }, 'price', 4), edit(b, 'price', 1)])
	const edits = draft.save()
	expect(edits.map((each) => [each.rowId, each.columnId, each.previous, each.value])).toEqual([
		['a', 'price', 2, 4],
	])
	expect(edits[0]?.row).toBe(a)
	expect(draft.count.value).toBe(0)
	owner.value = applyEdits(owner.value, edits)
	expect(owner.value[0]).toEqual({ id: 'a', name: 'Bolt', price: 4 })
})

test('over new rows of the owner the draft stays, a value that the owner now has differs no more, and a row that is gone is not saved', () => {
	const owner = shallowRef<Item[]>([
		{ id: 'a', name: 'Bolt', price: 2 },
		{ id: 'b', name: 'Nut', price: 1 },
	])
	const [a, b] = owner.value as [Item, Item]
	const draft = useEditDraft(owner)
	draft.onCellEdit([edit(a, 'price', 5), edit(a, 'name', 'Pin'), edit(b, 'price', 9)])
	owner.value = [{ id: 'a', name: 'Pin', price: 3 }]
	expect(draft.rows.value).toEqual([{ id: 'a', name: 'Pin', price: 5 }])
	expect(draft.count.value).toBe(1)
	expect(
		draft.save().map((each) => [each.rowId, each.columnId, each.previous, each.value]),
	).toEqual([['a', 'price', 3, 5]])
})

test('an edit of a row that the draft cannot find throws with the row id, and the draft keeps what it had', () => {
	const owner = shallowRef<Item[]>([{ id: 'a', name: 'Bolt', price: 2 }])
	const [a] = owner.value as [Item]
	const draft = useEditDraft(owner)
	draft.onCellEdit([edit(a, 'price', 5)])
	const child = { id: 'a/1', name: 'Washer', price: 1 }
	expect(() => draft.onCellEdit([edit(a, 'name', 'Pin'), edit(child, 'price', 3)])).toThrow(
		'The draft has no row "a/1" for the edit of column "price": it reads the top level of the rows only. Pass the `getRowId` of the table',
	)
	// The whole report is refused: the edit of the row that was found is not kept either.
	expect(draft.count.value).toBe(1)
	expect(draft.rows.value).toEqual([{ id: 'a', name: 'Bolt', price: 5 }])
	// With the `getRowId` of the table, the draft finds the rows.
	const coded = useEditDraft(shallowRef([{ code: 'x', price: 1 }]), { getRowId: (row) => row.code })
	const column: ColumnDef<{ code: string; price: number }> = { id: 'price', header: 'Price' }
	const row = { code: 'x', price: 1 }
	coded.onCellEdit([{ rowId: 'x', columnId: 'price', row, column, value: 4, previous: 1 }])
	expect(coded.count.value).toBe(1)
})

test('a table in the entry mode takes its edits into the draft and shows them', async () => {
	const owner = shallowRef<Item[]>([{ id: 'a', name: 'Bolt', price: 2 }])
	let draft!: ReturnType<typeof useEditDraft<Item>>
	const wrapper = mount(
		defineComponent(() => {
			draft = useEditDraft(owner)
			return () =>
				h(Table<Item>, {
					rows: draft.rows.value,
					columns,
					entry: true,
					'aria-label': 'Items',
					onCellEdit: draft.onCellEdit,
					cellAttrs: (context) =>
						context.kind === 'cell' && draft.changed(context.node.id, context.column.id)
							? { class: 'changed' }
							: undefined,
				})
		}),
		{ attachTo: document.body },
	)
	try {
		expect(wrapper.find('[data-slot="table"]').attributes('data-entry')).toBe('')
		const price = wrapper.find('td[data-column="price"]')
		await price.trigger('pointerdown', { button: 0 })
		await price.trigger('click', { button: 0 })
		const input = wrapper.find('[data-slot="table-editor"]')
		expect(input.exists()).toBe(true)
		;(input.element as HTMLInputElement).value = '7'
		await input.trigger('keydown', { key: 'Enter' })
		await nextTick()
		expect(owner.value[0]?.price).toBe(2)
		expect(draft.count.value).toBe(1)
		expect(wrapper.find('td[data-column="price"]').text()).toBe('7')
		expect(wrapper.find('td[data-column="price"]').classes()).toContain('changed')
	} finally {
		wrapper.unmount()
	}
})

type Line = { id: string; price: number; qty: number; total: unknown; double?: unknown }

const lineColumns: ColumnDef<Line>[] = [
	{ id: 'price', header: 'Price' },
	{ id: 'qty', header: 'Qty' },
	{ id: 'total', header: 'Total' },
	{ id: 'double', header: 'Double' },
]

function mountWithFormulas() {
	const owner = shallowRef<Line[]>([
		{ id: 'a', price: 2, qty: 3, total: 0 },
		{ id: 'b', price: 1.5, qty: 4, total: 6 },
	])
	const ownerFormulas = shallowRef<CellFormulas>({})
	const controller = createTableController()
	const reports: string[] = []
	let draft!: ReturnType<typeof useEditDraft<Line>>
	const wrapper = mount(
		defineComponent(() => {
			draft = useEditDraft(owner, { formulas: ownerFormulas })
			return () =>
				h(Table<Line>, {
					rows: draft.rows.value,
					columns: lineColumns,
					controller,
					formulas: engine,
					editable: true,
					history: true,
					'aria-label': 'Lines',
					cellFormulas: draft.formulas.value,
					onCellFormulasChange: draft.onCellFormulasChange,
					onCellEdit: (edits: readonly CellEdit<Line>[], details: TableEditDetails) => {
						reports.push(details.reason)
						draft.onCellEdit(edits)
					},
				})
		}),
		{ attachTo: document.body },
	)
	const text = (row: number, column: string) =>
		wrapper.findAll('tbody tr')[row]?.find(`td[data-column="${column}"]`).text()
	return { owner, ownerFormulas, controller, reports, draft: () => draft, wrapper, text }
}

const settle = async () => {
	for (let turn = 0; turn < 4; turn++) {
		await nextTick()
		await Promise.resolve()
	}
}

test('a formula waits in the draft with its value, and Cancel puts the formulas and the values of the owner back without a report', async () => {
	const { owner, ownerFormulas, controller, reports, draft, wrapper, text } = mountWithFormulas()
	try {
		await settle()
		void controller.editCell('a', 'total', '=A1*B1')
		await settle()
		expect(text(0, 'total')).toBe('6')
		expect(wrapper.find('tbody td[data-column="total"]').attributes('data-formula')).toBe('')
		expect(draft().changed('a', 'total')).toBe(true)
		expect(draft().count.value).toBe(1)
		expect(ownerFormulas.value).toEqual({})
		expect(owner.value[0]?.total).toBe(0)

		const before = reports.length
		draft().cancel()
		await settle()
		expect(draft().count.value).toBe(0)
		expect(text(0, 'total')).toBe('0')
		expect(controller.getCellFormula('a', 'total')).toBeNull()
		expect(wrapper.find('tbody td[data-column="total"]').attributes('data-formula')).toBeUndefined()
		// No report runs between the table and the draft after a cancel.
		expect(reports.length).toBe(before)
	} finally {
		wrapper.unmount()
	}
})

test('a formula that keeps the value of its cell still differs, counts once, and Save gives it with the formulas to keep', async () => {
	const { ownerFormulas, controller, draft, wrapper } = mountWithFormulas()
	try {
		await settle()
		// 1.5 * 4 is 6, the value that the owner has.
		void controller.editCell('b', 'total', '=A2*B2')
		void controller.editCell('a', 'total', '=A1*B1')
		await settle()
		expect(draft().changed('b', 'total')).toBe(true)
		expect(draft().count.value).toBe(2)
		const saved = draft().save()
		expect(
			saved.map(({ rowId, value, previous, formula }) => ({ rowId, value, previous, formula })),
		).toEqual([
			{ rowId: 'a', value: 6, previous: 0, formula: '=[price]*[qty]' },
			{ rowId: 'b', value: 6, previous: 6, formula: '=[price]*[qty]' },
		])
		expect(saved.formulas?.cells).toEqual({
			a: { total: '=[price]*[qty]' },
			b: { total: '=[price]*[qty]' },
		})
		expect(draft().count.value).toBe(0)
		expect(ownerFormulas.value).toEqual({})
	} finally {
		wrapper.unmount()
	}
})

test('an undo and a redo move the formula of the draft, and new rows of the owner recalculate into the draft', async () => {
	const { owner, controller, draft, wrapper, text } = mountWithFormulas()
	try {
		await settle()
		void controller.editCell('a', 'total', '=A1*B1')
		await settle()
		controller.undo()
		await settle()
		expect(draft().count.value).toBe(0)
		expect(text(0, 'total')).toBe('0')
		controller.redo()
		await settle()
		expect(draft().changed('a', 'total')).toBe(true)
		expect(text(0, 'total')).toBe('6')

		owner.value = owner.value.map((row) => (row.id === 'a' ? { ...row, price: 5 } : row))
		await settle()
		// The formula of the draft follows the new price of the owner: 5 * 3.
		expect(text(0, 'total')).toBe('15')
		expect(
			draft()
				.save()
				.find((edit) => edit.rowId === 'a')?.value,
		).toBe(15)
	} finally {
		wrapper.unmount()
	}
})

test('a formula of a column waits in the draft too, and one that the owner takes differs no more', async () => {
	const { ownerFormulas, controller, draft, wrapper, text } = mountWithFormulas()
	try {
		await settle()
		controller.setColumnFormula('double', '=[price]*2')
		await settle()
		expect(text(0, 'double')).toBe('4')
		expect(draft().changedColumn('double')).toBe(true)
		expect(draft().count.value).toBe(1)
		expect(ownerFormulas.value).toEqual({})
		ownerFormulas.value = { columns: { double: '=[price]*2' } }
		await settle()
		expect(draft().changedColumn('double')).toBe(false)
		expect(draft().count.value).toBe(0)
		expect(text(0, 'double')).toBe('4')
	} finally {
		wrapper.unmount()
	}
})
