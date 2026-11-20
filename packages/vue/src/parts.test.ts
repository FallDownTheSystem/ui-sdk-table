import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { defineComponent, h, nextTick, onUpdated, ref, shallowRef } from 'vue'
import {
	createTableController,
	Table,
	type CellSlotProps,
	type ColumnDef,
	type GroupSlotProps,
	type HeaderSlotProps,
	type SortRule,
} from './index'

type Person = { id: string; name: string; team: string; score: number }

const people: Person[] = [
	{ id: 'a', name: 'Aino', team: 'Design', score: 70 },
	{ id: 'b', name: 'Eero', team: 'Platform', score: 20 },
	{ id: 'c', name: 'Helmi', team: 'Design', score: 45 },
]

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team' },
	{ id: 'score', header: 'Score', sortable: true, aggregate: 'sum' },
]

const bodyText = (wrapper: ReturnType<typeof mount>) =>
	wrapper.findAll('tbody tr').map((row) => row.findAll('td').map((cell) => cell.text()))

test('Table renders real table elements with grid roles', () => {
	const wrapper = mount(() => h(Table<Person>, { rows: people, columns, 'aria-label': 'People' }))

	const root = wrapper.get('table')
	expect(root.attributes('role')).toBe('grid')
	expect(root.attributes('aria-label')).toBe('People')
	// One header row, three rows, and the footer row with the total of `score`.
	expect(root.attributes('aria-rowcount')).toBe('5')
	expect(wrapper.findAll('thead th').map((cell) => cell.text())).toEqual(['Name', 'Team', 'Score'])
	expect(wrapper.get('thead th').attributes('role')).toBe('columnheader')
	expect(bodyText(wrapper)).toEqual([
		['Aino', 'Design', '70'],
		['Eero', 'Platform', '20'],
		['Helmi', 'Design', '45'],
	])
	expect(wrapper.get('tfoot').text()).toBe('135')
	wrapper.unmount()
})

test('two tables with the same rows share no element id, and a row with the id "header" is a data row', () => {
	const rows = [{ id: 'header', name: 'Odd', team: 'Design', score: 1 }, ...people]
	const wrapper = mount(() => [
		h(Table<Person>, { rows, columns, selection: 'single' }),
		h(Table<Person>, { rows, columns, sortChildren: '' as unknown as boolean }),
	])

	const ids = wrapper.findAll('[id]').map((element) => element.attributes('id'))
	expect(new Set(ids).size).toBe(ids.length)
	expect(wrapper.findAll('td[value], tr[value], th[value]')).toHaveLength(0)
	const header = wrapper.get('thead tr')
	expect(header.attributes('aria-rowindex')).toBe('1')
	expect(header.attributes('aria-selected')).toBeUndefined()
	expect(wrapper.get('tbody tr').attributes('aria-selected')).toBe('false')
	wrapper.unmount()
})

test('cell, header and group slots get the row and its state', async () => {
	const wrapper = mount(() =>
		h(
			Table<Person>,
			{ rows: people, columns, defaultGroupBy: ['team'], defaultExpanded: ['group/team=Design'] },
			{
				'col-score': ({ row, value }: CellSlotProps<Person>) =>
					h('b', `${row.name}:${String(value)}`),
				'header-team': ({ label }: HeaderSlotProps<Person>) => h('i', label.toUpperCase()),
				group: ({ text, group, totals }: GroupSlotProps<Person>) =>
					`${text} ${group.leaves.length} ${String(totals.score)}`,
			},
		),
	)

	expect(wrapper.get('table').attributes('role')).toBe('treegrid')
	expect(wrapper.get('thead i').text()).toBe('TEAM')
	expect(bodyText(wrapper)).toEqual([
		['Design 2 115'],
		['Aino', 'Design', 'Aino:70'],
		['Helmi', 'Design', 'Helmi:45'],
		['Platform 1 20'],
	])
	wrapper.unmount()
})

test('v-model follows the state, and a controller drives it', async () => {
	const sort = ref<readonly SortRule[]>([])
	const controller = createTableController()
	const wrapper = mount(() =>
		h(Table<Person>, {
			rows: people,
			columns,
			controller,
			sort: sort.value,
			'onUpdate:sort': (value) => (sort.value = value),
		}),
	)

	await wrapper.get('thead th button').trigger('click')
	expect(sort.value).toEqual([{ id: 'name', desc: false }])
	controller.sortBy('score', 'desc')
	await nextTick()
	expect(sort.value).toEqual([{ id: 'score', desc: true }])
	expect(bodyText(wrapper).map((row) => row[0])).toEqual(['Aino', 'Helmi', 'Eero'])
	expect(wrapper.findAll('thead th')[2]?.attributes('aria-sort')).toBe('descending')
	wrapper.unmount()
})

test('a new selection renders one row, not the table', async () => {
	const renders = new Map<string, number>()
	const Probe = defineComponent({
		props: { id: { type: String, required: true } },
		setup(props) {
			onUpdated(() => renders.set(props.id, (renders.get(props.id) ?? 0) + 1))
			return () => h('span', props.id)
		},
	})
	let tableRenders = 0
	const controller = createTableController()
	const rows = shallowRef(people)
	const wrapper = mount(() => {
		tableRenders++
		return h(
			Table<Person>,
			{ rows: rows.value, columns, controller, selection: 'multiple' },
			{
				'col-name': ({ row, selected }: CellSlotProps<Person>) =>
					h(Probe, { id: row.id, 'data-on': selected }),
			},
		)
	})

	controller.select('b')
	await nextTick()
	expect(wrapper.get('tbody tr[data-selected]').text()).toContain('b')
	expect(wrapper.findAll('tbody tr[aria-selected="true"]')).toHaveLength(1)
	expect([...renders.keys()]).toEqual(['b'])
	expect(tableRenders).toBe(1)
	wrapper.unmount()
})

const nested: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', width: 120 },
	{
		id: 'work',
		header: 'Work',
		columns: [
			{ id: 'team', header: 'Team', width: 100 },
			{ id: 'score', header: 'Score', width: 80, aggregate: 'sum' },
		],
	},
]

test('header groups render as cells that span, and each column has a `col` element', () => {
	const wrapper = mount(() => h(Table<Person>, { rows: people, columns: nested }))

	const rows = wrapper.findAll('thead tr')
	expect(rows.map((row) => row.attributes('aria-rowindex'))).toEqual(['1', '2'])
	expect(rows[0]?.findAll('th').map((cell) => cell.text())).toEqual(['Name', 'Work'])
	expect(rows[1]?.findAll('th').map((cell) => cell.text())).toEqual(['Team', 'Score'])
	expect(rows[0]?.findAll('th')[0]?.attributes('rowspan')).toBe('2')
	expect(rows[0]?.findAll('th')[1]?.attributes('colspan')).toBe('2')
	expect(wrapper.findAll('colgroup col').map((col) => col.attributes('data-column'))).toEqual([
		'name',
		'team',
		'score',
	])
	expect(wrapper.get('tbody tr').attributes('aria-rowindex')).toBe('3')
	// The footer row is a row of the grid, with cells the keyboard can reach.
	expect(wrapper.get('tfoot tr').attributes('aria-rowindex')).toBe('6')
	expect(wrapper.get('tfoot tr').attributes('role')).toBe('row')
	expect(wrapper.findAll('tfoot td').map((cell) => cell.attributes('aria-colindex'))).toEqual([
		'1',
		'2',
		'3',
	])
	expect(wrapper.get('table').attributes('aria-rowcount')).toBe('6')
	wrapper.unmount()
})

test('column state has a v-model for each key, and a resize ends with one commit', async () => {
	const visibility = ref<Record<string, boolean>>({})
	const order = ref<readonly string[]>([])
	const pinning = ref<{ start?: readonly string[]; end?: readonly string[] }>({})
	const commits: unknown[] = []
	const controller = createTableController()
	const wrapper = mount(() =>
		h(Table<Person>, {
			rows: people,
			columns,
			controller,
			columnVisibility: visibility.value,
			'onUpdate:columnVisibility': (value) => (visibility.value = value),
			columnOrder: order.value,
			'onUpdate:columnOrder': (value) => (order.value = value),
			columnPinning: pinning.value,
			'onUpdate:columnPinning': (value) => (pinning.value = value),
			onColumnWidthsCommit: (value) => commits.push(value),
		}),
	)
	const headers = () => wrapper.findAll('thead th').map((cell) => cell.text())

	controller.setColumnVisibility('team', false)
	await nextTick()
	expect(visibility.value).toEqual({ team: false })
	expect(headers()).toEqual(['Name', 'Score'])
	expect(bodyText(wrapper)[0]).toEqual(['Aino', '70'])

	controller.setColumnOrder(['score'])
	await nextTick()
	expect(order.value).toEqual(['score'])
	expect(headers()).toEqual(['Score', 'Name'])

	controller.pinColumn('name', 'start')
	await nextTick()
	expect(pinning.value).toEqual({ start: ['name'], end: [] })
	expect(headers()).toEqual(['Name', 'Score'])
	expect(wrapper.get('tbody td').attributes('data-pinned')).toBe('start')

	controller.setColumnWidth('name', 200)
	await nextTick()
	expect(commits).toEqual([{ name: 200 }])
	expect(wrapper.get('col[data-column="name"]').attributes('style')).toContain('200px')
	wrapper.unmount()
})

test('a resize handle shows only for a column that can be resized', () => {
	const mixed: ColumnDef<Person>[] = [
		{ id: 'name', header: 'Name' },
		{ id: 'team', header: 'Team', resizable: false },
	]
	const wrapper = mount(() =>
		h(Table<Person>, {
			rows: people,
			columns: mixed,
			resizable: '' as unknown as boolean,
			messages: { resizeColumn: (column) => `Muuta leveyttä: ${column}` },
		}),
	)
	const handles = wrapper.findAll('[data-slot="table-resizer"]')
	expect(handles.map((handle) => handle.attributes('data-column'))).toEqual(['name'])
	expect(handles[0]?.attributes('role')).toBe('separator')
	expect(handles[0]?.attributes('aria-label')).toBe('Muuta leveyttä: Name')
	wrapper.unmount()

	const plain = mount(() => h(Table<Person>, { rows: people, columns: mixed }))
	expect(plain.findAll('[data-slot="table-resizer"]')).toHaveLength(0)
	plain.unmount()
})

test('a table without rows has one row that says so, and it is a row of the grid', () => {
	const wrapper = mount(() => h(Table<Person>, { rows: [], columns }))
	const row = wrapper.get('tbody tr')
	expect(row.attributes('role')).toBe('row')
	expect(row.attributes('aria-rowindex')).toBe('2')
	expect(row.get('td').attributes('colspan')).toBe('3')
	expect(row.get('td').attributes('role')).toBe('gridcell')
	expect(row.text()).toBe('No rows.')
	// The header row, the row that says "no rows", and the footer row.
	expect(wrapper.get('table').attributes('aria-rowcount')).toBe('3')
	wrapper.unmount()

	const translated = mount(() =>
		h(Table<Person>, { rows: [], columns, messages: { noRows: () => 'Ei rivejä.' } }),
	)
	expect(translated.get('tbody tr').text()).toBe('Ei rivejä.')
	translated.unmount()
})
