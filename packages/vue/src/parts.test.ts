import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { defineComponent, h, nextTick, onUpdated, ref, shallowRef } from 'vue'
import {
	createTableController,
	Table,
	type CellSlotProps,
	type ColumnDef,
	type DetailSlotProps,
	type FilterState,
	type GroupSlotProps,
	type HeaderSlotProps,
	type PageState,
	type RowPinning,
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
	let mark = 0
	const controller = createTableController()
	const rows = shallowRef(people)
	const wrapper = mount(
		() => {
			tableRenders++
			return h(
				Table<Person>,
				{ rows: rows.value, columns, controller, selection: 'multiple' },
				{
					// The mark is new at each call, so a cell that renders again always updates its probe.
					'col-name': ({ row }: CellSlotProps<Person>) =>
						h(Probe, { id: row.id, 'data-mark': ++mark }),
				},
			)
		},
		{ attachTo: document.body },
	)

	controller.select('b')
	await nextTick()
	expect(wrapper.get('tbody tr[data-selected]').text()).toContain('b')
	expect(wrapper.findAll('tbody tr[aria-selected="true"]')).toHaveLength(1)
	expect([...renders.keys()]).toEqual(['b'])
	expect(tableRenders).toBe(1)

	// A cell that gets focus renders that cell, and no other row.
	renders.clear()
	const cell = wrapper.findAll('tbody tr')[2]?.find('td').element
	if (cell instanceof HTMLElement) cell.focus()
	await nextTick()
	expect(wrapper.findAll('tbody td[data-active]')).toHaveLength(1)
	expect([...renders.keys()]).toEqual(['c'])
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

test('a page that arrives together with a new filter stays, also when a cell is active', async () => {
	const many = Array.from({ length: 60 }, (_item, index) => ({
		id: `p${index}`,
		name: index < 30 ? `Aino ${index}` : `Eero ${index}`,
		team: 'Design',
		score: index,
	}))
	const filter = shallowRef<FilterState>({})
	const page = shallowRef<PageState | undefined>({ page: 1, pageSize: 25 })
	const wrapper = mount(
		() =>
			h(Table<Person>, {
				rows: many,
				columns,
				filter: filter.value,
				page: page.value,
				'onUpdate:page': (value) => (page.value = value),
			}),
		{ attachTo: document.body },
	)
	// The active cell is on a row that the next list does not have.
	const cell = wrapper.findAll('tbody tr')[20]?.find('td').element as HTMLElement
	cell.focus()
	await nextTick()

	filter.value = { search: 'Aino' }
	page.value = { page: 2, pageSize: 25 }
	await nextTick()
	await nextTick()
	expect(page.value).toEqual({ page: 2, pageSize: 25 })
	expect(wrapper.findAll('tbody tr')).toHaveLength(5)
	wrapper.unmount()
})

test('a new column width renders no row', async () => {
	let rowRenders = 0
	const Probe = defineComponent({
		setup() {
			onUpdated(() => rowRenders++)
			return () => h('span', 'x')
		},
	})
	const controller = createTableController()
	const wrapper = mount(() =>
		h(
			Table<Person>,
			{ rows: people, columns: nested, controller },
			{ 'col-name': () => h(Probe, { 'data-at': Math.random() }) },
		),
	)
	controller.setColumnWidth('name', 200)
	await nextTick()
	const style = () => wrapper.get('table').attributes('style')?.replaceAll(' ', '')
	expect(style()).toContain('--table-width:380px')
	expect(wrapper.get('col[data-column="name"]').attributes('style')).toContain('200px')
	expect(rowRenders).toBe(0)
	// A change that renders the table leaves the width as the state has it.
	controller.setColumnVisibility('score', false)
	await nextTick()
	expect(style()).toContain('--table-width:300px')
	controller.resetColumnWidths()
	await nextTick()
	expect(style()).toContain('--table-width:220px')
	wrapper.unmount()
})

test('with a row window, the body holds the rows of the window and a spacer for the rest', async () => {
	const many = Array.from({ length: 500 }, (_item, index) => ({
		id: `p${index}`,
		name: `Person ${index}`,
		team: 'Design',
		score: index,
	}))
	const pinning = ref<RowPinning>({})
	const controller = createTableController()
	const wrapper = mount(
		() =>
			h(Table<Person>, {
				rows: many,
				columns,
				controller,
				rowWindow: true,
				rowHeight: 20,
				overscan: 2,
				rowPinning: pinning.value,
				'onUpdate:rowPinning': (value) => (pinning.value = value),
			}),
		{ attachTo: document.body },
	)
	await nextTick()
	const body = () =>
		wrapper.findAll('tbody tr').map((row) => {
			if (row.attributes('data-slot') === 'table-spacer') return 'spacer'
			return row.find('td').text()
		})
	const table = wrapper.get('table')
	expect(table.attributes('aria-rowcount')).toBe('502')
	expect(table.attributes('data-row-window')).toBe('')
	const rendered = body()
	expect(rendered[0]).toBe('spacer')
	expect(rendered[1]).toBe('Person 0')
	expect(rendered.at(-1)).toBe('spacer')
	expect(rendered.length).toBeLessThan(60)
	const last = wrapper.findAll('tbody tr').at(-1)
	expect(last?.attributes('aria-hidden')).toBe('true')
	expect(last?.attributes('style')).toMatch(/--table-spacer-size:\s*\d+px/)
	expect(last?.findAll('td')).toHaveLength(0)

	// A pinned row comes before the first spacer, with the next row index after the header.
	controller.pinRow('p400', 'top')
	// The caller owns the state, so the next change waits until the value came back.
	await nextTick()
	controller.pinRow('p401', 'bottom')
	await nextTick()
	expect(pinning.value).toEqual({ top: ['p400'], bottom: ['p401'] })
	const rows = body()
	expect(rows.slice(0, 3)).toEqual(['Person 400', 'spacer', 'Person 0'])
	expect(rows.slice(-2)).toEqual(['spacer', 'Person 401'])
	const first = wrapper.get('tbody tr')
	expect(first.attributes('aria-rowindex')).toBe('2')
	expect(first.attributes('data-pinned')).toBe('top')
	expect(wrapper.findAll('tbody tr')[2]?.attributes('aria-rowindex')).toBe('3')
	expect(wrapper.findAll('tbody tr').at(-1)?.attributes('aria-rowindex')).toBe('501')
	expect(table.attributes('aria-rowcount')).toBe('502')
	wrapper.unmount()
})

test('a detail row renders the `detail` slot in one wide cell, and sticky rows are marked', async () => {
	const expanded = ref<readonly string[]>([])
	const hasDetail = (row: Person) => row.id !== 'c'
	const wrapper = mount(() =>
		h(
			Table<Person>,
			{
				rows: people,
				columns,
				hasDetail,
				stickyHeader: '' as unknown as boolean,
				stickyFooter: true,
				expanded: expanded.value,
				'onUpdate:expanded': (value) => (expanded.value = value),
			},
			{
				'col-name': ({ text, expandable, toggleExpanded }: CellSlotProps<Person>) =>
					expandable ? h('button', { onClick: toggleExpanded }, text) : text,
				detail: ({ row }: DetailSlotProps<Person>) => h('p', `More about ${row.name}`),
			},
		),
	)
	expect(wrapper.get('thead tr').attributes('data-sticky')).toBe('top')
	expect(wrapper.get('tfoot tr').attributes('data-sticky')).toBe('bottom')
	expect(wrapper.get('tfoot tr').attributes('data-kind')).toBe('footer')
	expect(wrapper.findAll('tbody button')).toHaveLength(2)

	await wrapper.get('tbody button').trigger('click')
	expect(expanded.value).toEqual(['a'])
	const detail = wrapper.get('tbody tr[data-kind="detail"]')
	expect(detail.attributes('aria-rowindex')).toBe('3')
	expect(detail.findAll('td')).toHaveLength(1)
	expect(detail.get('td').attributes('colspan')).toBe('3')
	expect(detail.text()).toBe('More about Aino')
	expect(wrapper.get('tbody tr').attributes('aria-expanded')).toBe('true')
	expect(wrapper.get('table').attributes('aria-rowcount')).toBe('6')
	// A table with detail rows and no tree rows stays a grid.
	expect(wrapper.get('table').attributes('role')).toBe('grid')

	await wrapper.get('tbody button').trigger('click')
	expect(wrapper.findAll('tbody tr[data-kind="detail"]')).toHaveLength(0)
	wrapper.unmount()
})
