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

test('a new selection asks for no row attributes again, and for the cell attributes of one row', async () => {
	const renders = new Map<string, number>()
	const Probe = defineComponent({
		props: { id: { type: String, required: true } },
		setup(props) {
			onUpdated(() => renders.set(props.id, (renders.get(props.id) ?? 0) + 1))
			return () => h('span', props.id)
		},
	})
	const asked = { rows: 0, cells: 0 }
	let mark = 0
	const countingRows = (context: RowAttrsContext<Person>) => {
		asked.rows++
		return rowAttrs(context)
	}
	const countingCells = (context: CellAttrsContext<Person>) => {
		asked.cells++
		return cellAttrs(context)
	}
	const controller = createTableController()
	const wrapper = mount(
		() =>
			h(
				Table<Person>,
				{
					rows: people,
					columns,
					controller,
					selection: 'multiple',
					rowAttrs: countingRows,
					cellAttrs: countingCells,
				},
				{
					'col-name': ({ row }: CellSlotProps<Person>) =>
						h(Probe, { id: row.id, 'data-mark': ++mark }),
				},
			),
		{ attachTo: document.body },
	)
	asked.rows = 0
	asked.cells = 0
	controller.select('b')
	await nextTick()
	// The selection is state of the row part: the table does not render its
	// rows again, and the one row whose state changed renders its own cells.
	expect(asked).toEqual({ rows: 0, cells: columns.length })
	expect([...renders.keys()]).toEqual(['b'])
	// The state of the row is on the part, so a class of the caller can follow it.
	expect(wrapper.get('tbody tr[data-selected]').classes()).toContain('low')
	wrapper.unmount()
})

test('attributes of the caller cannot take the place of what the table sets itself', () => {
	const plain = mount(() => h(Table<Person>, { rows: people, columns, selection: 'multiple' }), {
		attachTo: document.body,
	})
	const read = (wrapper: typeof plain) => ({
		rows: wrapper.findAll('tbody tr').map((row) => ({
			index: row.attributes('aria-rowindex'),
			role: row.attributes('role'),
			selected: row.attributes('aria-selected'),
			tabindex: row.attributes('tabindex'),
			text: row.text(),
		})),
		cells: wrapper.findAll('tbody tr:first-child td, thead th').map((cell) => ({
			role: cell.attributes('role'),
			colspan: cell.attributes('colspan'),
			colindex: cell.attributes('aria-colindex'),
			sort: cell.attributes('aria-sort'),
			pinned: cell.attributes('data-pinned'),
			slot: cell.attributes('data-slot'),
			tabindex: cell.attributes('tabindex'),
		})),
	})
	const expected = read(plain)
	plain.unmount()

	const wrapper = mount(
		() =>
			h(Table<Person>, {
				rows: people,
				columns,
				selection: 'multiple',
				rowAttrs: () => ({
					// Props of the row part, and state that the table shows.
					value: 'a',
					index: 5,
					key: 'same',
					role: 'presentation',
					tabindex: '0',
					'aria-selected': 'true',
					'aria-rowindex': '99',
					'data-selected': '',
					'data-slot': 'mine',
					// Attributes that are the caller's own.
					class: 'mine',
					title: 'A row',
					'data-tone': 'calm',
				}),
				cellAttrs: () => ({
					value: 'r|a|name',
					row: 0,
					col: 0,
					colspan: 3,
					role: 'presentation',
					tabindex: '0',
					'aria-colindex': '99',
					'aria-sort': 'none',
					'data-pinned': 'start',
					'data-slot': 'mine',
					class: 'mine',
					'aria-describedby': 'note',
				}),
				sectionAttrs: { body: { role: 'presentation', 'data-slot': 'mine', class: 'mine' } },
			}),
		{ attachTo: document.body },
	)
	expect(read(wrapper)).toEqual(expected)
	const row = wrapper.get('tbody tr')
	expect(row.classes()).toContain('mine')
	expect(row.attributes()).toMatchObject({ title: 'A row', 'data-tone': 'calm' })
	expect(row.attributes('data-selected')).toBeUndefined()
	const cell = wrapper.get('tbody td')
	expect(cell.classes()).toContain('mine')
	expect(cell.attributes('aria-describedby')).toBe('note')
	const body = wrapper.get('tbody')
	expect(body.attributes()).toMatchObject({ role: 'rowgroup', 'data-slot': 'table-body' })
	expect(body.classes()).toContain('mine')
	wrapper.unmount()
})

test('`subscribe` waits for the table when it is called before the table exists', async () => {
	const controller = createTableController()
	const seen: (readonly string[])[] = []
	const stop = controller.subscribe((changed) => seen.push(changed))
	const other = controller.subscribe(() => seen.push(['other']))
	expect(typeof stop).toBe('function')
	// A listener that was stopped while it waited never runs.
	other()
	expect(() => controller.subscribe(undefined as never)).toThrow('`subscribe` takes a function.')

	const wrapper = mount(() => h(Table<Person>, { rows: people, columns, controller }), {
		attachTo: document.body,
	})
	await nextTick()
	// The table arrived: the listener runs once, with no key, and can read the view.
	expect(seen).toEqual([[]])
	expect(controller.getView().rowCount).toBe(people.length)
	controller.sortBy('name')
	expect(seen).toHaveLength(2)
	expect(seen[1]).toContain('sort')
	stop()
	controller.sortBy('name', 'desc')
	expect(seen).toHaveLength(2)

	// With the table on the page, `subscribe` answers with the stop function at once.
	const later = controller.subscribe((changed) => seen.push(changed))
	controller.sortBy('name', 'asc')
	expect(seen).toHaveLength(3)
	wrapper.unmount()
	// The table is gone: its listeners are released, and a call does nothing.
	controller.sortBy('name', 'desc')
	expect(seen).toHaveLength(3)
	later()
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
