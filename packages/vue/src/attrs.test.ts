import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { defineComponent, h, nextTick, onUpdated } from 'vue'
import {
	createTableController,
	Table,
	type CellAttrsContext,
	type CellSlotProps,
	type ColumnDef,
	type FootSlotProps,
	type GroupSlotProps,
	type RowAttrsContext,
} from './index'

type Person = { id: string; name: string; team: string; score: number }

const people: Person[] = [
	{ id: 'a', name: 'Aino', team: 'Design', score: 70 },
	{ id: 'b', name: 'Eero', team: 'Platform', score: 20 },
	{ id: 'c', name: 'Helmi', team: 'Design', score: 45 },
]
const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'team', header: 'Team' },
	{ id: 'score', header: 'Score', aggregate: 'sum' },
]

const rowAttrs = (context: RowAttrsContext<Person>) => {
	if (context.kind === 'row') {
		return {
			class: ['row', context.row.score < 30 ? 'low' : ''],
			'data-place': context.index,
		}
	}
	if (context.kind === 'group') return { class: `group level-${context.level}` }
	if (context.kind === 'detail') return { class: 'detail', 'data-of': context.row.id }
	return { class: context.kind }
}

const cellAttrs = (context: CellAttrsContext<Person>) => {
	if (context.kind === 'cell') {
		return {
			class: `cell ${context.column.id}`,
			'data-high': typeof context.value === 'number' && context.value > 50 ? '' : undefined,
		}
	}
	if (context.kind === 'header') return { class: `head ${context.column.id}` }
	if (context.kind === 'foot') return { class: `total ${context.column.id}` }
	return { class: `${context.kind}-cell` }
}

test('rows, cells and sections take attributes from the caller, beside the attributes of the parts', () => {
	const wrapper = mount(() =>
		h(Table<Person>, {
			rows: people,
			columns,
			rowAttrs,
			cellAttrs,
			sectionAttrs: {
				head: { class: 'top' },
				body: { class: 'middle' },
				foot: { class: 'bottom' },
			},
		}),
	)
	expect(wrapper.get('thead').classes()).toContain('top')
	expect(wrapper.get('tbody').classes()).toContain('middle')
	expect(wrapper.get('tfoot').classes()).toContain('bottom')
	expect(wrapper.get('thead tr').classes()).toContain('header')
	expect(wrapper.get('thead th').classes()).toEqual(['head', 'name'])
	// The role and the slot name of the part stay.
	expect(wrapper.get('thead th').attributes('role')).toBe('columnheader')

	const rows = wrapper.findAll('tbody tr')
	expect(rows.map((row) => row.classes())).toEqual([['row'], ['row', 'low'], ['row']])
	expect(rows.map((row) => row.attributes('data-place'))).toEqual(['0', '1', '2'])
	expect(rows[0]?.attributes('data-slot')).toBe('table-row')
	expect(rows[0]?.findAll('td').map((cell) => cell.classes())).toEqual([
		['cell', 'name'],
		['cell', 'team'],
		['cell', 'score'],
	])
	expect(rows[0]?.findAll('td')[2]?.attributes('data-high')).toBe('')
	expect(rows[1]?.findAll('td')[2]?.attributes('data-high')).toBeUndefined()

	expect(wrapper.get('tfoot tr').classes()).toContain('foot')
	expect(wrapper.findAll('tfoot td')[2]?.classes()).toEqual(['total', 'score'])
	wrapper.unmount()
})

test('group rows, detail rows and the row of an empty table take attributes too', async () => {
	const controller = createTableController()
	const grouped = mount(() =>
		h(Table<Person>, { rows: people, columns, controller, rowAttrs, cellAttrs, groupBy: ['team'] }),
	)
	controller.expandAll()
	await nextTick()
	const groups = grouped.findAll('tbody tr.group')
	expect(groups).toHaveLength(2)
	expect(groups[0]?.classes()).toContain('level-0')
	expect(groups[0]?.get('td').classes()).toContain('group-cell')
	// A data row under a group counts its place among all rows of the body.
	expect(grouped.findAll('tbody tr').map((row) => row.attributes('data-place'))).toEqual([
		undefined,
		'1',
		'2',
		undefined,
		'4',
	])
	grouped.unmount()

	const detailed = mount(() =>
		h(
			Table<Person>,
			{ rows: people, columns, rowAttrs, cellAttrs, expanded: ['b'], hasDetail: () => true },
			{ detail: () => 'More' },
		),
	)
	await nextTick()
	const detail = detailed.get('tbody tr.detail')
	expect(detail.attributes('data-of')).toBe('b')
	expect(detail.get('td').classes()).toContain('detail-cell')
	detailed.unmount()

	const empty = mount(() => h(Table<Person>, { rows: [], columns, rowAttrs, cellAttrs }))
	expect(empty.get('tbody tr').classes()).toContain('empty')
	expect(empty.get('tbody td').classes()).toContain('empty-cell')
	empty.unmount()
})

test('a new selection does not ask for the attributes again, and renders one row', async () => {
	const renders = new Map<string, number>()
	const Probe = defineComponent({
		props: { id: { type: String, required: true } },
		setup(props) {
			onUpdated(() => renders.set(props.id, (renders.get(props.id) ?? 0) + 1))
			return () => h('span', props.id)
		},
	})
	let asked = 0
	let mark = 0
	const counting = (context: RowAttrsContext<Person>) => {
		asked++
		return rowAttrs(context)
	}
	const controller = createTableController()
	const wrapper = mount(
		() =>
			h(
				Table<Person>,
				{ rows: people, columns, controller, selection: 'multiple', rowAttrs: counting, cellAttrs },
				{
					'col-name': ({ row }: CellSlotProps<Person>) =>
						h(Probe, { id: row.id, 'data-mark': ++mark }),
				},
			),
		{ attachTo: document.body },
	)
	const before = asked
	controller.select('b')
	await nextTick()
	expect(asked).toBe(before)
	expect([...renders.keys()]).toEqual(['b'])
	// The state of the row is on the part, so a class of the caller can follow it.
	expect(wrapper.get('tbody tr[data-selected]').classes()).toContain('low')
	wrapper.unmount()
})

test('the footer slot gets the totals of every column', () => {
	const wrapper = mount(() =>
		h(
			Table<Person>,
			{ rows: people, columns: [...columns, { id: 'id', header: 'People', aggregate: 'count' }] },
			{
				'foot-name': ({ totals }: FootSlotProps<Person>) =>
					`${String(totals.score)} over ${String(totals.id)}`,
			},
		),
	)
	expect(wrapper.get('tfoot td').text()).toBe('135 over 3')
	wrapper.unmount()
})

test('the group slot gets the totals of its rows as text, with the format of each column', () => {
	const wrapper = mount(() =>
		h(
			Table<Person>,
			{
				rows: people,
				columns: [
					{ id: 'name' },
					{ id: 'team' },
					{ id: 'score', aggregate: 'sum', format: 'decimal', formatOptions: { locale: 'en-US' } },
					{ id: 'id', aggregate: 'count', format: 'decimal' },
				],
				groupBy: ['team'],
			},
			{
				group: ({ text, totalTexts }: GroupSlotProps<Person>) =>
					`${text}: ${totalTexts.score} of ${totalTexts.id}`,
			},
		),
	)
	expect(wrapper.findAll('tbody td').map((cell) => cell.text())).toEqual([
		'Design: 115.00 of 2',
		'Platform: 20.00 of 1',
	])
	wrapper.unmount()
})
