import { createAgent } from '@ui-sdk/vue/agent'
import { mount } from '@vue/test-utils'
import { afterEach, expect, test, vi } from 'vite-plus/test'
import { h, nextTick, type Component } from 'vue'
import {
	createTableController,
	DataTable,
	type DataTableColumn,
	type DataTableProps,
} from '../data-table'

const writers = vi.hoisted(() => ({
	downloadCsv: vi.fn<(data: unknown, filename?: string) => void>(),
	downloadXlsx: vi.fn<(data: unknown, filename?: string) => Promise<void>>(async () => {}),
}))
vi.mock('ui-sdk-table-vue/export', () => writers)

// The type-aware lint does not read `.vue` files, so it sees a component without a row type.
// The tests take the table as a plain component; the docs pages check its props.
const Styled: Component = DataTable

type Person = {
	id: string
	name: string
	team: string
	score: number
	joined: string
	reports?: Person[]
}

const teams = ['Design', 'Platform', 'Support']
const people: Person[] = Array.from({ length: 9 }, (_, index) => ({
	id: `p${index + 1}`,
	name: `Person ${index + 1}`,
	team: teams[index % 3] ?? 'Design',
	score: (index + 1) * 10,
	joined: `2024-0${index + 1}-15`,
	reports:
		index === 0
			? [{ id: 'r1', name: 'Report 1', team: 'Design', score: 1, joined: '2025-01-01' }]
			: undefined,
}))

const columns: DataTableColumn<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team', filter: 'select' },
	{ id: 'score', header: 'Score', format: 'integer', sortable: true },
	{ id: 'joined', header: 'Joined', format: 'date' },
]

let unmount: (() => void) | undefined
afterEach(() => {
	unmount?.()
	writers.downloadCsv.mockClear()
	writers.downloadXlsx.mockClear()
})

test('an agent finds the styled table by its name and operates each of its controls', async () => {
	const controller = createTableController()
	const wrapper = mount(
		() =>
			h(Styled, {
				rows: people,
				columns,
				controller,
				label: 'People',
				search: true,
				columnFilters: true,
				columnMenu: true,
				export: { filename: 'people' },
				pagination: true,
				pageSizes: [3, 6],
				selection: 'multiple',
				getChildren: (row: Person) => row.reports,
			} satisfies DataTableProps<Person>),
		{ attachTo: document.body },
	)
	unmount = () => wrapper.unmount()
	await nextTick()

	const agent = createAgent()
	const view = () => controller.getView()
	const firstNames = () =>
		wrapper.findAll('tbody tr').map((row) => row.findAll('td')[2]?.text() ?? '')
	const seen = (label: string) => agent.snapshot().find((component) => component.label === label)

	async function act(ref: string, action: string, ...args: unknown[]) {
		const result = await agent.act({ steps: [{ ref, action, args }] })
		await nextTick()
		expect(result.error?.message, `${action} on "${ref}"`).toBeUndefined()
		expect(result.ok, `${action} on "${ref}"`).toBe(true)
		return result
	}

	// The table and each control beside it have a name.
	expect(seen('People')?.component).toBe('table')
	expect(seen('People')?.actions).toEqual(
		expect.arrayContaining([
			'sortBy',
			'setSearch',
			'selectRows',
			'getFacets',
			'clearColumnFilters',
		]),
	)
	for (const label of [
		'Search, People',
		'Filters, People',
		'Columns, People',
		'Export, People',
		'Rows per page, People',
		'Pages, People',
		'Select all 10 rows, People',
		'Select row Person 1',
		'Expand row Person 1',
	]) {
		expect(seen(label), `a control named "${label}"`).toBeDefined()
	}

	// Search.
	await act('Search, People', 'setValue', 'Person 1')
	expect(view().filter.search).toBe('Person 1')
	expect(view().rowCount).toBe(1)
	await act('Search, People', 'clear')
	expect(view().rowCount).toBe(9)

	// Each kind of column filter, inside the popover.
	await act('Filters, People', 'setOpen', true)
	expect(seen('Column filters, People')?.open).toBe(true)
	await act('Filter Name', 'setValue', 'Person')
	expect(view().filter.columns).toEqual({ name: 'Person' })
	// The list offers the values of the column; a value goes by its place in the list.
	expect(seen('Values of Team')?.items).toEqual([
		{ value: '0', label: 'Design' },
		{ value: '1', label: 'Platform' },
		{ value: '2', label: 'Support' },
	])
	await act('Values of Team', 'setValue', ['0', '1'])
	expect(view().filter.columns?.team).toEqual(['Design', 'Platform'])
	await act('Lowest Score', 'setValue', '20')
	await act('Highest Score', 'setValue', '80')
	expect(view().filter.columns?.score).toEqual({ min: 20, max: 80 })
	await act('Joined from', 'setValue', '2024-02-01')
	await act('Joined to', 'setValue', '2024-07-31')
	expect(view().filter.columns?.joined).toEqual({ from: '2024-02-01', to: '2024-07-31' })
	// Persons 2, 4, 5 and 7 are in Design or Platform with a score from 20 to 80.
	expect(view().rowCount).toBe(4)
	await act('Reset filter of Score', 'press')
	expect(view().filter.columns?.score).toBeUndefined()
	await act('Clear all filters', 'press')
	expect(view().rowCount).toBe(9)
	await act('Column filters, People', 'setOpen', false)

	// Column visibility.
	await act('Columns, People', 'setOpen', true)
	expect(seen('Columns, People')?.buttons).toEqual(
		expect.arrayContaining(['Name', 'Team', 'Score', 'Joined', 'Show all']),
	)
	await act('Columns, People', 'press', 'Joined')
	expect(view().visibleColumns.map((column) => column.header)).not.toContain('Joined')
	await act('Columns, People', 'press', 'Show all')
	expect(view().visibleColumns.map((column) => column.header)).toContain('Joined')
	await act('Columns, People', 'setOpen', false)

	// Export.
	await act('Export, People', 'setOpen', true)
	await act('Export, People', 'press', 'Export CSV')
	await vi.waitFor(() => expect(writers.downloadCsv).toHaveBeenCalledTimes(1))
	expect(writers.downloadCsv.mock.calls[0]?.[1]).toBe('people')
	await act('Export, People', 'setOpen', true)
	await act('Export, People', 'press', 'Export Excel')
	await vi.waitFor(() => expect(writers.downloadXlsx).toHaveBeenCalledTimes(1))
	expect(writers.downloadXlsx.mock.calls[0]?.[1]).toBe('people')

	// Page size, next page, previous page.
	expect(view().pageSize).toBe(3)
	await act('Rows per page, People', 'setValue', '6')
	expect(view().pageSize).toBe(6)
	expect(view().pageCount).toBe(2)
	await act('Pages, People', 'next')
	expect(view().page).toBe(2)
	expect(firstNames()).toEqual(['Person 7', 'Person 8', 'Person 9'])
	await act('Pages, People', 'previous')
	expect(view().page).toBe(1)
	// The last and the first page, and a page by its number.
	await act('Rows per page, People', 'setValue', '3')
	expect(view().pageCount).toBe(3)
	await act('Pages, People', 'last')
	expect(view().page).toBe(3)
	await act('Pages, People', 'first')
	expect(view().page).toBe(1)
	await act('Pages, People', 'setPage', 2)
	expect(view().page).toBe(2)
	expect(firstNames()).toEqual(['Person 4', 'Person 5', 'Person 6'])
	await act('Rows per page, People', 'setValue', '6')

	// Select all, then one row.
	await act('Select all 10 rows, People', 'setChecked', true)
	// The nine rows and the child row of the first one.
	expect(view().selected).toHaveLength(10)
	await act('Select all 10 rows, People', 'setChecked', false)
	expect(view().selected).toEqual([])
	await act('Select row Person 2', 'setChecked', true)
	expect(view().selected).toEqual(['p2'])

	// A sort header. Its name is the name of its column, which the other
	// controls of the header row have in their row text, and the agent reads
	// a name against the row text too. So it takes the ref of the button
	// from its snapshot. The button of a group row is found the same way.
	const header = (label: string) => {
		const found = agent
			.snapshot()
			.find((component) => component.component === 'button' && component.label === label)
		expect(found, `a button named "${label}"`).toBeDefined()
		return found?.ref ?? ''
	}
	await act(header('Score'), 'press')
	expect(view().sort).toEqual([{ id: 'score', desc: false }])
	await act(header('Score'), 'press')
	expect(view().sort).toEqual([{ id: 'score', desc: true }])
	expect(firstNames()[0]).toBe('Person 9')
	await act(header('Name'), 'press')
	expect(view().sort).toEqual([{ id: 'name', desc: false }])

	// An expand button.
	await act('Expand row Person 1', 'press')
	expect(view().expanded).toEqual(['p1'])
	expect(firstNames()).toContain('Report 1')
	await act('Collapse row Person 1', 'press')
	expect(view().expanded).toEqual([])
	await act('Expand all rows, People', 'press')
	expect(view().expanded).toEqual(['p1'])

	// A group row: its checkbox selects its rows, and its button opens and closes it.
	controller.clearSelection()
	controller.setGroupBy(['team'])
	await nextTick()
	expect(seen('Select group Design')).toBeDefined()
	await act('Select group Design', 'setChecked', true)
	// Persons 1, 4 and 7 are in Design; the child row of the first one is not a row of the group.
	expect([...view().selected].sort()).toEqual(['p1', 'p4', 'p7'])
	await act('Select group Design', 'setChecked', false)
	expect(view().selected).toEqual([])
	await act(header('Design (3)'), 'press')
	expect(view().expanded).toContain('group/team=Design')
	expect(firstNames()).toContain('Person 4')
	await act(header('Design (3)'), 'press')
	expect(view().expanded).not.toContain('group/team=Design')

	// A wrong argument comes back as a message that says what is valid.
	const failed = await agent.act({
		steps: [{ ref: 'People', action: 'getFacets', args: ['age'] }],
	})
	expect(failed.ok).toBe(false)
	expect(failed.error?.message).toContain('No column "age" to read the facets of. Columns:')
})

test('an agent tells the controls of two tables on one page apart by their names', async () => {
	const first = createTableController()
	const second = createTableController()
	const table = (label: string, controller: typeof first) =>
		h(Styled, {
			rows: people,
			columns,
			controller,
			label,
			search: true,
			columnFilters: true,
			columnMenu: true,
			export: true,
			pagination: true,
			pageSizes: [3, 6],
			selection: 'multiple',
			getChildren: (row: Person) => row.reports,
		} satisfies DataTableProps<Person>)
	const wrapper = mount(() => h('div', [table('Staff', first), table('Guests', second)]), {
		attachTo: document.body,
	})
	unmount = () => wrapper.unmount()
	await nextTick()

	const agent = createAgent()
	async function act(ref: string, action: string, ...args: unknown[]) {
		const result = await agent.act({ steps: [{ ref, action, args }] })
		await nextTick()
		expect(result.error?.message, `${action} on "${ref}"`).toBeUndefined()
	}

	// No control of the toolbar or of the pages, and no control for the whole
	// table in the header, shares its name with one of the other table. A sort
	// button has the name of its column and a row control the name of its row;
	// both tables show the same columns and rows here, so those are left out,
	// and an agent reaches them through the table: `toggleSort` on "Staff".
	const perRow = /^(Select|Expand|Collapse) row /
	const sortButtons = new Set(columns.map((column) => column.header))
	const labels = agent
		.snapshot()
		.map((component) => component.label ?? '')
		.filter((label) => !perRow.test(label) && !sortButtons.has(label))
	expect(labels).toContain('Expand all rows, Guests')
	expect(labels.filter((label, index) => labels.indexOf(label) !== index)).toEqual([])

	await act('Guests', 'toggleSort', 'score')
	expect([first.getView().sort, second.getView().sort]).toEqual([
		[],
		[{ id: 'score', desc: false }],
	])
	await act('Select all 10 rows, Guests', 'setChecked', true)
	expect([first.getView().selected.length, second.getView().selected.length]).toEqual([0, 10])
	await act('Search, Staff', 'setValue', 'Person 2')
	expect([first.getView().rowCount, second.getView().rowCount]).toEqual([1, 9])
	await act('Pages, Guests', 'next')
	expect([first.getView().page, second.getView().page]).toEqual([1, 2])
	await act('Columns, Guests', 'setOpen', true)
	await act('Columns, Guests', 'press', 'Team')
	expect(first.getView().visibleColumns.map((column) => column.id)).toContain('team')
	expect(second.getView().visibleColumns.map((column) => column.id)).not.toContain('team')
	await act('Columns, Guests', 'setOpen', false)
	await act('Filters, Staff', 'setOpen', true)
	await act('Filter Name', 'setValue', 'Person')
	expect(first.getView().filter.columns).toEqual({ name: 'Person' })
	expect(second.getView().filter.columns).toBeUndefined()
	await act('Column filters, Staff', 'setOpen', false)
	await act('Export, Guests', 'setOpen', true)
	await act('Export, Guests', 'press', 'Export CSV')
	await vi.waitFor(() => expect(writers.downloadCsv).toHaveBeenCalledTimes(1))
	// The file holds the rows of the second table: every row, without the team column.
	const data = writers.downloadCsv.mock.calls[0]?.[0] as { columns: { id: string }[] }
	expect(data.columns.map((column) => column.id)).toEqual(['name', 'score', 'joined'])
})
