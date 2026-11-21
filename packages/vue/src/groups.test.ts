import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
	createTableController,
	Table,
	useTableSearch,
	type CellAttrsContext,
	type ColumnDef,
	type FilterState,
	type GroupSlotProps,
	type GroupTotalSlotProps,
	type MultiSortMode,
	type RowAttrsContext,
	type SortRule,
} from './index'

type Person = { id: string; name: string; team: string; country: string; score: number }

const people: Person[] = [
	{ id: 'a', name: 'Aino', team: 'Design', country: 'Finland', score: 70 },
	{ id: 'b', name: 'Eero', team: 'Platform', country: 'Sweden', score: 20 },
	{ id: 'c', name: 'Helmi', team: 'Design', country: 'Sweden', score: 45 },
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
			['Aino', 'Design', 'Finland', '70.00', 'a'],
			['Helmi', 'Design', 'Sweden', '45.00', 'c'],
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
		await type('hel')
		expect(value()).toBe('hel')
		expect(input.attributes('data-pending')).toBe('')
		expect(names()).toEqual(['Aino', 'Eero', 'Helmi'])
		expect(emitted).toEqual([])
		vi.advanceTimersByTime(200)
		await nextTick()
		expect(emitted).toEqual([{ search: 'hel' }])
		expect(names()).toEqual(['Helmi'])
		expect(value()).toBe('hel')
		expect(input.attributes('data-pending')).toBeUndefined()
		wrapper.unmount()
	})

	test('Escape clears at once, Enter filters at once, and neither filters again after the pause', async () => {
		const { wrapper, input, names, type, value, emitted } = field()
		await type('eero')
		await input.trigger('keydown', { key: 'Enter' })
		await nextTick()
		expect(names()).toEqual(['Eero'])
		await type('eero x')
		await input.trigger('keydown', { key: 'Escape' })
		await nextTick()
		expect(value()).toBe('')
		expect(names()).toEqual(['Aino', 'Eero', 'Helmi'])
		vi.advanceTimersByTime(1000)
		await nextTick()
		expect(emitted).toEqual([{ search: 'eero' }, { search: '' }])
		wrapper.unmount()
	})

	test('a text from the owner of the filter wins over a text that waits', async () => {
		const { wrapper, names, type, value, filter, emitted, input } = field()
		await type('eero')
		// The owner sets another text, for example from a saved view.
		filter.value = { search: 'aino' }
		await nextTick()
		expect(value()).toBe('aino')
		expect(input.attributes('data-pending')).toBeUndefined()
		expect(names()).toEqual(['Aino'])
		vi.advanceTimersByTime(1000)
		await nextTick()
		expect(emitted).toEqual([])
		expect(filter.value).toEqual({ search: 'aino' })

		// A new object with the same text is not a new text: the text that waits stays.
		await type('helmi')
		filter.value = { search: 'aino' }
		await nextTick()
		expect(value()).toBe('helmi')
		vi.advanceTimersByTime(200)
		await nextTick()
		expect(emitted).toEqual([{ search: 'helmi' }])
		expect(names()).toEqual(['Helmi'])
		wrapper.unmount()
	})

	test('with `v-model:filter`, the field never jumps back to the text before while the owner passes the new one', async () => {
		const { wrapper, type, value, controller, names } = field(ref<FilterState>({ search: 'aino' }))
		const shown: string[] = []
		controller.subscribe(() => shown.push(controller.getView().search))
		// The field was made before the table, and has the text of the table from its first render on.
		await nextTick()
		expect(value()).toBe('aino')
		shown.length = 0
		await type('eero')
		vi.advanceTimersByTime(200)
		// The change is reported, and the prop holds the old text until the next render.
		expect(controller.getView()).toMatchObject({ search: 'eero', searchPending: false })
		await nextTick()
		expect(value()).toBe('eero')
		expect(names()).toEqual(['Eero'])
		controller.setSearch('')
		expect(controller.getView().search).toBe('')
		await nextTick()
		expect(names()).toEqual(['Aino', 'Eero', 'Helmi'])
		expect(shown).not.toContain('aino')
		wrapper.unmount()
	})

	test('a table that leaves the page takes its waiting text with it', async () => {
		const { wrapper, type, emitted } = field()
		await type('eero')
		wrapper.unmount()
		vi.advanceTimersByTime(1000)
		expect(emitted).toEqual([])
	})

	test('`search-debounce` of 0 filters with each letter', async () => {
		const { wrapper, type, names } = field(ref<FilterState>({}), 0)
		await type('ai')
		await nextTick()
		expect(names()).toEqual(['Aino'])
		wrapper.unmount()
	})
})
