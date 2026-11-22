import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
	createTableController,
	Table,
	useTableSearch,
	useTableView,
	type CellAttrsContext,
	type ColumnDef,
	type FilterState,
	type GroupSlotProps,
	type GroupTotalSlotProps,
	type HeaderSlotProps,
	type MultiSortMode,
	type RowAttrsContext,
	type SortRule,
} from './index'

type Person = { id: string; name: string; team: string; country: string; score: number }

const people: Person[] = [
	{ id: 'a', name: 'Alice', team: 'Design', country: 'Finland', score: 70 },
	{ id: 'b', name: 'Edward', team: 'Platform', country: 'Sweden', score: 20 },
	{ id: 'c', name: 'Hannah', team: 'Design', country: 'Sweden', score: 45 },
]

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team', sortable: true },
	{ id: 'country', header: 'Country', sortable: true },
	{ id: 'score', header: 'Score', aggregate: 'sum', format: 'decimal' },
	{ id: 'id', header: 'People', aggregate: 'count' },
]

const body = (wrapper: ReturnType<typeof mount>) =>
	wrapper.findAll('tbody tr').map((row) => row.findAll('td').map((cell) => cell.text()))

describe('the totals of a group under their columns', () => {
	test('a group row shows each total in a cell under its column, with the grid attributes', () => {
		const wrapper = mount(() =>
			h(Table<Person>, {
				rows: people,
				columns,
				groupBy: ['team'],
				defaultExpanded: ['group/team=Design'],
			}),
		)
		expect(body(wrapper)).toEqual([
			['Design (2)', '115.00', '2'],
			['Alice', 'Design', 'Finland', '70.00', 'a'],
			['Hannah', 'Design', 'Sweden', '45.00', 'c'],
			['Platform (1)', '20.00', '1'],
		])
		expect(
			wrapper
				.get('tfoot tr')
				.findAll('td')
				.map((cell) => cell.text()),
		).toEqual(['', '', '', '135.00', '3'])
		const [label, score, count] = wrapper.get('tbody tr').findAll('td')
		expect(label?.attributes()).toMatchObject({
			colspan: '3',
			'aria-colindex': '1',
			'data-kind': 'group-label',
			role: 'gridcell',
		})
		expect(score?.attributes()).toMatchObject({
			'aria-colindex': '4',
			'data-column': 'score',
			'data-kind': 'group-total',
			role: 'gridcell',
		})
		expect(count?.attributes('aria-colindex')).toBe('5')
		// Exactly one cell of the table is the tab stop.
		expect(wrapper.findAll('[tabindex="0"]')).toHaveLength(1)
		wrapper.unmount()
	})

	test('`group-total-{id}` wins over `group-total`, and both get the value, the text, the group and the column', () => {
		const wrapper = mount(() =>
			h(
				Table<Person>,
				{
					rows: people,
					columns: [...columns, { id: 'note', header: 'Note' }],
					groupBy: ['team'],
				},
				{
					'group-total-score': ({ value, text, group }: GroupTotalSlotProps<Person>) =>
						h('b', `${text}/${String(value)}/${String(group.value)}`),
					'group-total': ({ column, text, totals, level }: GroupTotalSlotProps<Person>) =>
						`${column.id}=${text || 'none'} of ${String(totals.score)} at ${level}`,
				},
			),
		)
		expect(body(wrapper)[0]).toEqual([
			'Design (2)',
			'115.00/115/Design',
			'id=2 of 115 at 0',
			// A column without a total has its cell too, and the slot can fill it.
			'note=none of 115 at 0',
		])
		wrapper.unmount()
	})

	test('with `groupTotals` off, a group row is one cell, and the `group` slot still has the totals', () => {
		const wrapper = mount(() =>
			h(
				Table<Person>,
				{ rows: people, columns, groupBy: ['team'], groupTotals: false },
				{
					group: ({ text, totalTexts, covered }: GroupSlotProps<Person>) =>
						`${text} ${totalTexts.score} over ${covered.length}`,
				},
			),
		)
		expect(body(wrapper)).toEqual([['Design 115.00 over 5'], ['Platform 20.00 over 5']])
		expect(wrapper.get('tbody td').attributes('colspan')).toBe('5')
		wrapper.unmount()
	})

	test('a total of a column under the label is said by the label', () => {
		const wrapper = mount(() =>
			h(Table<Person>, {
				rows: people,
				columns,
				groupBy: ['team'],
				columnOrder: ['score', 'name'],
			}),
		)
		// Score is the first column, so the label covers it, and the columns up to the next total.
		expect(body(wrapper)).toEqual([
			['Design (2) 115.00', '2'],
			['Platform (1) 20.00', '1'],
		])
		expect(wrapper.get('tbody td').attributes('colspan')).toBe('4')
		wrapper.unmount()
	})

	test('the path of a nested group reaches the slots and the attributes of the caller', () => {
		const paths: string[] = []
		const wrapper = mount(() =>
			h(
				Table<Person>,
				{
					rows: people,
					columns,
					groupBy: ['country', 'team'],
					defaultExpanded: ['group/country=Sweden'],
					rowAttrs: (context: RowAttrsContext<Person>) =>
						context.kind === 'group'
							? { 'data-path': context.path.map((entry) => entry.text).join('/') }
							: undefined,
					cellAttrs: (context: CellAttrsContext<Person>) =>
						context.kind === 'group-total'
							? { class: `total-${context.column.id} depth-${context.path.length}` }
							: undefined,
				},
				{
					group: ({ path }: GroupSlotProps<Person>) =>
						path.map((entry) => `${entry.column?.header}: ${entry.text}`).join(' / '),
					'group-total-score': ({ path, text }: GroupTotalSlotProps<Person>) => {
						paths.push(path.map((entry) => String(entry.value)).join('>'))
						return text
					},
				},
			),
		)
		expect(body(wrapper).map((cells) => cells[0])).toEqual([
			'Country: Finland',
			'Country: Sweden',
			'Country: Sweden / Team: Platform',
			'Country: Sweden / Team: Design',
		])
		expect(wrapper.findAll('tbody tr').map((row) => row.attributes('data-path'))).toEqual([
			'Finland',
			'Sweden',
			'Sweden/Platform',
			'Sweden/Design',
		])
		expect(paths).toEqual(['Finland', 'Sweden', 'Sweden>Platform', 'Sweden>Design'])
		expect(wrapper.findAll('tbody tr')[2]?.findAll('td')[1]?.classes()).toEqual([
			'total-score',
			'depth-2',
		])
		wrapper.unmount()
	})
})

describe('sort modes', () => {
	const sorted = (mode?: MultiSortMode, alwaysSorted = false) => {
		const sort = ref<readonly SortRule[]>([])
		const wrapper = mount(() =>
			h(Table<Person>, {
				rows: people,
				columns,
				multiSort: mode,
				alwaysSorted,
				sort: sort.value,
				'onUpdate:sort': (value: readonly SortRule[]) => (sort.value = value),
			}),
		)
		const press = async (index: number, keys: MouseEventInit = {}) => {
			await wrapper.findAll('thead th button')[index]?.trigger('click', keys)
		}
		return { sort, wrapper, press, ids: () => sort.value.map((rule) => rule.id) }
	}

	test('a press on the button of a header follows the mode, with each modifier key', async () => {
		const modifier = sorted()
		await modifier.press(0)
		await modifier.press(1, { shiftKey: true })
		await modifier.press(2, { ctrlKey: true })
		expect(modifier.ids()).toEqual(['name', 'team', 'country'])
		await modifier.press(1, { metaKey: true })
		expect(modifier.sort.value[1]).toEqual({ id: 'team', desc: true })
		await modifier.press(2)
		expect(modifier.ids()).toEqual(['country'])
		modifier.wrapper.unmount()

		const none = sorted('none')
		await none.press(0)
		await none.press(1, { shiftKey: true })
		expect(none.ids()).toEqual(['team'])
		none.wrapper.unmount()

		const always = sorted('always')
		await always.press(0)
		await always.press(1)
		expect(always.ids()).toEqual(['name', 'team'])
		always.wrapper.unmount()
	})

	test('`always-sorted` keeps the sort: the third press turns the order back', async () => {
		const { sort, press, wrapper } = sorted('modifier', true)
		await press(0)
		await press(0)
		await press(0)
		expect(sort.value).toEqual([{ id: 'name', desc: false }])
		wrapper.unmount()
	})
})

describe('what a style reads from a cell', () => {
	test('a header says its place in the sort, as an attribute and to its slot', async () => {
		const places: Record<string, number | undefined> = {}
		const wrapper = mount(() =>
			h(
				Table<Person>,
				{ rows: people, columns, defaultSort: [{ id: 'team' }, { id: 'name', desc: true }] },
				{
					header: (props: HeaderSlotProps<Person>) => {
						places[props.column.id] = props.sortIndex
						return props.label
					},
				},
			),
		)
		expect(places).toMatchObject({ team: 1, name: 2, country: undefined })
		const place = (id: string) =>
			wrapper.get(`thead th[data-column="${id}"]`).attributes('data-sort-index')
		expect([place('team'), place('name'), place('country')]).toEqual(['1', '2', undefined])
		wrapper.unmount()
	})

	test('a cell of a column with a format says the format: in the header, a row, a group row and the footer', () => {
		const wrapper = mount(() => h(Table<Person>, { rows: people, columns, groupBy: ['team'] }))
		const formats = (selector: string) =>
			wrapper.findAll(selector).map((cell) => cell.attributes('data-format'))
		expect(formats('thead th')).toEqual([undefined, undefined, undefined, 'decimal', undefined])
		expect(formats('tfoot td')).toEqual([undefined, undefined, undefined, 'decimal', undefined])
		// The label of a group covers the first three columns and shows no value of one of them.
		expect(formats('tbody tr[data-kind="group"]:first-child td')).toEqual([
			undefined,
			'decimal',
			undefined,
		])
		wrapper.unmount()

		// A caller cannot give the attribute of the table another value.
		const faked = mount(() =>
			h(Table<Person>, {
				rows: people,
				columns,
				cellAttrs: () => ({ 'data-format': 'date', 'data-sort-index': '9' }),
			}),
		)
		expect(faked.get('tbody td[data-column="score"]').attributes('data-format')).toBe('decimal')
		expect(faked.get('tbody td[data-column="name"]').attributes('data-format')).toBeUndefined()
		expect(faked.get('thead th').attributes('data-sort-index')).toBeUndefined()
		faked.unmount()
	})

	test('a cell of a column that leads the table says so, and a caller cannot say it for another', () => {
		const leading: ColumnDef<Person>[] = [{ id: 'pick', header: 'Pick', lead: true }, ...columns]
		const wrapper = mount(() =>
			h(Table<Person>, {
				rows: people,
				columns: leading,
				cellAttrs: () => ({ 'data-lead': 'mine' }),
			}),
		)
		const leads = (selector: string) =>
			wrapper.findAll(selector).map((cell) => cell.attributes('data-lead'))
		expect(leads('thead th')).toEqual(['', undefined, undefined, undefined, undefined, undefined])
		expect(leads('tbody tr:first-child td')).toEqual([
			'',
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
		])
		wrapper.unmount()
	})
})

describe('useTableView', () => {
	test('the view is there when the table is, follows each change, and stops with its scope', async () => {
		const controller = createTableController()
		let view: ReturnType<typeof useTableView> | undefined
		const Page = defineComponent({
			setup() {
				// Asked for before the table exists, as a toolbar above a table does.
				view = useTableView(controller)
				return () => [
					h('output', `${view?.value?.dataRowCount ?? 'no table'}`),
					h(Table<Person>, { rows: people, columns, controller }),
				]
			},
		})
		const wrapper = mount(Page)
		await nextTick()
		expect(wrapper.get('output').text()).toBe('3')

		controller.setSearch('alice')
		await nextTick()
		expect(wrapper.get('output').text()).toBe('1')
		expect(view?.value?.filter.search).toBe('alice')

		const last = view?.value
		wrapper.unmount()
		expect(view?.value).toBe(last)
	})

	test('a table that comes in place of another, with the same controller, keeps the view going', async () => {
		const controller = createTableController()
		const key = ref('all')
		const one = people.slice(0, 1)
		let view: ReturnType<typeof useTableView> | undefined
		const Page = defineComponent({
			setup() {
				view = useTableView(controller)
				// A new key mounts a new table, as a page does to start a table from its defaults.
				return () => [
					h('output', `${view?.value?.dataRowCount ?? 'no table'}`),
					h(Table<Person>, {
						key: key.value,
						rows: key.value === 'all' ? people : one,
						columns,
						controller,
					}),
				]
			},
		})
		const wrapper = mount(Page)
		await nextTick()
		expect(wrapper.get('output').text()).toBe('3')

		key.value = 'one'
		await nextTick()
		await nextTick()
		expect(wrapper.get('output').text()).toBe('1')
		controller.setSearch('nobody')
		await nextTick()
		expect(wrapper.get('output').text()).toBe('0')
	})
})

describe('useTableSearch', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	function field(filter = ref<FilterState>({}), searchDebounce?: number) {
		const controller = createTableController()
		const emitted: FilterState[] = []
		const Page = defineComponent(() => {
			// Before the table: the controller has no table yet, and the field is empty.
			const search = useTableSearch(controller)
			return () => [
				h('input', {
					type: 'search',
					value: search.text.value,
					'data-pending': search.pending.value ? '' : undefined,
					onInput: (event: Event) => (search.text.value = (event.target as HTMLInputElement).value),
					onKeydown: (event: KeyboardEvent) => {
						if (event.key === 'Escape') search.clear()
						if (event.key === 'Enter') search.flush()
					},
				}),
				h(Table<Person>, {
					rows: people,
					columns,
					controller,
					searchDebounce,
					filter: filter.value,
					'onUpdate:filter': (value: FilterState) => {
						emitted.push(value)
						filter.value = value
					},
				}),
			]
		})
		const wrapper = mount(Page)
		const input = wrapper.get('input')
		const names = () => wrapper.findAll('tbody tr').map((row) => row.get('td').text())
		const type = async (text: string) => {
			;(input.element as HTMLInputElement).value = text
			await input.trigger('input')
		}
		const value = () => (input.element as HTMLInputElement).value
		return { wrapper, input, names, type, value, filter, emitted, controller }
	}

	test('the field shows each letter at once, and the table filters once after the pause', async () => {
		const { wrapper, input, names, type, value, emitted } = field()
		await type('h')
		vi.advanceTimersByTime(100)
		await type('he')
		vi.advanceTimersByTime(100)
		await type('han')
		expect(value()).toBe('han')
		expect(input.attributes('data-pending')).toBe('')
		expect(names()).toEqual(['Alice', 'Edward', 'Hannah'])
		expect(emitted).toEqual([])
		vi.advanceTimersByTime(200)
		await nextTick()
		expect(emitted).toEqual([{ search: 'han' }])
		expect(names()).toEqual(['Hannah'])
		expect(value()).toBe('han')
		expect(input.attributes('data-pending')).toBeUndefined()
		wrapper.unmount()
	})

	test('Escape clears at once, Enter filters at once, and neither filters again after the pause', async () => {
		const { wrapper, input, names, type, value, emitted } = field()
		await type('edward')
		await input.trigger('keydown', { key: 'Enter' })
		await nextTick()
		expect(names()).toEqual(['Edward'])
		await type('edward x')
		await input.trigger('keydown', { key: 'Escape' })
		await nextTick()
		expect(value()).toBe('')
		expect(names()).toEqual(['Alice', 'Edward', 'Hannah'])
		vi.advanceTimersByTime(1000)
		await nextTick()
		expect(emitted).toEqual([{ search: 'edward' }, { search: '' }])
		wrapper.unmount()
	})

	test('a text from the owner of the filter wins over a text that waits', async () => {
		const { wrapper, names, type, value, filter, emitted, input } = field()
		await type('edward')
		// The owner sets another text, for example from a saved view.
		filter.value = { search: 'alice' }
		await nextTick()
		expect(value()).toBe('alice')
		expect(input.attributes('data-pending')).toBeUndefined()
		expect(names()).toEqual(['Alice'])
		vi.advanceTimersByTime(1000)
		await nextTick()
		expect(emitted).toEqual([])
		expect(filter.value).toEqual({ search: 'alice' })

		// A new object with the same text is not a new text: the text that waits stays.
		await type('hannah')
		filter.value = { search: 'alice' }
		await nextTick()
		expect(value()).toBe('hannah')
		vi.advanceTimersByTime(200)
		await nextTick()
		expect(emitted).toEqual([{ search: 'hannah' }])
		expect(names()).toEqual(['Hannah'])
		wrapper.unmount()
	})

	test('with `v-model:filter`, the field never jumps back to the text before while the owner passes the new one', async () => {
		const { wrapper, type, value, controller, names } = field(ref<FilterState>({ search: 'alice' }))
		const shown: string[] = []
		controller.subscribe(() => shown.push(controller.getView().search))
		// The field was made before the table, and has the text of the table from its first render on.
		await nextTick()
		expect(value()).toBe('alice')
		shown.length = 0
		await type('edward')
		vi.advanceTimersByTime(200)
		// The change is reported, and the prop holds the old text until the next render.
		expect(controller.getView()).toMatchObject({ search: 'edward', searchPending: false })
		await nextTick()
		expect(value()).toBe('edward')
		expect(names()).toEqual(['Edward'])
		controller.setSearch('')
		expect(controller.getView().search).toBe('')
		await nextTick()
		expect(names()).toEqual(['Alice', 'Edward', 'Hannah'])
		expect(shown).not.toContain('alice')
		wrapper.unmount()
	})

	test('a table that leaves the page takes its waiting text with it', async () => {
		const { wrapper, type, emitted } = field()
		await type('edward')
		wrapper.unmount()
		vi.advanceTimersByTime(1000)
		expect(emitted).toEqual([])
	})

	test('`search-debounce` of 0 filters with each letter', async () => {
		const { wrapper, type, names } = field(ref<FilterState>({}), 0)
		await type('al')
		await nextTick()
		expect(names()).toEqual(['Alice'])
		wrapper.unmount()
	})
})
