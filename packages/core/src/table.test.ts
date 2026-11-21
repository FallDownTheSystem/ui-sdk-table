import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import { table, type TableOptions } from './table'

type Person = { id: string; name: string; team: string; score: number; reports?: Person[] }

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

/** Markup for the rows the table shows now, in the way a renderer writes it. */
function markup(ids: string[]): string {
	const cells = (row: number, header = false) =>
		columns
			.map(
				(column, col) =>
					`<cell value="${row}:${column.id}" row="${row}" col="${col}"${header ? ' header' : ''}>x</cell>`,
			)
			.join('')
	const rows = ids.map(
		(id, index) => `<row value="${id}" index="${index + 1}">${cells(index + 1)}</row>`,
	)
	return `<root aria-label="People"><header-row index="0">${cells(0, true)}</header-row>${rows.join('')}</root>`
}

function setup(options: Partial<TableOptions<Person>> = {}, ids = ['a', 'b', 'c']) {
	return mount(table, { rows: people, columns, ...options } as TableOptions, markup(ids))
}

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id)

describe('table primitive', () => {
	test('the root is a grid that counts the header row and the footer row', () => {
		const view = setup()
		try {
			expect(view.root.getAttribute('role')).toBe('grid')
			expect(view.root.getAttribute('data-slot')).toBe('table')
			// One header row, three rows, and the footer row with the total of `score`.
			expect(view.root.getAttribute('aria-rowcount')).toBe('5')
			expect(view.root.getAttribute('aria-colcount')).toBe('3')
			expect(view.part('cell', '0:name')?.getAttribute('role')).toBe('columnheader')
			expect(view.part('cell', '1:name')?.getAttribute('role')).toBe('gridcell')
			expect(view.part('row', 'a')?.getAttribute('aria-rowindex')).toBe('2')
		} finally {
			view.unmount()
		}
	})

	test('sort actions change the rows and report the change', () => {
		const view = setup()
		try {
			view.api.sortBy('score')
			expect(ids(view.api.rows())).toEqual(['b', 'c', 'a'])
			expect(view.changes.at(-1)).toMatchObject({ key: 'sort', reason: 'imperative' })
			expect(view.part('cell', '0:score')?.getAttribute('aria-sort')).toBe('ascending')
			expect(view.part('cell', '0:team')?.hasAttribute('aria-sort')).toBe(false)

			view.api.toggleSort('score')
			expect(view.state.sort).toEqual([{ id: 'score', desc: true }])
			view.api.toggleSort('name', { append: true })
			expect(view.state.sort).toEqual([
				{ id: 'score', desc: true },
				{ id: 'name', desc: false },
			])
			view.api.toggleSort('score', { append: true })
			expect(view.state.sort).toEqual([{ id: 'name', desc: false }])
		} finally {
			view.unmount()
		}
	})

	test('an action with a wrong argument fails with the valid values', () => {
		const view = setup()
		try {
			expect(() => view.api.sortBy('nope')).toThrow(
				'No column "nope" to sort by. Columns: name, team, score.',
			)
			expect(() => view.api.select('a')).toThrow('This table has no row selection')
			expect(() => view.api.expand('a')).toThrow('No row or group "a" that can expand')
			expect(() => view.api.setPage(2)).toThrow('This table has no pages')
		} finally {
			view.unmount()
		}
	})

	test('filter actions filter, and go back to the first page', () => {
		const view = setup({ defaultPage: { page: 2, pageSize: 1 } }, ['b'])
		try {
			expect(ids(view.api.rows())).toEqual(['b'])
			view.api.setColumnFilter('team', ['Design'])
			expect(view.state.page).toEqual({ page: 1, pageSize: 1 })
			expect(ids(view.api.rows())).toEqual(['a'])
			view.api.nextPage()
			expect(ids(view.api.rows())).toEqual(['c'])
			view.api.nextPage()
			expect(view.state.page?.page).toBe(2)
			view.api.setSearch('eero')
			expect(view.api.model.rowCount()).toBe(0)
			view.api.clearFilters()
			expect(view.api.model.rowCount()).toBe(3)
		} finally {
			view.unmount()
		}
	})

	test('`searchMode: "fuzzy"` finds a row from letters in order, and `fuzzyThreshold` makes it stricter', () => {
		const exact = setup()
		const fuzzy = setup({ searchMode: 'fuzzy' })
		const strict = setup({ searchMode: 'fuzzy', fuzzyThreshold: 0.9 })
		try {
			// "hlm" is in "Helmi" as letters in order, and in no value as it is.
			exact.api.setSearch('hlm')
			expect(ids(exact.api.rows())).toEqual([])
			fuzzy.api.setSearch('hlm')
			expect(ids(fuzzy.api.rows())).toEqual(['c'])
			strict.api.setSearch('hlm')
			expect(ids(strict.api.rows())).toEqual([])
			strict.api.setSearch('helmi')
			expect(ids(strict.api.rows())).toEqual(['c'])
			// The order of the rows stays the order of the data, not of the score of the match.
			fuzzy.api.setSearch('e')
			expect(ids(fuzzy.api.rows())).toEqual(['a', 'b', 'c'])
		} finally {
			exact.unmount()
			fuzzy.unmount()
			strict.unmount()
		}
	})

	test('selection marks only the selected row', () => {
		const view = setup({ selection: 'multiple' })
		try {
			expect(view.root.getAttribute('aria-multiselectable')).toBe('true')
			expect(view.part('row', 'a')?.getAttribute('aria-selected')).toBe('false')
			view.api.select('b')
			expect(view.part('row', 'b')?.getAttribute('aria-selected')).toBe('true')
			expect(view.part('row', 'b')?.hasAttribute('data-selected')).toBe(true)
			expect(view.part('row', 'a')?.getAttribute('aria-selected')).toBe('false')
			view.api.toggleSelected('a')
			expect(view.state.selected).toEqual(['b', 'a'])
			view.api.selectAll()
			expect(view.state.selected).toEqual(['a', 'b', 'c'])
			view.api.clearSelection()
			expect(view.state.selected).toEqual([])
		} finally {
			view.unmount()
		}
	})

	test('"select all" keeps selected rows that the filter hides, and a refused row gives a reason', () => {
		const view = setup({
			selection: 'multiple',
			defaultSelected: ['b'],
			canSelect: (row) => row.id !== 'c',
		})
		try {
			view.api.setSearch('Design')
			view.api.selectAll()
			expect(view.state.selected).toEqual(['b', 'a'])
			expect(() => view.api.select('c')).toThrow('Row "c" cannot be selected')
		} finally {
			view.unmount()
		}
	})

	test('the page stays when the same filter or sort arrives as a new object', () => {
		const pages: unknown[] = []
		const view = setup(
			{ defaultPage: { page: 2, pageSize: 1 }, onPageChange: (value) => pages.push(value) },
			['b'],
		)
		try {
			view.api.sortBy('name')
			expect(view.state.page?.page).toBe(1)
			view.api.nextPage()
			pages.length = 0
			view.api.sortBy('name')
			expect(view.state.page?.page).toBe(2)
			expect(pages).toEqual([])

			view.api.setColumnFilter('team', ['Design'])
			view.api.nextPage()
			const changes = view.changes.length
			view.api.setColumnFilter('team', ['Design'])
			expect(view.state.page?.page).toBe(2)
			expect(view.changes).toHaveLength(changes)
		} finally {
			view.unmount()
		}
	})

	test('a count total is a plain number, and other totals take the format of the column', () => {
		const view = setup()
		try {
			const count = { id: 'joined', format: 'date' as const, aggregate: 'count' as const }
			const sum = { id: 'score', format: 'currency' as const, aggregate: 'sum' as const }
			expect(view.api.totalText(count, 3)).toBe('3')
			expect(view.api.totalText(sum, 3)).toContain('3.00')
		} finally {
			view.unmount()
		}
	})

	test('a controlled value changes only when the owner passes it back', () => {
		const seen: unknown[] = []
		const view = setup({
			selection: 'single',
			selected: [],
			onSelectedChange: (value) => seen.push(value),
		})
		try {
			view.api.select('a')
			expect(seen).toEqual([['a']])
			expect(view.state.selected).toEqual([])
		} finally {
			view.unmount()
		}
	})

	test('a change can be refused', () => {
		const view = setup({ onSortChange: (_value, details) => details.cancel() })
		try {
			view.api.sortBy('score')
			expect(view.state.sort).toEqual([])
		} finally {
			view.unmount()
		}
	})

	test('groups make a treegrid with levels, and expand on request', () => {
		const view = setup({ defaultGroupBy: ['team'] }, ['group/team=Design', 'group/team=Platform'])
		try {
			expect(view.root.getAttribute('role')).toBe('treegrid')
			const design = view.part('row', 'group/team=Design')
			expect(design?.getAttribute('aria-expanded')).toBe('false')
			expect(design?.getAttribute('aria-level')).toBe('1')
			expect(design?.getAttribute('aria-setsize')).toBe('2')
			view.api.expand('group/team=Design')
			expect(design?.getAttribute('aria-expanded')).toBe('true')
			expect(ids(view.api.rows())).toEqual(['group/team=Design', 'a', 'c', 'group/team=Platform'])
			expect(view.api.totals(view.api.rows()[0]?.node as never)).toEqual({ score: 115 })
			view.api.collapseAll()
			expect(view.api.rows()).toHaveLength(2)
		} finally {
			view.unmount()
		}
	})

	test('arrow keys move between cells, and the header row is part of the grid', async () => {
		const view = setup()
		try {
			await view.keys('Tab')
			expect(document.activeElement).toBe(view.part('cell', '0:name'))
			await view.keys('ArrowDown', 'ArrowRight')
			expect(view.state.active).toEqual({ row: 1, col: 1 })
			expect(document.activeElement).toBe(view.part('cell', '1:team'))
			expect(view.part('cell', '1:team')?.getAttribute('tabindex')).toBe('0')
			expect(view.part('cell', '0:name')?.getAttribute('tabindex')).toBe('-1')
		} finally {
			view.unmount()
		}
	})

	test('Enter on a header sorts, and Space on a row selects it', async () => {
		const view = setup({ selection: 'multiple' })
		try {
			await view.keys('Tab', 'Enter')
			expect(view.state.sort).toEqual([{ id: 'name', desc: false }])
			expect(view.changes.at(-1)).toMatchObject({
				key: 'sort',
				reason: 'press',
				source: 'keyboard',
			})
			await view.keys('ArrowDown', 'Space')
			expect(view.state.selected).toEqual(['a'])
		} finally {
			view.unmount()
		}
	})

	test('Space on a group row selects the rows of the group, and Space again takes them out', async () => {
		const groups = ['group/team=Design', 'group/team=Platform']
		const view = setup({ selection: 'multiple', defaultGroupBy: ['team'] }, groups)
		try {
			await view.keys('Tab', 'ArrowDown', 'Space')
			expect(view.state.selected).toEqual(['a', 'c'])
			expect(view.changes.at(-1)).toMatchObject({
				key: 'selected',
				reason: 'list-navigation',
				source: 'keyboard',
			})
			// The rows of another group stay as they are.
			await view.keys('ArrowDown', 'Space')
			expect(view.state.selected).toEqual(['a', 'c', 'b'])
			await view.keys('ArrowUp', 'Space')
			expect(view.state.selected).toEqual(['b'])
			// A group with some rows selected gets the rest.
			view.api.selectRows(['c'])
			await view.keys('Space')
			expect([...view.state.selected].sort()).toEqual(['a', 'b', 'c'])
			// Enter is still the button of the group: it opens it.
			await view.keys('Enter')
			expect(view.state.expanded).toEqual(['group/team=Design'])
		} finally {
			view.unmount()
		}
	})

	test('Space on a group row leaves out the rows that cannot be selected, and needs a multiple selection', async () => {
		const groups = ['group/team=Design', 'group/team=Platform']
		const some = setup(
			{ selection: 'multiple', defaultGroupBy: ['team'], canSelect: (row) => row.id !== 'c' },
			groups,
		)
		try {
			await some.keys('Tab', 'ArrowDown', 'Space')
			expect(some.state.selected).toEqual(['a'])
			await some.keys('Space')
			expect(some.state.selected).toEqual([])
		} finally {
			some.unmount()
		}
		const single = setup({ selection: 'single', defaultGroupBy: ['team'] }, groups)
		try {
			await single.keys('Tab', 'ArrowDown', 'Space')
			expect(single.state.selected).toEqual([])
		} finally {
			single.unmount()
		}
	})
})
