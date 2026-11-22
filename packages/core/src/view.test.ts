import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import { sliderBounds } from './rows'
import { table, type TableOptions } from './table'

type Person = {
	id: string
	name: string
	team: string
	score: number
	joined: string
	tags: string[]
}

const people: Person[] = [
	{ id: 'a', name: 'Alice', team: 'Design', score: 70, joined: '2024-03-01', tags: ['lead'] },
	{ id: 'b', name: 'Edward', team: 'Platform', score: 20, joined: '2023-01-15', tags: [] },
	{
		id: 'c',
		name: 'Hannah',
		team: 'Design',
		score: 45,
		joined: '2025-06-30',
		tags: ['lead', 'new'],
	},
]

const columns = [
	{ id: 'name', sortable: true },
	{ id: 'team', filter: 'select' as const },
	{ id: 'score', format: 'integer' as const },
	{ id: 'joined', format: 'date' as const, formatOptions: { locale: 'en-GB' } },
	{ id: 'tags', filter: 'select' as const },
]

function setup(options: Partial<TableOptions<Person>> = {}) {
	return mount(
		table,
		{ rows: people, columns, ...options } as TableOptions,
		'<root aria-label="People"></root>',
	)
}

describe('what a control beside the table reads', () => {
	test('the view holds the state, the pages and the columns', () => {
		const view = setup({
			selection: 'multiple',
			canSelect: (row) => row.id !== 'b',
			defaultPage: { page: 1, pageSize: 2 },
			defaultColumnVisibility: { score: false },
		})
		try {
			const seen = view.api.getView()
			expect(seen).toMatchObject({
				page: 1,
				pageSize: 2,
				pageCount: 2,
				rowCount: 3,
				lastPageKnown: true,
				selected: [],
				selectable: ['a', 'c'],
				hasExpandable: false,
				loading: false,
			})
			expect(seen.columns.map((column) => column.id)).toEqual([
				'name',
				'team',
				'score',
				'joined',
				'tags',
			])
			expect(seen.visibleColumns.map((column) => column.id)).toEqual([
				'name',
				'team',
				'joined',
				'tags',
			])

			view.api.setSearch('al')
			expect(view.api.getView()).toMatchObject({ rowCount: 1, pageCount: 1, selectable: ['a'] })
			expect(view.api.getView().filter).toEqual({ search: 'al' })
		} finally {
			view.unmount()
		}
	})

	test('a table without pages has one page, and pages from a server without a count have no known end', () => {
		const plain = setup()
		const server = setup({ manualPage: true, defaultPage: { page: 1, pageSize: 3 } })
		try {
			expect(plain.api.getView()).toMatchObject({ page: 1, pageSize: undefined, pageCount: 1 })
			expect(server.api.getView().lastPageKnown).toBe(false)
		} finally {
			plain.unmount()
			server.unmount()
		}
	})

	test('`hasExpandable` is true for groups and for rows with child rows, and not for detail rows', () => {
		const grouped = setup({ defaultGroupBy: ['team'] })
		const detailed = setup({ hasDetail: () => true })
		try {
			expect(grouped.api.getView().hasExpandable).toBe(true)
			expect(detailed.api.getView().hasExpandable).toBe(false)
		} finally {
			grouped.unmount()
			detailed.unmount()
		}
	})

	test('`subscribe` runs after a change with the keys that changed, until it is stopped', () => {
		const view = setup({ selection: 'multiple' })
		try {
			const seen: string[][] = []
			const stop = view.api.subscribe((changed) => seen.push([...changed]))
			view.api.sortBy('name', 'desc')
			view.api.select('a')
			expect(seen).toEqual([['sort'], ['selected']])
			stop()
			view.api.sortBy('name', 'asc')
			expect(seen).toHaveLength(2)
			expect(() => view.api.subscribe('x' as never)).toThrow('`subscribe` takes a function.')
		} finally {
			view.unmount()
		}
	})

	test('the facets of a column fit its filter: values, a range of numbers, a range of dates, or text', () => {
		const view = setup()
		try {
			expect(view.api.getFacets('team')).toEqual({
				kind: 'select',
				values: [
					{ value: 'Design', count: 2, text: 'Design' },
					{ value: 'Platform', count: 1, text: 'Platform' },
				],
				range: null,
				dates: null,
				days: null,
			})
			// A cell that holds a list counts once for each entry.
			expect(view.api.getFacets('tags').values).toEqual([
				{ value: 'lead', count: 2, text: 'lead' },
				{ value: 'new', count: 1, text: 'new' },
			])
			expect(view.api.getFacets('score')).toMatchObject({
				kind: 'range',
				values: [],
				range: { min: 20, max: 70 },
			})
			const dates = view.api.getFacets('joined')
			expect(dates.kind).toBe('dateRange')
			expect(dates.dates?.from.getFullYear()).toBe(2023)
			expect(dates.dates?.to.getFullYear()).toBe(2025)
			expect(dates.days).toEqual({ from: '2023-01-15', to: '2025-06-30' })
			expect(view.api.getFacets('name')).toEqual({
				kind: 'text',
				values: [],
				range: null,
				dates: null,
				days: null,
			})
		} finally {
			view.unmount()
		}
	})

	test('a filter does not take away its own choices, and the facets are kept while nothing changes them', () => {
		const view = setup()
		try {
			const before = view.api.getFacets('team')
			view.api.setColumnFilter('team', ['Design'])
			expect(view.api.getFacets('team')).toBe(before)
			expect(view.api.getFacets('team').values).toHaveLength(2)
			// A sort and a page give the same rows to count.
			view.api.sortBy('name', 'desc')
			view.api.setPageSize(1)
			expect(view.api.getFacets('team')).toBe(before)
			// The first filter of a column gives it rows of its own to count, with the same answer.
			const score = view.api.getFacets('score')
			view.api.setColumnFilter('score', { min: 50 })
			const own = view.api.getFacets('score')
			expect(own).toEqual(score)
			expect(own.range).toEqual({ min: 45, max: 70, step: 1 })
			// From then on, a new value of that filter keeps them.
			view.api.setColumnFilter('score', { min: 60 })
			expect(view.api.getFacets('score')).toBe(own)
		} finally {
			view.unmount()
		}
	})

	test('the facets of a column follow the search and the filters of the other columns, with counts', () => {
		const view = setup()
		try {
			view.api.setColumnFilter('team', ['Design'])
			// The filter on the team does not count for the team, and it does for every other column.
			expect(view.api.getFacets('team').values).toEqual([
				{ value: 'Design', count: 2, text: 'Design' },
				{ value: 'Platform', count: 1, text: 'Platform' },
			])
			expect(view.api.getFacets('score').range).toEqual({ min: 45, max: 70, step: 1 })
			expect(view.api.getFacets('joined').days).toEqual({ from: '2024-03-01', to: '2025-06-30' })
			expect(view.api.getFacets('tags').values).toEqual([
				{ value: 'lead', count: 2, text: 'lead' },
				{ value: 'new', count: 1, text: 'new' },
			])

			view.api.setSearch('alice')
			expect(view.api.getFacets('team').values).toEqual([
				{ value: 'Design', count: 1, text: 'Design' },
			])
			expect(view.api.getFacets('tags').values).toEqual([{ value: 'lead', count: 1, text: 'lead' }])
			expect(view.api.getFacets('score').range).toEqual({ min: 70, max: 70, step: 1 })

			// Every row of the table, whatever the filters say.
			expect(view.api.getFacets('team', { rows: 'all' }).values).toEqual([
				{ value: 'Design', count: 2, text: 'Design' },
				{ value: 'Platform', count: 1, text: 'Platform' },
			])
			expect(view.api.getFacets('score', { rows: 'all' }).range).toEqual({
				min: 20,
				max: 70,
				step: 1,
			})
			expect(() => view.api.getFacets('team', { rows: 'page' as never })).toThrow(
				'`getFacets` takes a column id and `{ rows }`, where `rows` is one of: filtered, all.',
			)
		} finally {
			view.unmount()
		}
	})

	test('a value that the filter names stays in the list when no row holds it any more', () => {
		const view = setup({ defaultFilter: { columns: { team: ['Platform', 'Sales'] } } })
		try {
			view.api.setSearch('alice')
			// Only a Design row passes the search. The two chosen values stay, with no row.
			expect(view.api.getFacets('team').values).toEqual([
				{ value: 'Design', count: 1, text: 'Design' },
				{ value: 'Platform', count: 0, text: 'Platform' },
				{ value: 'Sales', count: 0, text: 'Sales' },
			])
			view.api.setColumnFilter('team', ['Design'])
			expect(view.api.getFacets('team').values).toEqual([
				{ value: 'Design', count: 1, text: 'Design' },
			])
			// No row passes: a range has no ends, and a list holds the chosen values.
			view.api.setSearch('nobody')
			expect(view.api.getFacets('team').values).toEqual([
				{ value: 'Design', count: 0, text: 'Design' },
			])
			expect(view.api.getFacets('score').range).toBeNull()
			expect(view.api.getFacets('joined').days).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('a facet is counted when it is asked for, and again only when its rows changed', () => {
		let reads = 0
		const counted = columns.map((column) =>
			column.id === 'team'
				? {
						...column,
						value: (row: Person) => {
							reads++
							return row.team
						},
					}
				: column,
		)
		const view = setup({ columns: counted })
		try {
			view.api.setSearch('e')
			view.api.setColumnFilter('score', { min: 0 })
			// Nothing asked for the facets yet. The filter does not read the team: the search reads its text.
			const before = reads
			view.api.getFacets('team')
			const once = reads - before
			expect(once).toBeGreaterThan(0)
			view.api.getFacets('team')
			view.api.setColumnFilter('team', ['Design'])
			view.api.getFacets('team')
			// The filter of the column itself read the team of each row, and the facets did not count again.
			const after = reads
			view.api.getFacets('team')
			expect(reads).toBe(after)
			view.api.setColumnFilter('score', { min: 30 })
			view.api.getFacets('team')
			expect(reads).toBeGreaterThan(after)
		} finally {
			view.unmount()
		}
	})

	test('the step of a range follows the format of its column, and `sliderBounds` gives whole steps', () => {
		type Item = { id: string; price: number; share: number; weight: number; count: number }
		const items: Item[] = [
			{ id: 'a', price: 0.1 + 0.2, share: 0.125, weight: 1.25, count: 3 },
			{ id: 'b', price: 12.349, share: 0.5, weight: 2.5, count: 12 },
		]
		const view = mount(
			table,
			{
				rows: items,
				columns: [
					{ id: 'price', format: 'currency' },
					{ id: 'share', format: 'percentage' },
					{ id: 'weight', filter: 'range' },
					{ id: 'count', filter: 'range' },
				],
				facets: { count: { range: { min: 0, max: 50, step: 5 } } },
			} as TableOptions,
			'<root aria-label="Items"></root>',
		)
		try {
			const price = view.api.getFacets('price').range
			expect(price).toEqual({ min: 0.1 + 0.2, max: 12.349, step: 0.01 })
			// A percentage of fractions shows 0.01 as 1 %.
			expect(view.api.getFacets('share').range?.step).toBe(0.01)
			// Without a number format, the digits of the rows say the step.
			expect(view.api.getFacets('weight').range?.step).toBe(0.01)
			expect(view.api.getFacets('count').range).toEqual({ min: 0, max: 50, step: 5 })
			expect(price && sliderBounds(price)).toEqual({ min: 0.3, max: 12.35, step: 0.01 })
			expect(sliderBounds({ min: 3, max: 12, step: 5 })).toEqual({ min: 0, max: 15, step: 5 })
			// With `steps`, a wide range gets a step that a thumb can use: 1, 2 or 5
			// times a power of ten of the cell step, and never finer than it.
			expect(sliderBounds({ min: 4.99, max: 1899.5, step: 0.01 }, { steps: 100 })).toEqual({
				min: 0,
				max: 1900,
				step: 20,
			})
			expect(sliderBounds({ min: 12, max: 340, step: 1 }, { steps: 100 })).toEqual({
				min: 10,
				max: 340,
				step: 5,
			})
			expect(sliderBounds({ min: 0.02, max: 0.31, step: 0.001 }, { steps: 100 })).toEqual({
				min: 0.02,
				max: 0.31,
				step: 0.005,
			})
			// A range that has fewer stops than that keeps the step of its cells.
			expect(sliderBounds({ min: 1, max: 40, step: 1 }, { steps: 100 })).toEqual({
				min: 1,
				max: 40,
				step: 1,
			})
			expect(sliderBounds({ min: 5, max: 5, step: 0.01 }, { steps: 100 }).step).toBe(0.01)
			expect(sliderBounds({ min: -0.25, max: 0.25, step: 0.1 })).toEqual({
				min: -0.3,
				max: 0.3,
				step: 0.1,
			})
		} finally {
			view.unmount()
		}
	})

	test('an unknown column fails with the columns that exist', () => {
		const view = setup()
		try {
			expect(() => view.api.getFacets('age')).toThrow(
				'No column "age" to read the facets of. Columns: name, team, score, joined, tags.',
			)
		} finally {
			view.unmount()
		}
	})
})

describe('rows selected together', () => {
	test('`selectRows` adds rows in one change, and `deselectRows` takes rows away in one change', () => {
		const view = setup({ selection: 'multiple', defaultSelected: ['c'] })
		try {
			view.api.selectRows(['a', 'b'])
			expect(view.state.selected).toEqual(['c', 'a', 'b'])
			expect(view.changes.filter((change) => change.key === 'selected')).toHaveLength(1)
			expect(view.changes.at(-1)).toMatchObject({ reason: 'imperative' })

			// Rows that are selected already are no change.
			view.api.selectRows(['a'])
			expect(view.changes.filter((change) => change.key === 'selected')).toHaveLength(1)

			view.api.deselectRows(['a', 'c', 'x'])
			expect(view.state.selected).toEqual(['b'])
			expect(view.changes.filter((change) => change.key === 'selected')).toHaveLength(2)
		} finally {
			view.unmount()
		}
	})

	test('a row that cannot be selected, an unknown row and a wrong argument fail with the reason', () => {
		const view = setup({ selection: 'multiple', canSelect: (row) => row.id !== 'b' })
		const single = setup({ selection: 'single' })
		const none = setup()
		try {
			expect(() => view.api.selectRows(['a', 'b'])).toThrow(
				'Row "b" cannot be selected: `canSelect` refuses it.',
			)
			expect(view.state.selected).toEqual([])
			expect(() => view.api.selectRows(['z'])).toThrow('No row "z" to select. Rows: a, b, c.')
			expect(() => view.api.selectRows('a' as never)).toThrow(
				'`selectRows` takes a list of row ids.',
			)
			expect(() => view.api.deselectRows('a' as never)).toThrow(
				'`deselectRows` takes a list of row ids.',
			)
			expect(() => single.api.selectRows(['a', 'c'])).toThrow(
				"`selectRows` with more than one row needs the `selection` option to be 'multiple'.",
			)
			single.api.selectRows(['a'])
			single.api.selectRows(['c'])
			expect(single.state.selected).toEqual(['c'])
			expect(() => none.api.selectRows(['a'])).toThrow('This table has no row selection.')
			expect(() => none.api.deselectRows(['a'])).toThrow('This table has no row selection.')
		} finally {
			view.unmount()
			single.unmount()
			none.unmount()
		}
	})
})

test('`clearColumnFilters` takes every column filter away in one change, and keeps the search', () => {
	const view = setup()
	try {
		view.api.setSearch('i')
		view.api.setColumnFilter('team', ['Design'])
		view.api.setColumnFilter('score', { min: 50 })
		const before = view.changes.length
		view.api.clearColumnFilters()
		expect(view.state.filter).toEqual({ search: 'i' })
		expect(view.changes).toHaveLength(before + 1)
		// Nothing to take away is no change.
		view.api.clearColumnFilters()
		expect(view.changes).toHaveLength(before + 1)
	} finally {
		view.unmount()
	}
})

describe('what a review of the controls found', () => {
	test('`selectRows` with no row changes nothing, also with a single selection', () => {
		const changes: unknown[] = []
		const view = setup({ selection: 'single', onSelectedChange: (value) => changes.push(value) })
		try {
			view.api.select('a')
			view.api.selectRows([])
			expect(view.api.getView().selected).toEqual(['a'])
			expect(changes).toEqual([['a']])
		} finally {
			view.unmount()
		}
	})

	test('a listener of `subscribe` does not run after the table is gone', () => {
		const view = setup()
		let calls = 0
		view.api.subscribe(() => calls++)
		view.api.sortBy('name')
		expect(calls).toBe(1)
		view.unmount()
		try {
			view.api.sortBy('name', 'desc')
		} catch {
			// A table that is gone may refuse the call; the listener must stay quiet either way.
		}
		expect(calls).toBe(1)
	})

	test('a filter that asks for nothing leaves no key in the state', () => {
		const view = setup()
		try {
			view.api.setColumnFilter('score', { min: 40 })
			view.api.setColumnFilter('team', ['Design'])
			view.api.setColumnFilter('score', undefined)
			expect(view.api.getView().filter).toEqual({ columns: { team: ['Design'] } })
			view.api.setColumnFilter('team', [])
			expect(view.api.getView().filter).toEqual({})
			view.api.setSearch('a')
			view.api.setColumnFilter('score', { min: null, max: null })
			expect(view.api.getView().filter).toEqual({ search: 'a' })
		} finally {
			view.unmount()
		}
	})

	test('`setPageSize(null)` takes the pages away, and a size brings them back', () => {
		const changes: unknown[] = []
		const view = setup({
			defaultPage: { page: 2, pageSize: 2 },
			onPageChange: (value, details) => changes.push([value, details.reason]),
		})
		try {
			expect(view.api.rows()).toHaveLength(1)
			view.api.setPageSize(null)
			expect(view.api.getView()).toMatchObject({ pageSize: undefined, page: 1, pageCount: 1 })
			expect(view.api.rows()).toHaveLength(3)
			// A table without pages has none to take away: no second change.
			view.api.setPageSize(null)
			expect(changes).toEqual([[undefined, 'imperative']])
			view.api.setPageSize(2)
			expect(view.api.getView()).toMatchObject({ pageSize: 2, page: 1, pageCount: 2 })
			expect(() => view.api.setPageSize(0)).toThrow(
				'A page size must be a whole number above 0, or null for a table without pages.',
			)
			expect(() => view.api.setPageSize(undefined as never)).toThrow('or null')
		} finally {
			view.unmount()
		}
	})

	test('the facets and the select filter read a value as grouping does: 1 and "1" are one value', () => {
		type Item = { id: string; code: unknown }
		const items: Item[] = [
			{ id: 'a', code: 1 },
			{ id: 'b', code: '1' },
			{ id: 'c', code: true },
			{ id: 'd', code: 'true' },
			{ id: 'e', code: 'x' },
			{ id: 'f', code: null },
		]
		const view = mount(
			table,
			{ rows: items, columns: [{ id: 'code', filter: 'select' }] } as TableOptions,
			'<root aria-label="Items"></root>',
		)
		try {
			const facets = view.api.getFacets('code').values
			expect(facets.map((facet) => [facet.text, facet.count])).toEqual([
				['1', 2],
				['true', 2],
				['x', 1],
			])
			view.api.setGroupBy(['code'])
			const groups = view.api.rows().filter((row) => row.node.kind === 'group')
			// One group for each facet, and one for the row without a value.
			expect(groups).toHaveLength(facets.length + 1)
			view.api.setGroupBy([])
			view.api.setColumnFilter('code', [facets[0]?.value])
			expect(view.api.rows().map((row) => row.id)).toEqual(['a', 'b'])
		} finally {
			view.unmount()
		}
	})

	test('with a filter on the server, the facets of the owner stay while the rows change', () => {
		const facets = {
			team: { values: [{ value: 'Design', count: 2 }, { value: 'Platform' }, { value: 'Sales' }] },
			score: { range: { min: 0, max: 100 } },
			joined: { dates: { from: '2020-01-01', to: new Date(2025, 11, 31, 15) } },
		}
		// The server answered with the rows that pass a filter on the team.
		const view = setup({
			manualFilter: true,
			facets,
			rows: people.filter((person) => person.team === 'Design'),
			defaultFilter: { columns: { team: ['Design'] } },
		})
		const plain = setup({
			manualFilter: true,
			rows: people.filter((person) => person.team === 'Design'),
		})
		try {
			// Without facets of the owner, the list holds what the rows hold: one team.
			expect(plain.api.getFacets('team').values.map((facet) => facet.value)).toEqual(['Design'])
			expect(view.api.getFacets('team').values).toEqual([
				{ value: 'Design', text: 'Design', count: 2 },
				{ value: 'Platform', text: 'Platform' },
				{ value: 'Sales', text: 'Sales' },
			])
			expect(view.api.getFacets('score').range).toEqual({ min: 0, max: 100, step: 1 })
			expect(view.api.getFacets('joined').days).toEqual({ from: '2020-01-01', to: '2025-12-31' })
			// A column without an entry reads the rows that the table holds.
			expect(view.api.getFacets('tags').values.map((facet) => facet.value)).toEqual(['lead', 'new'])
		} finally {
			view.unmount()
			plain.unmount()
		}
	})

	test('facets that name an unknown column or have a wrong shape fail with the reason', () => {
		expect(() => setup({ facets: { nobody: { values: [] } } }).api.getFacets('team')).toThrow(
			'No column "nobody" to give facets to. Columns: name, team, score, joined, tags.',
		)
		expect(() =>
			setup({ facets: { score: { range: { min: 'a' } } } as never }).api.getFacets('score'),
		).toThrow('The facets of column "score" need `range` as { min, max } with two numbers.')
		expect(() =>
			setup({ facets: { team: { values: ['Design'] } } as never }).api.getFacets('team'),
		).toThrow('The facets of column "team" need `values` as a list of { value, count? } entries.')
	})

	test('the days of a column of dates are days in the zone of the column', () => {
		const view = mount(
			table,
			{
				rows: [
					{ id: 'a', at: new Date(Date.UTC(2024, 0, 5, 2)) },
					{ id: 'b', at: new Date(Date.UTC(2024, 0, 9, 23)) },
				],
				columns: [{ id: 'at', format: 'date', formatOptions: { timeZone: 'America/Los_Angeles' } }],
			} as TableOptions,
			'<root aria-label="Flights"></root>',
		)
		try {
			expect(view.api.getFacets('at').days).toEqual({ from: '2024-01-04', to: '2024-01-09' })
		} finally {
			view.unmount()
		}
	})

	test('the view says what the pages count: rows, groups, rows with child rows, or both', () => {
		const flat = setup({ defaultPage: { page: 1, pageSize: 2 } })
		const grouped = setup({ defaultPage: { page: 1, pageSize: 2 }, defaultGroupBy: ['team'] })
		const mixed = setup({
			defaultPage: { page: 1, pageSize: 2 },
			defaultGroupBy: ['team'],
			canGroup: (row) => row.team !== 'Platform',
		})
		const tree = mount(
			table,
			{
				rows: [
					{
						id: 'p',
						n: 1,
						kids: [
							{ id: 'k1', n: 2 },
							{ id: 'k2', n: 3 },
						],
					},
					{ id: 'q', n: 4 },
				],
				columns: [{ id: 'n' }],
				getChildren: (row: { kids?: unknown[] }) => row.kids,
				defaultPage: { page: 1, pageSize: 1 },
			} as TableOptions,
			'<root aria-label="Tree"></root>',
		)
		try {
			expect(flat.api.getView()).toMatchObject({ rowCount: 3, pageUnit: 'rows', dataRowCount: 3 })
			expect(grouped.api.getView()).toMatchObject({
				rowCount: 2,
				pageUnit: 'groups',
				dataRowCount: 3,
			})
			expect(mixed.api.getView()).toMatchObject({ rowCount: 2, pageUnit: 'mixed', dataRowCount: 3 })
			expect(tree.api.getView()).toMatchObject({
				rowCount: 2,
				pageUnit: 'parents',
				dataRowCount: 4,
			})
			grouped.api.setSearch('Alice')
			expect(grouped.api.getView()).toMatchObject({ rowCount: 1, dataRowCount: 1 })
		} finally {
			for (const view of [flat, grouped, mixed, tree]) view.unmount()
		}
	})

	test('`hasExpanded` reads the rows of now, not ids that no row has any more', () => {
		const view = setup({ defaultGroupBy: ['team'] })
		try {
			expect(view.api.getView().hasExpanded).toBe(false)
			view.api.expandAll()
			expect(view.api.getView().hasExpanded).toBe(true)
			// The ids of the old groups stay in the state, and none of them is a group now.
			view.api.setGroupBy(['name'])
			expect(view.api.getView().expanded.length).toBeGreaterThan(0)
			expect(view.api.getView().hasExpanded).toBe(false)
		} finally {
			view.unmount()
		}
	})
})
