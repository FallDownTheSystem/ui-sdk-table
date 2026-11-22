import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { applyEdits, Table, useEditDraft, type CellEdit, type ColumnDef } from './index'

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
		await price.trigger('click')
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
