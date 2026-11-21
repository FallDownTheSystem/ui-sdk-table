import { mount } from '@vue/test-utils'
import { afterEach, expect, test, vi } from 'vite-plus/test'
import { h, nextTick, shallowRef, type Component } from 'vue'
import {
	createTableController,
	DataTable,
	type DataTableColumn,
	type DataTableMessages,
	type DataTableProps,
} from '../data-table'

// The writers are a module of their own. The factory runs when the module is
// first imported, so its counter says when the styled table loads them.
const writers = vi.hoisted(() => ({
	loads: 0,
	downloadCsv: vi.fn<(data: unknown, filename?: string) => void>(),
	downloadXlsx: vi.fn<(data: unknown, filename?: string) => Promise<void>>(async () => {}),
}))
vi.mock('ui-sdk-table-vue/export', () => {
	writers.loads++
	return { downloadCsv: writers.downloadCsv, downloadXlsx: writers.downloadXlsx }
})

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

const people: Person[] = [
	{
		id: 'a',
		name: 'Aino',
		team: 'Design',
		score: 70,
		joined: '2024-01-05',
		reports: [{ id: 'a1', name: 'Ilmari', team: 'Design', score: 5, joined: '2024-02-01' }],
	},
	{ id: 'b', name: 'Eero', team: 'Platform', score: 20, joined: '2023-03-01' },
	{ id: 'c', name: 'Helmi', team: 'Design', score: 45, joined: '2022-07-19' },
]

const columns: DataTableColumn<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team', filter: 'select' },
	{ id: 'score', header: 'Score', format: 'integer', aggregate: 'sum' },
	{ id: 'joined', header: 'Joined', format: 'date' },
]

type Props = DataTableProps<Person> & Record<string, unknown>

const mounted: { unmount: () => void }[] = []
afterEach(() => {
	for (const wrapper of mounted.splice(0)) wrapper.unmount()
	writers.downloadCsv.mockClear()
	writers.downloadXlsx.mockClear()
})

function table(props: Props = {}, slots: Record<string, (props: any) => unknown> = {}) {
	const wrapper = mount(
		() => h(Styled, { rows: people, columns, label: 'People', ...props }, slots),
		{ attachTo: document.body },
	)
	mounted.push(wrapper)
	return wrapper
}

/** An element anywhere on the page: a popup is outside the wrapper of its table. */
function onPage(selector: string): HTMLElement {
	const found = document.body.querySelector<HTMLElement>(selector)
	if (!found) throw new Error(`Nothing on the page matches ${selector}`)
	return found
}

const byText = (selector: string, text: string): HTMLElement => {
	const found = [...document.body.querySelectorAll<HTMLElement>(selector)].find(
		(element) => element.textContent?.trim() === text,
	)
	if (!found) throw new Error(`No ${selector} with the text "${text}"`)
	return found
}

function type(input: Element, text: string) {
	;(input as HTMLInputElement).value = text
	input.dispatchEvent(new Event('input', { bubbles: true }))
}

const names = (wrapper: ReturnType<typeof table>) =>
	wrapper.findAll('tbody tr[data-kind="row"], tbody tr[aria-selected]').map((row) => {
		const cells = row.findAll('td')
		return cells.map((cell) => cell.text()).find((text) => text !== '') ?? ''
	})

test('the table has the name of its label, and a plain table has no toolbar and no pages', async () => {
	const wrapper = table()
	await nextTick()

	expect(wrapper.get('table').attributes('aria-label')).toBe('People')
	expect(wrapper.find('[data-slot="data-table-toolbar"]').exists()).toBe(false)
	expect(wrapper.find('[data-slot="data-table-pagination"]').exists()).toBe(false)
	expect(wrapper.findAll('thead th').map((cell) => cell.text())).toEqual([
		'Name',
		'Team',
		'Score',
		'Joined',
	])
	// A column of numbers sits at the end, and its total is in the footer.
	expect(wrapper.findAll('thead th')[2]?.classes()).toContain('text-end')
	expect(wrapper.get('tfoot').text()).toBe('135')
})

test('the search field writes the search of the filter, and its button clears it', async () => {
	const filters: unknown[] = []
	const wrapper = table({
		search: true,
		'onUpdate:filter': (value: unknown) => filters.push(value),
	})
	await nextTick()

	const input = wrapper.get('input[aria-label="Search, People"]')
	type(input.element, 'ee')
	await nextTick()
	expect(filters.at(-1)).toEqual({ search: 'ee' })
	expect(names(wrapper)).toEqual(['Eero'])

	await wrapper.get('[aria-label="Clear search"]').trigger('click')
	await nextTick()
	expect(filters.at(-1)).toEqual({ search: '' })
	expect(names(wrapper)).toEqual(['Aino', 'Eero', 'Helmi'])
})

test('each kind of column filter writes the filter of its column', async () => {
	const filter = shallowRef<{ search?: string; columns?: Record<string, unknown> }>({})
	const wrapper = table({
		columnFilters: true,
		'onUpdate:filter': (value: typeof filter.value) => (filter.value = value),
	})
	await nextTick()

	await wrapper.get('[data-slot="popover-trigger"]').trigger('click')
	await nextTick()
	expect(onPage('[data-slot="popover-title"]').textContent).toBe('Column filters')
	expect(
		[...document.body.querySelectorAll('[data-slot="data-table-filter"]')].map((field) =>
			field.getAttribute('data-kind'),
		),
	).toEqual(['text', 'select', 'range', 'dateRange'])

	type(onPage('input[aria-label="Filter Name"]'), 'i')
	await nextTick()
	expect(filter.value.columns).toEqual({ name: 'i' })
	expect(names(wrapper)).toEqual(['Aino', 'Helmi'])

	type(onPage('input[aria-label="Lowest Score"]'), '50')
	await nextTick()
	expect(filter.value.columns).toEqual({ name: 'i', score: { min: 50 } })
	type(onPage('input[aria-label="Highest Score"]'), '80')
	await nextTick()
	expect(filter.value.columns?.score).toEqual({ min: 50, max: 80 })
	expect(names(wrapper)).toEqual(['Aino'])

	// One filter goes away with its own button, the others stay.
	onPage('[aria-label="Reset filter of Score"]').click()
	await nextTick()
	expect(filter.value.columns).toEqual({ name: 'i' })

	type(onPage('input[aria-label="Joined from"]'), '2023-01-01')
	await nextTick()
	expect(filter.value.columns?.joined).toEqual({ from: '2023-01-01' })
	expect(names(wrapper)).toEqual(['Aino'])
	type(onPage('input[aria-label="Joined to"]'), '2023-12-31')
	await nextTick()
	expect(filter.value.columns?.joined).toEqual({ from: '2023-01-01', to: '2023-12-31' })
	expect(names(wrapper)).toEqual([])
	// The body says why it is empty, and offers the way out.
	expect(wrapper.get('[data-slot="data-table-empty"]').text()).toContain(
		'No rows match the current filters.',
	)

	byText('[data-slot="popover-content"] button', 'Clear all filters').click()
	await nextTick()
	expect(filter.value.columns ?? {}).toEqual({})
	expect(names(wrapper)).toEqual(['Aino', 'Eero', 'Helmi'])
	// The trigger says how many filters are set.
	expect(wrapper.get('[data-slot="popover-trigger"]').text()).toBe('Filters')
})

test('the list of values of a select filter holds the values of the column, and a choice filters', async () => {
	const controller = createTableController()
	const wrapper = table({ columnFilters: true, controller })
	await nextTick()

	expect(controller.getFacets('team').values.map((facet) => facet.text)).toEqual([
		'Design',
		'Platform',
	])
	await wrapper.get('[data-slot="popover-trigger"]').trigger('click')
	await nextTick()
	onPage('[aria-label="Values of Team"]').click()
	await nextTick()
	const options = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
	expect(options.map((option) => option.textContent?.trim())).toEqual(['Design', 'Platform'])
	options[1]?.click()
	await nextTick()

	expect(controller.getView().filter.columns).toEqual({ team: ['Platform'] })
	expect(names(wrapper)).toEqual(['Eero'])
	expect(wrapper.get('[data-slot="popover-trigger"]').text()).toBe('1 filter applied')
})

test('the column menu hides and shows columns', async () => {
	const visibility: unknown[] = []
	const wrapper = table({
		columnMenu: true,
		'onUpdate:columnVisibility': (value: unknown) => visibility.push(value),
	})
	await nextTick()

	await wrapper.get('[data-slot="menu-trigger"]').trigger('click')
	await nextTick()
	const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')]
	expect(items.map((item) => item.textContent?.trim())).toEqual(['Name', 'Team', 'Score', 'Joined'])
	expect(items.every((item) => item.getAttribute('aria-checked') === 'true')).toBe(true)

	items[1]?.click()
	await nextTick()
	expect(visibility.at(-1)).toEqual({ team: false })
	expect(wrapper.findAll('thead th').map((cell) => cell.text())).toEqual([
		'Name',
		'Score',
		'Joined',
	])

	byText('[role="menuitem"]', 'Show all').click()
	await nextTick()
	expect(visibility.at(-1)).toEqual({})
	expect(wrapper.findAll('thead th')).toHaveLength(4)
})

test('the export loads its writers on the first export, and not before', async () => {
	const wrapper = table({ export: { filename: 'people' } })
	await nextTick()
	expect(writers.loads).toBe(0)

	await wrapper.get('[data-slot="menu-trigger"]').trigger('click')
	await nextTick()
	expect(writers.loads).toBe(0)

	byText('[role="menuitem"]', 'Export CSV').click()
	await vi.waitFor(() => expect(writers.downloadCsv).toHaveBeenCalledTimes(1))
	expect(writers.loads).toBe(1)
	const [data, filename] = writers.downloadCsv.mock.calls[0] ?? []
	expect(filename).toBe('people')
	expect(
		(data as { columns: { header: string }[] }).columns.map((column) => column.header),
	).toEqual(['Name', 'Team', 'Score', 'Joined'])

	await wrapper.get('[data-slot="menu-trigger"]').trigger('click')
	await nextTick()
	byText('[role="menuitem"]', 'Export Excel').click()
	await vi.waitFor(() => expect(writers.downloadXlsx).toHaveBeenCalledTimes(1))
	expect(writers.downloadXlsx.mock.calls[0]?.[1]).toBe('people')
	// The module is loaded once.
	expect(writers.loads).toBe(1)
})

test('an export can offer one kind of file only', async () => {
	const wrapper = table({ export: { xlsx: false } })
	await nextTick()
	await wrapper.get('[data-slot="menu-trigger"]').trigger('click')
	await nextTick()

	expect(
		[...document.body.querySelectorAll('[role="menuitem"]')].map((item) =>
			item.textContent?.trim(),
		),
	).toEqual(['Export CSV'])
})

test('the pages start on the first page size, and each control of the pages moves the page', async () => {
	const pages: unknown[] = []
	const wrapper = table({
		rows: Array.from({ length: 7 }, (_, index) => ({
			id: `p${index}`,
			name: `Person ${index + 1}`,
			team: 'Design',
			score: index,
			joined: '2024-01-01',
		})),
		pagination: true,
		pageSizes: [2, 5],
		'onUpdate:page': (value: unknown) => pages.push(value),
	})
	await nextTick()

	const bar = wrapper.get('[data-slot="data-table-pagination"]')
	expect(bar.get('[data-slot="data-table-page"]').text()).toBe('Page 1 of 4')
	expect(bar.get('[data-slot="data-table-rows"]').text()).toBe('Showing 1 to 2 of 7 rows')
	expect(names(wrapper)).toEqual(['Person 1', 'Person 2'])

	await bar.get('[aria-label="Next page"]').trigger('click')
	await nextTick()
	expect(pages.at(-1)).toEqual({ page: 2, pageSize: 2 })
	expect(names(wrapper)).toEqual(['Person 3', 'Person 4'])

	await bar.get('[aria-label="Previous page"]').trigger('click')
	await nextTick()
	expect(pages.at(-1)).toEqual({ page: 1, pageSize: 2 })

	await bar.get('[aria-label="Last page"]').trigger('click')
	await nextTick()
	expect(pages.at(-1)).toEqual({ page: 4, pageSize: 2 })
	expect(bar.get('[data-slot="data-table-rows"]').text()).toBe('Showing 7 to 7 of 7 rows')

	await bar.get('[aria-label="First page"]').trigger('click')
	await nextTick()
	await bar.get('[aria-label="Page 3"]').trigger('click')
	await nextTick()
	expect(pages.at(-1)).toEqual({ page: 3, pageSize: 2 })
	expect(bar.get('[aria-label="Page 3"]').attributes('aria-current')).toBe('page')

	await bar.get('[aria-label="Rows per page, People"]').trigger('click')
	await nextTick()
	byText('[role="option"]', '5 per page').click()
	await nextTick()
	expect(pages.at(-1)).toMatchObject({ pageSize: 5 })
	expect(bar.get('[data-slot="data-table-page"]').text()).toMatch(/of 2$/)
	expect(wrapper.findAll('tbody tr').length).toBeLessThanOrEqual(5)
})

test('the checkbox of a row and the checkbox of all rows write the selection', async () => {
	const selected = shallowRef<string[]>([])
	const wrapper = table({
		selection: 'multiple',
		canSelect: (row: Person) => row.id !== 'b',
		'onUpdate:selected': (value: string[]) => (selected.value = value),
	})
	await nextTick()

	const all = wrapper.get('[aria-label="Select all rows"]')
	const aino = wrapper.get('[aria-label="Select row Aino"]')
	// A row that cannot be selected has a checkbox that is off.
	expect(wrapper.get('[aria-label="Select row Eero"]').attributes('aria-disabled')).toBe('true')

	await aino.trigger('click')
	await nextTick()
	expect(selected.value).toEqual(['a'])
	expect(aino.attributes('aria-checked')).toBe('true')
	expect(all.attributes('aria-checked')).toBe('mixed')
	expect(wrapper.get('tbody tr').attributes('data-selected')).toBeDefined()

	await all.trigger('click')
	await nextTick()
	expect([...selected.value].sort()).toEqual(['a', 'c'])
	expect(all.attributes('aria-checked')).toBe('true')

	await all.trigger('click')
	await nextTick()
	expect(selected.value).toEqual([])
	expect(all.attributes('aria-checked')).toBe('false')
})

test('a group row has a checkbox for its rows, its totals and a button that opens it', async () => {
	const controller = createTableController()
	const wrapper = table({
		selection: 'multiple',
		defaultGroupBy: ['team'],
		defaultExpanded: 'all',
		controller,
	})
	await nextTick()

	// `defaultExpanded="all"` opened both groups, so their rows are there.
	expect(names(wrapper)).toEqual(['Aino', 'Helmi', 'Eero'])
	const group = wrapper.get('tbody tr')
	expect(group.text()).toContain('Design (2)')
	expect(group.get('[data-slot="data-table-group-totals"]').text()).toContain('115')

	await group.get('[aria-label="Select group Design"]').trigger('click')
	await nextTick()
	expect([...controller.getView().selected].sort()).toEqual(['a', 'c'])
	expect(wrapper.get('[aria-label="Select all rows"]').attributes('aria-checked')).toBe('mixed')

	await group.get('button[aria-expanded="true"]').trigger('click')
	await nextTick()
	expect(names(wrapper)).toEqual(['Eero'])
})

test('a header button sorts, and a click with Shift adds its column to the sort', async () => {
	const sorts: unknown[] = []
	const sortable = columns.map((column) => ({ ...column, sortable: true }))
	const wrapper = table({
		columns: sortable,
		'onUpdate:sort': (value: unknown) => sorts.push(value),
	})
	await nextTick()

	const header = (text: string) =>
		wrapper.findAll('thead th button').find((button) => button.text() === text)

	await header('Score')?.trigger('click')
	await nextTick()
	expect(sorts.at(-1)).toEqual([{ id: 'score', desc: false }])
	expect(names(wrapper)).toEqual(['Eero', 'Helmi', 'Aino'])
	expect(wrapper.findAll('thead th')[2]?.attributes('aria-sort')).toBe('ascending')

	await header('Score')?.trigger('click')
	await nextTick()
	expect(sorts.at(-1)).toEqual([{ id: 'score', desc: true }])

	await header('Team')?.trigger('click', { shiftKey: true })
	await nextTick()
	expect(sorts.at(-1)).toEqual([
		{ id: 'score', desc: true },
		{ id: 'team', desc: false },
	])
})

test('the button of a row opens its child rows, and the button of the header opens all', async () => {
	const expanded: unknown[] = []
	const wrapper = table({
		getChildren: (row: Person) => row.reports,
		'onUpdate:expanded': (value: unknown) => expanded.push(value),
	})
	await nextTick()

	await wrapper.get('[aria-label="Expand row Aino"]').trigger('click')
	await nextTick()
	expect(expanded.at(-1)).toEqual(['a'])
	expect(names(wrapper)).toEqual(['Aino', 'Ilmari', 'Eero', 'Helmi'])

	await wrapper.get('[aria-label="Collapse row Aino"]').trigger('click')
	await nextTick()
	expect(expanded.at(-1)).toEqual([])

	await wrapper.get('[aria-label="Expand all rows"]').trigger('click')
	await nextTick()
	expect(expanded.at(-1)).toEqual(['a'])
	await wrapper.get('[aria-label="Collapse all rows"]').trigger('click')
	await nextTick()
	expect(expanded.at(-1)).toEqual([])
})

test('a row with a detail row has a button, and the detail slot fills the row', async () => {
	const wrapper = table(
		{ hasDetail: (row: Person) => row.id !== 'b' },
		{ detail: ({ row }: { row: Person }) => h('p', { class: 'detail' }, `About ${row.name}`) },
	)
	await nextTick()

	expect(wrapper.find('[aria-label="Expand row Eero"]').exists()).toBe(false)
	await wrapper.get('[aria-label="Expand row Helmi"]').trigger('click')
	await nextTick()
	expect(wrapper.get('p.detail').text()).toBe('About Helmi')
})

test('the texts of the controls and of the table change with `messages` at run time', async () => {
	const messages = shallowRef<Partial<DataTableMessages>>()
	const wrapper = mount(
		() =>
			h(Styled, {
				rows: people,
				columns,
				label: 'People',
				search: true,
				columnMenu: true,
				pagination: true,
				pageSizes: [2, 5],
				selection: 'multiple',
				getChildren: (row: Person) => row.reports,
				messages: messages.value,
			} satisfies Props),
		{ attachTo: document.body },
	)
	mounted.push(wrapper)
	await nextTick()

	expect(wrapper.get('input').attributes('placeholder')).toBe('Search')
	expect(wrapper.get('[data-slot="menu-trigger"]').text()).toBe('Columns')
	expect(wrapper.get('[data-slot="data-table-page"]').text()).toBe('Page 1 of 2')

	messages.value = {
		search: () => 'Suchen',
		columns: () => 'Spalten',
		pageOf: ({ page, pageCount }) => `Seite ${page} von ${pageCount}`,
		nextPage: () => 'Nächste Seite',
		selectAllRows: () => 'Alle Zeilen auswählen',
		selectRow: ({ row }) => `Zeile ${row} auswählen`,
		expandRowOf: ({ row }) => `Zeile ${row} öffnen`,
		noRowsForSearch: ({ search }) => `Keine Zeilen für „${search}“.`,
	}
	await nextTick()

	expect(wrapper.get('input').attributes('placeholder')).toBe('Suchen')
	expect(wrapper.get('[data-slot="menu-trigger"]').text()).toBe('Spalten')
	expect(wrapper.get('[data-slot="data-table-page"]').text()).toBe('Seite 1 von 2')
	expect(wrapper.find('[aria-label="Nächste Seite"]').exists()).toBe(true)
	expect(wrapper.find('[aria-label="Alle Zeilen auswählen"]').exists()).toBe(true)
	expect(wrapper.find('[aria-label="Zeile Aino auswählen"]').exists()).toBe(true)
	expect(wrapper.find('[aria-label="Zeile Aino öffnen"]').exists()).toBe(true)
	// A text without a translation stays English.
	expect(wrapper.find('[aria-label="Previous page"]').exists()).toBe(true)

	type(wrapper.get('input').element, 'zzz')
	await nextTick()
	expect(wrapper.get('[data-slot="data-table-empty"]').text()).toContain('Keine Zeilen für „zzz“.')
})

test('the class props reach the frame, the table, the header cells, the rows and the cells', async () => {
	const classed: DataTableColumn<Person>[] = [
		{ id: 'name', header: 'Name', meta: { headerClass: 'head-of-name', wrap: true } },
		{
			id: 'score',
			header: 'Score',
			meta: {
				align: 'center',
				class: (value, row) => (Number(value) > 50 ? `high of-${row.id}` : 'low'),
			},
		},
		{ id: 'team', header: 'Team', meta: { class: 'team-cell' } },
	]
	const wrapper = table({
		columns: classed,
		wrapperClass: 'frame-class h-40',
		tableClass: 'table-class',
		headerClass: 'header-class',
		rowClass: (row: Person, index: number) => `row-${row.id} place-${index}`,
		cellClass: 'cell-class',
	})
	await nextTick()

	expect(wrapper.get('[data-slot="data-table-frame"]').classes()).toEqual(
		expect.arrayContaining(['frame-class', 'h-40', 'overflow-auto', 'border']),
	)
	expect(wrapper.get('table').classes()).toContain('table-class')
	const headers = wrapper.findAll('thead th')
	expect(headers.every((cell) => cell.classes().includes('header-class'))).toBe(true)
	expect(headers[0]?.classes()).toContain('head-of-name')
	expect(headers[1]?.classes()).toContain('text-center')

	const rows = wrapper.findAll('tbody tr')
	expect(rows.map((row) => row.classes().filter((name) => /^(row|place)-/.test(name)))).toEqual([
		['row-a', 'place-0'],
		['row-b', 'place-1'],
		['row-c', 'place-2'],
	])
	// The look of the app stays on every row beside the class of the caller.
	expect(rows[0]?.classes()).toEqual(
		expect.arrayContaining(['hover:bg-muted/50', 'data-selected:bg-muted']),
	)
	const cells = rows[0]?.findAll('td') ?? []
	expect(cells.every((cell) => cell.classes().includes('cell-class'))).toBe(true)
	expect(cells.every((cell) => cell.classes().includes('p-2'))).toBe(true)
	expect(cells[0]?.classes()).toContain('whitespace-normal')
	expect(cells[1]?.classes()).toEqual(expect.arrayContaining(['high', 'of-a', 'text-center']))
	expect(rows[1]?.findAll('td')[1]?.classes()).toContain('low')
	expect(cells[2]?.classes()).toContain('team-cell')
})

test('a later class of the caller wins over a class of the table for the same property', async () => {
	const wrapper = table({ cellClass: 'p-4', rowClass: 'hover:bg-primary/5', width: 'auto' })
	await nextTick()

	const cell = wrapper.get('tbody td')
	expect(cell.classes()).toContain('p-4')
	expect(cell.classes()).not.toContain('p-2')
	const row = wrapper.get('tbody tr')
	expect(row.classes()).toContain('hover:bg-primary/5')
	expect(row.classes()).not.toContain('hover:bg-muted/50')
	expect(wrapper.get('table').classes()).toContain('w-auto')
	expect(wrapper.get('[data-slot="data-table-frame"]').classes()).toContain('w-fit')
})

test('a table on its way shows skeleton rows, and an empty table says so', async () => {
	const loading = table({ rows: [], loading: true, skeletonRows: 4 })
	await nextTick()
	expect(loading.findAll('[data-slot="data-table-skeleton-row"]')).toHaveLength(4)
	expect(loading.get('[data-slot="data-table-skeleton"]').attributes('aria-label')).toBe(
		'Loading rows.',
	)

	const empty = table({ rows: [] })
	await nextTick()
	expect(empty.get('[data-slot="data-table-empty"]').text()).toBe('No rows yet.')
	// Nothing is filtered, so there is nothing to clear.
	expect(empty.find('[data-slot="data-table-empty"] button').exists()).toBe(false)

	const own = table({ rows: [] }, { empty: () => h('p', { class: 'own-empty' }, 'Nobody here.') })
	await nextTick()
	expect(own.get('.own-empty').text()).toBe('Nobody here.')
	expect(own.find('[data-slot="data-table-empty"]').exists()).toBe(false)
})

test('cell, header, footer and toolbar slots of the caller take the place of the defaults', async () => {
	const wrapper = table(
		{ search: true },
		{
			'col-name': ({ row }: { row: Person }) => h('b', row.name.toUpperCase()),
			'header-team': ({ label }: { label: string }) => h('i', `${label}!`),
			'foot-score': ({ text }: { text: string }) => h('strong', `Sum ${text}`),
			toolbar: ({ view }: { view?: { rowCount: number } }) =>
				h('output', { class: 'count' }, `${view?.rowCount ?? 0} rows`),
		},
	)
	await nextTick()

	expect(wrapper.get('tbody b').text()).toBe('AINO')
	expect(wrapper.get('thead i').text()).toBe('Team!')
	expect(wrapper.get('tfoot strong').text()).toBe('Sum 135')
	expect(wrapper.get('output.count').text()).toBe('3 rows')

	type(wrapper.get('input').element, 'helmi')
	await nextTick()
	// The toolbar slot follows the table.
	expect(wrapper.get('output.count').text()).toBe('1 rows')
})

test('a link column renders a link, and a boolean column a mark with a text for a screen reader', async () => {
	type Site = { id: string; home: string; mail: string; live: boolean }
	const wrapper = mount(
		() =>
			h(Styled, {
				rows: [{ id: 's', home: 'https://example.com', mail: 'a@example.com', live: true }],
				columns: [
					{ id: 'home', format: 'url', formatOptions: { openInNewTab: true } },
					{ id: 'mail', format: 'email', formatOptions: { asLink: true } },
					{ id: 'live', format: 'boolean' },
				],
			} satisfies DataTableProps<Site>),
		{ attachTo: document.body },
	)
	mounted.push(wrapper)
	await nextTick()

	const links = wrapper.findAll('tbody a')
	expect(links.map((link) => link.attributes('href'))).toEqual([
		'https://example.com',
		'mailto:a@example.com',
	])
	expect(links[0]?.attributes('rel')).toBe('noopener noreferrer')
	expect(wrapper.get('tbody td:last-child .sr-only').text()).not.toBe('')
})
