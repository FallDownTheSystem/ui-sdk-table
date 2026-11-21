import { mount } from '@ui-sdk/core/testing'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import type { FilterState } from './rows'
import { table, type TableChangeDetails, type TableOptions } from './table'

type Person = { id: string; name: string; team: string }

const people: Person[] = [
	{ id: 'a', name: 'Aino', team: 'Design' },
	{ id: 'b', name: 'Eero', team: 'Platform' },
	{ id: 'c', name: 'Helmi', team: 'Design' },
]

const columns = [{ id: 'name' }, { id: 'team' }]

function setup(options: Partial<TableOptions<Person>> = {}) {
	return mount(
		table,
		{ rows: people, columns, ...options } as TableOptions,
		'<root aria-label="People"></root>',
	)
}

const ids = (view: ReturnType<typeof setup>) => view.api.rows().map((row) => row.id)
const search = (view: ReturnType<typeof setup>) => {
	const { search, searchPending } = view.api.getView()
	return { search, searchPending }
}

describe('a search field with a pause', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	test('the field shows the text at once, and the table filters once after the pause', () => {
		const view = setup()
		const heard: (readonly string[])[] = []
		view.api.subscribe((changed) => heard.push(changed))
		try {
			expect(search(view)).toEqual({ search: '', searchPending: false })
			const event = new Event('input')
			view.api.inputSearch('a', event)
			vi.advanceTimersByTime(150)
			view.api.inputSearch('ai', event)
			vi.advanceTimersByTime(150)
			view.api.inputSearch('ain', event)
			expect(search(view)).toEqual({ search: 'ain', searchPending: true })
			// 300 ms of typing, and no pause of 200 ms yet: the rows are as they were.
			expect(view.state.filter).toEqual({})
			expect(ids(view)).toEqual(['a', 'b', 'c'])
			expect(view.changes).toEqual([])
			// A listener hears each text of the field, and no change of the filter.
			expect(heard.flat()).not.toContain('filter')
			expect(heard.length).toBeGreaterThan(0)

			vi.advanceTimersByTime(200)
			expect(view.state.filter).toEqual({ search: 'ain' })
			expect(ids(view)).toEqual(['a'])
			expect(search(view)).toEqual({ search: 'ain', searchPending: false })
			// One change of the filter for the three letters, with the event of the field.
			expect(view.changes).toHaveLength(1)
			expect(view.changes[0]).toMatchObject({ key: 'filter', reason: 'input-change' })
			expect(heard.filter((changed) => changed.includes('filter'))).toHaveLength(1)
			vi.advanceTimersByTime(1000)
			expect(view.changes).toHaveLength(1)
			// The table itself says nothing: the one who shows the rows found says them, one time.
			expect(view.announced).toEqual([])
		} finally {
			view.unmount()
		}
	})

	test('`searchDebounce` sets the pause, and 0 filters at once', () => {
		const slow = setup({ searchDebounce: 500 })
		const fast = setup({ searchDebounce: 0 })
		try {
			slow.api.inputSearch('eero')
			vi.advanceTimersByTime(499)
			expect(ids(slow)).toEqual(['a', 'b', 'c'])
			vi.advanceTimersByTime(1)
			expect(ids(slow)).toEqual(['b'])

			fast.api.inputSearch('eero')
			expect(ids(fast)).toEqual(['b'])
			expect(search(fast)).toEqual({ search: 'eero', searchPending: false })
			expect(fast.state.searchDraft).toBeNull()
		} finally {
			slow.unmount()
			fast.unmount()
		}
	})

	test('a clear button and Escape act at once: `setSearch` drops the text that waits', () => {
		const view = setup({ defaultFilter: { search: 'helmi' } })
		try {
			view.api.inputSearch('helmi x')
			view.api.setSearch('')
			expect(search(view)).toEqual({ search: '', searchPending: false })
			expect(ids(view)).toEqual(['a', 'b', 'c'])
			expect(view.changes.at(-1)).toMatchObject({ key: 'filter', reason: 'imperative' })
			vi.advanceTimersByTime(1000)
			// The text that waited never filtered.
			expect(view.state.filter).toEqual({ search: '' })
			expect(view.changes).toHaveLength(1)
		} finally {
			view.unmount()
		}
	})

	test('a text that the filter holds already does not wait', () => {
		const view = setup({ defaultFilter: { search: 'aino' } })
		try {
			view.api.inputSearch('aino x')
			expect(search(view)).toEqual({ search: 'aino x', searchPending: true })
			// The person deletes the two letters again.
			view.api.inputSearch('aino')
			expect(search(view)).toEqual({ search: 'aino', searchPending: false })
			vi.advanceTimersByTime(1000)
			expect(view.changes).toEqual([])
		} finally {
			view.unmount()
		}
	})

	test('`flushSearch` filters now, as Enter in the field does, and the pause does not filter again', () => {
		const view = setup()
		try {
			view.api.flushSearch()
			expect(view.changes).toEqual([])
			view.api.inputSearch('eero')
			view.api.flushSearch()
			expect(ids(view)).toEqual(['b'])
			expect(search(view)).toEqual({ search: 'eero', searchPending: false })
			vi.advanceTimersByTime(1000)
			expect(view.changes).toHaveLength(1)
		} finally {
			view.unmount()
		}
	})

	test('"clear all filters" wins over a text that waits, also when the filter was empty', () => {
		const view = setup()
		try {
			view.api.inputSearch('eero')
			view.api.clearFilters()
			expect(search(view)).toEqual({ search: '', searchPending: false })
			vi.advanceTimersByTime(1000)
			expect(view.state.filter).toEqual({})
			expect(view.changes).toEqual([])

			// The filters of the columns go, and the search is not one of them: its text still waits.
			view.api.setColumnFilter('team', 'Design')
			view.api.inputSearch('helmi')
			view.api.clearColumnFilters()
			expect(search(view)).toEqual({ search: 'helmi', searchPending: true })
			// A filter of a column that comes while a text waits is kept when the text arrives.
			view.api.setColumnFilter('team', 'Design')
			vi.advanceTimersByTime(200)
			expect(view.state.filter).toEqual({ search: 'helmi', columns: { team: 'Design' } })
			expect(ids(view)).toEqual(['c'])
		} finally {
			view.unmount()
		}
	})

	test('a listener that refuses the change sends the field back to the text of the filter', () => {
		const view = setup({
			defaultFilter: { search: 'aino' },
			onFilterChange: (_value: FilterState, details: TableChangeDetails) => details.cancel(),
		})
		try {
			view.api.inputSearch('eero')
			vi.advanceTimersByTime(200)
			expect(view.state.filter).toEqual({ search: 'aino' })
			expect(search(view)).toEqual({ search: 'aino', searchPending: false })
		} finally {
			view.unmount()
		}
	})

	test('a table that is destroyed leaves nothing waiting', () => {
		const filters: FilterState[] = []
		const view = setup({ onFilterChange: (value: FilterState) => filters.push(value) })
		view.api.inputSearch('eero')
		view.unmount()
		expect(vi.getTimerCount()).toBe(0)
		vi.advanceTimersByTime(1000)
		expect(filters).toEqual([])
	})

	test('a text that is not a text fails with the reason', () => {
		const view = setup()
		try {
			expect(() => view.api.inputSearch(5 as never)).toThrow('The search text must be a string.')
			expect(view.api.getView().searchPending).toBe(false)
		} finally {
			view.unmount()
		}
	})
})
