import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import { createRowModel } from './rows'
import type { PageState } from './rows'
import { table, type TableChangeDetails, type TableOptions } from './table'

type Person = { id: string; name: string; team: string; score: number }

const people: Person[] = [
	{ id: 'a', name: 'Aino', team: 'Design', score: 70 },
	{ id: 'b', name: 'Eero', team: 'Platform', score: 20 },
	{ id: 'c', name: 'Helmi', team: 'Design', score: 45 },
]

const columns = [
	{ id: 'name', sortable: true },
	{ id: 'team' },
	{ id: 'score', sortable: true, aggregate: 'sum' as const },
]

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id)

describe('the row model with stages that a server did', () => {
	const state = {
		sort: [{ id: 'score' }],
		filter: { search: 'Design' },
		page: { page: 2, pageSize: 2 } as PageState,
	}

	test('each manual stage is left out, and the others still run', () => {
		const manual = { sort: false, filter: false, page: false }
		const model = createRowModel<Person>({
			rows: () => people,
			columns: () => columns,
			sort: () => state.sort,
			filter: () => state.filter,
			page: () => ({ page: 1, pageSize: 1 }),
			manual: () => manual,
		})
		expect(ids(model.flat())).toEqual(['c'])
		manual.page = true
		expect(ids(model.paged())).toEqual(['c', 'a'])
		manual.sort = true
		expect(ids(model.paged())).toEqual(['a', 'c'])
		manual.filter = true
		expect(ids(model.paged())).toEqual(['a', 'b', 'c'])
		// A stage that is left out gives its input itself, so later stages keep their results.
		expect(model.sorted()).toBe(model.source().rows)
		expect(model.filtered()).toBe(model.source().rows)
	})

	test('with a count from the server, the pages come from the count', () => {
		let count: number | undefined = 41
		const model = createRowModel<Person>({
			rows: () => people.slice(0, 2),
			columns: () => columns,
			page: () => state.page,
			manual: () => ({ page: true }),
			serverRowCount: () => count,
		})
		expect(model.rowCount()).toBe(41)
		expect(model.pageCount()).toBe(21)
		expect(model.page()).toBe(2)
		// Fewer rows on the server: the page of the state is past the last page.
		count = 2
		expect(model.pageCount()).toBe(1)
		expect(model.page()).toBe(1)
	})

	test('without a count, a full page has a next page and a short page is the last', () => {
		let rows = people.slice(0, 2)
		const model = createRowModel<Person>({
			rows: () => rows,
			columns: () => columns,
			page: () => state.page,
			manual: () => ({ page: true }),
		})
		expect(model.pageCount()).toBe(3)
		expect(model.page()).toBe(2)
		rows = people.slice(0, 1)
		expect(model.pageCount()).toBe(2)
		expect(model.rowCount()).toBe(3)
	})
})

describe('a table whose rows come from a server', () => {
	function setup(options: Partial<TableOptions<Person>> = {}) {
		const changes: { key: string; value: unknown; details: TableChangeDetails }[] = []
		const on = (key: string) => (value: unknown, details: TableChangeDetails) =>
			changes.push({ key, value, details })
		const view = mount(
			table,
			{
				rows: people,
				columns,
				manualSort: true,
				manualFilter: true,
				manualPage: true,
				rowCount: 9,
				defaultPage: { page: 1, pageSize: 3 },
				onSortChange: on('sort'),
				onFilterChange: on('filter'),
				onPageChange: on('page'),
				...options,
			} as TableOptions,
			'<root aria-label="People"></root>',
		)
		return { view, changes }
	}

	test('a sort and a search change the state and not the rows', () => {
		const { view, changes } = setup()
		try {
			view.api.sortBy('score')
			view.api.setSearch('Aino')
			expect(ids(view.api.rows())).toEqual(['a', 'b', 'c'])
			expect(changes.map((change) => change.key)).toEqual(['sort', 'filter'])
			expect(view.state.sort).toEqual([{ id: 'score', desc: false }])
			expect(view.state.filter).toEqual({ search: 'Aino' })
		} finally {
			view.unmount()
		}
	})

	test('the pages come from the row count, and all rows of the page show', () => {
		const { view, changes } = setup()
		try {
			expect(ids(view.api.rows())).toEqual(['a', 'b', 'c'])
			view.api.lastPage()
			expect(view.state.page).toEqual({ page: 3, pageSize: 3 })
			// The rows of the page are the rows that the caller passed, whatever the page.
			expect(ids(view.api.rows())).toEqual(['a', 'b', 'c'])
			view.api.nextPage()
			expect(view.state.page?.page).toBe(3)
			// A page past the last page is the last page.
			view.api.setPage(7)
			expect(view.state.page?.page).toBe(3)
			expect(changes.filter((change) => change.key === 'page')).toHaveLength(1)
		} finally {
			view.unmount()
		}
	})

	test('a new sort or search starts on the first page', () => {
		const { view } = setup({ defaultPage: { page: 2, pageSize: 3 } })
		try {
			view.api.sortBy('name', 'desc')
			expect(view.state.page).toEqual({ page: 1, pageSize: 3 })
			view.api.setPage(3)
			view.api.setSearch('e')
			expect(view.state.page?.page).toBe(1)
		} finally {
			view.unmount()
		}
	})

	test('`loading` marks the table as busy and keeps the rows', () => {
		const { view } = setup({ loading: true })
		try {
			expect(view.root.getAttribute('aria-busy')).toBe('true')
			expect(view.root.hasAttribute('data-loading')).toBe(true)
			expect(view.api.rows()).toHaveLength(3)
		} finally {
			view.unmount()
		}
	})

	test('the totals and "select all" are of the rows that the table has', () => {
		const { view } = setup({ selection: 'multiple' })
		try {
			expect(view.api.totals()).toEqual({ score: 135 })
			view.api.selectAll()
			expect(view.state.selected).toEqual(['a', 'b', 'c'])
		} finally {
			view.unmount()
		}
	})
})

describe('pages of a server that gives no count', () => {
	const six = (page: number): Person[] =>
		Array.from({ length: 6 }, (_, index) => ({
			id: `r${index}`,
			name: `Person ${index}`,
			team: index % 2 ? 'Design' : 'Platform',
			score: index,
		})).slice((page - 1) * 3, page * 3)

	/** A table with a page of the server, and the pages that it asked for. */
	function setup(options: Partial<TableOptions<Person>> = {}) {
		const pages: { page: number; reason: string | undefined }[] = []
		const view = mount(
			table,
			{
				rows: six(1),
				columns,
				manualPage: true,
				defaultPage: { page: 1, pageSize: 3 },
				onPageChange: (page: PageState, details: TableChangeDetails) =>
					pages.push({ page: page.page, reason: details.reason }),
				...options,
			} as TableOptions,
			'<root aria-label="People"></root>',
		)
		return { view, pages }
	}

	test('a full page has a next page, also with groups or a pinned row', () => {
		for (const options of [
			{ defaultGroupBy: ['team'] },
			{ defaultRowPinning: { top: ['r0'] } },
			{ defaultFilter: { search: 'Person 1' } },
		]) {
			const { view, pages } = setup(options)
			try {
				expect(view.api.model.pageCount()).toBe(2)
				view.api.nextPage()
				expect(pages).toEqual([{ page: 2, reason: 'imperative' }])
			} finally {
				view.unmount()
			}
		}
	})

	test('a page state or a count that is no number reads as page 1 and as no count', () => {
		const model = createRowModel<Person>({
			rows: () => people,
			columns: () => columns,
			page: () => ({ page: Number.NaN, pageSize: 3 }),
			manual: () => ({ page: true }),
			serverRowCount: () => Number.NaN,
		})
		expect(model.page()).toBe(1)
		expect(model.pageCount()).toBe(2)
		expect(model.rowCount()).toBe(4)
	})

	test('an empty page after the first says that the page before is the last', () => {
		const model = createRowModel<Person>({
			rows: () => [],
			columns: () => columns,
			page: () => ({ page: 3, pageSize: 3 }),
			manual: () => ({ page: true }),
			loading: () => loading,
		})
		let loading = false
		expect(model.pageCount()).toBe(2)
		expect(model.rowCount()).toBe(6)
		// While the rows load, an empty list says nothing about the server.
		loading = true
		expect(model.pageCount()).toBe(3)
	})

	test('`setPage` goes to any page, `lastPage` says that it knows none, and a step to the same page size reports nothing', () => {
		const { view, pages } = setup()
		try {
			view.api.setPage(7)
			expect(pages).toEqual([{ page: 7, reason: 'imperative' }])
			expect(() => view.api.setPage(0.5)).toThrow('A page must be a whole number from 1.')
			expect(() => view.api.lastPage()).toThrow(
				'This table does not know its last page: its rows come in pages from a server (`manualPage`), and it has no `rowCount`.',
			)
			view.api.setPage(1)
			view.api.setPageSize(3)
			expect(pages).toHaveLength(2)
			view.api.setPageSize(5)
			expect(view.state.page).toEqual({ page: 1, pageSize: 5 })
		} finally {
			view.unmount()
		}
	})
})
