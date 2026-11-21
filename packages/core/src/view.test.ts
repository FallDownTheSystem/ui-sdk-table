import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
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
	{ id: 'a', name: 'Aino', team: 'Design', score: 70, joined: '2024-03-01', tags: ['lead'] },
	{ id: 'b', name: 'Eero', team: 'Platform', score: 20, joined: '2023-01-15', tags: [] },
	{
		id: 'c',
		name: 'Helmi',
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

			view.api.setSearch('ai')
			expect(view.api.getView()).toMatchObject({ rowCount: 1, pageCount: 1, selectable: ['a'] })
			expect(view.api.getView().filter).toEqual({ search: 'ai' })
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
			expect(view.api.getFacets('name')).toEqual({
				kind: 'text',
				values: [],
				range: null,
				dates: null,
			})
		} finally {
			view.unmount()
		}
	})

	test('facets come from every row, so a filter does not take away its own choices, and they are kept', () => {
		const view = setup()
		try {
			const before = view.api.getFacets('team')
			view.api.setColumnFilter('team', ['Design'])
			expect(view.api.getFacets('team')).toBe(before)
			expect(view.api.getFacets('team').values).toHaveLength(2)
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
