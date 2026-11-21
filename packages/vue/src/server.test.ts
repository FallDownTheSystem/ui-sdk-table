import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { h, nextTick, ref, shallowRef } from 'vue'
import { Table, type ColumnDef, type FilterState, type PageState, type SortRule } from './index'

type Person = { id: string; name: string; team: string; score: number; reports?: Person[] }

const people: Person[] = [
	{ id: 'a', name: 'Aino', team: 'Design', score: 70 },
	{ id: 'b', name: 'Eero', team: 'Platform', score: 20 },
	{ id: 'c', name: 'Helmi', team: 'Design', score: 45 },
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
	expect(names(wrapper)).toEqual(['Aino', 'Eero', 'Helmi'])

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
	expect(names(wrapper)).toEqual(['Aino'])

	api.setSearch('He')
	await nextTick()
	expect(filter.value).toEqual({ search: 'He' })
	expect(page.value?.page).toBe(1)
	expect(names(wrapper)).toEqual(['Aino'])
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
	expect(names(wrapper)).toEqual(['Aino', 'Eero', 'Helmi'])

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
