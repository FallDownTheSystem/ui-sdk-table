import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { Comment, h, nextTick, ref, shallowRef } from 'vue'
import { Table, type ColumnDef, type FilterState, type PageState, type SortRule } from './index'

type Person = { id: string; name: string; team: string; score: number; reports?: Person[] }

const people: Person[] = [
	{ id: 'a', name: 'Alice', team: 'Design', score: 70 },
	{ id: 'b', name: 'Edward', team: 'Platform', score: 20 },
	{ id: 'c', name: 'Hannah', team: 'Design', score: 45 },
]

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team' },
	{ id: 'score', header: 'Score', sortable: true },
]

const names = (wrapper: ReturnType<typeof mount>) =>
	wrapper.findAll('tbody tr').map((row) => row.find('td').text())

test('with manual stages, a sort, a search and a page are requests, and the rows show as they come', async () => {
	const rows = shallowRef(people)
	const sort = ref<readonly SortRule[]>([])
	const filter = ref<FilterState>({})
	const page = ref<PageState | undefined>({ page: 1, pageSize: 3 })
	const count = ref(7)
	const wrapper = mount(() =>
		h(Table<Person>, {
			rows: rows.value,
			columns,
			manualSort: true,
			manualFilter: true,
			manualPage: true,
			rowCount: count.value,
			sort: sort.value,
			'onUpdate:sort': (value: readonly SortRule[]) => (sort.value = value),
			filter: filter.value,
			'onUpdate:filter': (value: FilterState) => (filter.value = value),
			page: page.value,
			'onUpdate:page': (value: PageState | undefined) => (page.value = value),
		}),
	)

	await wrapper.get('thead th button').trigger('click')
	expect(sort.value).toEqual([{ id: 'name', desc: false }])
	await wrapper.get('thead th button').trigger('click')
	expect(sort.value).toEqual([{ id: 'name', desc: true }])
	// The header says the sort; the rows are still in the order of the server.
	expect(wrapper.get('thead th').attributes('aria-sort')).toBe('descending')
	expect(names(wrapper)).toEqual(['Alice', 'Edward', 'Hannah'])

	const api = wrapper.getComponent(Table).vm.api
	api.lastPage()
	await nextTick()
	expect(page.value).toEqual({ page: 3, pageSize: 3 })

	// The server answers with the last page, and one row left after a delete elsewhere.
	rows.value = people.slice(0, 1)
	count.value = 4
	await nextTick()
	await nextTick()
	expect(page.value).toEqual({ page: 2, pageSize: 3 })
	expect(names(wrapper)).toEqual(['Alice'])

	api.setSearch('He')
	await nextTick()
	expect(filter.value).toEqual({ search: 'He' })
	expect(page.value?.page).toBe(1)
	expect(names(wrapper)).toEqual(['Alice'])
	wrapper.unmount()
})

test('`loading` marks the table as busy; without rows, the body says that rows are on their way', async () => {
	const rows = shallowRef<Person[]>([])
	const loading = ref(true)
	const custom = ref(false)
	const wrapper = mount(() =>
		h(
			Table<Person>,
			{ rows: rows.value, columns, loading: loading.value, 'aria-label': 'People' },
			custom.value ? { loading: () => h('em', 'One moment') } : {},
		),
	)

	const root = wrapper.get('table')
	expect(root.attributes('aria-busy')).toBe('true')
	expect(root.attributes('data-loading')).toBe('')
	expect(wrapper.get('tbody td').text()).toBe('Loading rows.')

	custom.value = true
	await nextTick()
	expect(wrapper.get('tbody td em').text()).toBe('One moment')

	// With rows, the rows stay in view while the next ones load.
	rows.value = people
	await nextTick()
	expect(root.attributes('aria-busy')).toBe('true')
	expect(names(wrapper)).toEqual(['Alice', 'Edward', 'Hannah'])

	loading.value = false
	rows.value = []
	await nextTick()
	expect(root.attributes('aria-busy')).toBeUndefined()
	expect(root.attributes('data-loading')).toBeUndefined()
	expect(wrapper.get('tbody td').text()).toBe('No rows.')
	wrapper.unmount()
})

test('the texts of the table come from `messages`', async () => {
	const tree: Person[] = [{ ...people[0], reports: [people[1]] } as Person, people[2] as Person]
	const grouped = ref(false)
	const wrapper = mount(() =>
		h(Table<Person>, {
			rows: grouped.value ? people : tree,
			columns,
			getChildren: grouped.value ? undefined : (row: Person) => row.reports,
			groupBy: grouped.value ? ['team'] : [],
			messages: {
				expandRow: () => 'Avaa rivi',
				collapseRow: () => 'Sulje rivi',
				expandSign: () => '>',
				collapseSign: () => 'v',
				groupRow: ({ text, count }) => `${text}: ${count} kpl`,
			},
		}),
	)

	const toggle = wrapper.get('tbody td button')
	expect(toggle.text()).toBe('>')
	expect(toggle.attributes('aria-label')).toBe('Avaa rivi')
	await toggle.trigger('click')
	expect(wrapper.get('tbody td button').text()).toBe('v')
	expect(wrapper.get('tbody td button').attributes('aria-label')).toBe('Sulje rivi')

	grouped.value = true
	await nextTick()
	expect(wrapper.findAll('tbody td button').map((button) => button.text())).toEqual([
		'Design: 2 kpl',
		'Platform: 1 kpl',
	])
	wrapper.unmount()
})

test('without `messages`, a tree row has a button with a name, and a group row says its count', () => {
	const tree: Person[] = [{ ...people[0], reports: [people[1]] } as Person]
	const wrapper = mount(() => [
		h(Table<Person>, { rows: tree, columns, getChildren: (row: Person) => row.reports }),
		h(Table<Person>, { rows: people, columns, defaultGroupBy: ['team'] }),
	])
	const [treeTable, groupTable] = wrapper.findAll('table')
	expect(treeTable?.get('tbody td button').text()).toBe('+')
	expect(treeTable?.get('tbody td button').attributes('aria-label')).toBe('Expand row')
	expect(groupTable?.get('tbody td button').text()).toBe('Design (2)')
	wrapper.unmount()
})

test('a slot for the loading text or the "no rows" text that shows nothing leaves the text of the table', async () => {
	const loading = ref(true)
	const wrapper = mount(() =>
		h(
			Table<Person>,
			{ rows: [], columns, loading: loading.value, 'aria-label': 'People' },
			// As a template with a `v-if` that is false gives them.
			{ loading: () => [h(Comment)], empty: () => [] },
		),
	)
	expect(wrapper.get('tbody td').text()).toBe('Loading rows.')
	loading.value = false
	await nextTick()
	expect(wrapper.get('tbody td').text()).toBe('No rows.')
	wrapper.unmount()
})

/** A table on pages of a server with six people, three on a page. */
function served(extra: () => Record<string, unknown>) {
	const all = Array.from({ length: 6 }, (_, index) => ({
		id: `r${index}`,
		name: `Person ${index}`,
		team: 'Design',
		score: index,
	}))
	const serve = (page: number) => all.slice((page - 1) * 3, page * 3)
	const rows = shallowRef<Person[]>(serve(1))
	const page = ref<PageState | undefined>({ page: 1, pageSize: 3 })
	const asked: number[] = []
	const wrapper = mount(() =>
		h(Table<Person>, {
			rows: rows.value,
			columns,
			manualPage: true,
			page: page.value,
			'onUpdate:page': (value: PageState | undefined) => {
				page.value = value
				if (value) asked.push(value.page)
			},
			...extra(),
		}),
	)
	return { wrapper, rows, page, asked, serve, api: wrapper.getComponent(Table).vm.api }
}

test('a count that comes after the rows moves a page that is past the last page', async () => {
	const count = ref<number | undefined>(30)
	const { rows, page, asked, api } = served(() => ({ rowCount: count.value }))
	api.setPage(5)
	await nextTick()
	expect(asked).toEqual([5])
	// The server deleted rows: the answer for page 5 is empty, and the count comes a moment later.
	rows.value = []
	await nextTick()
	expect(page.value?.page).toBe(5)
	count.value = 6
	await nextTick()
	expect(page.value?.page).toBe(2)
	expect(asked).toEqual([5, 2])
})

test('without a count, an empty page sends the table one page back, after the load', async () => {
	const loading = ref(false)
	const { wrapper, rows, page, asked, serve, api } = served(() => ({ loading: loading.value }))
	api.nextPage()
	await nextTick()
	rows.value = serve(2)
	await nextTick()
	// Page 2 is full, so a page 3 can exist. The owner empties the rows while it loads.
	api.nextPage()
	loading.value = true
	rows.value = []
	await nextTick()
	expect(page.value?.page).toBe(3)
	expect(wrapper.get('tbody td').text()).toBe('Loading rows.')
	// A person who cannot see the table hears it too.
	await new Promise((resolve) => setTimeout(resolve, 150))
	const live = [...document.querySelectorAll('[aria-live="polite"]')]
	expect(live.map((region) => region.textContent)).toContain('Loading rows.')

	// The answer: no rows. Page 2 was the last.
	loading.value = false
	await nextTick()
	expect(page.value?.page).toBe(2)
	expect(asked).toEqual([2, 3, 2])
	wrapper.unmount()
})
