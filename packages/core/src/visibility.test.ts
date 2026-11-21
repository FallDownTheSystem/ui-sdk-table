import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import type { ColumnDef } from './rows'
import { table, type TableOptions } from './table'

type Person = { id: string; name: string; team: string; role: string; score: number }

const people: Person[] = [{ id: 'a', name: 'Aino', team: 'Design', role: 'Lead', score: 70 }]

const columns: ColumnDef<Person>[] = [
	{ id: 'name' },
	{ id: 'work', columns: [{ id: 'team' }, { id: 'role' }] },
	{ id: 'score' },
]

function setup(
	options: Partial<TableOptions<Person>> = {},
	cols: readonly ColumnDef<Person>[] = columns,
) {
	return mount(
		table,
		{ rows: people, columns: cols, ...options } as TableOptions,
		'<root aria-label="People"></root>',
	)
}

const shown = (view: ReturnType<typeof setup>) => view.api.columns().map((column) => column.id)

describe('all columns at once', () => {
	test('`hideAllColumns` hides every column in one change, and the first one in view stays', () => {
		const view = setup({ defaultColumnOrder: ['score', 'name'] })
		try {
			view.api.hideAllColumns()
			// A table needs one column: the first one on the screen.
			expect(shown(view)).toEqual(['score'])
			expect(view.state.columnVisibility).toEqual({ name: false, team: false, role: false })
			expect(view.changes).toHaveLength(1)
			expect(view.changes[0]).toMatchObject({ key: 'columnVisibility', reason: 'imperative' })
			// A second call has nothing to hide, and reports nothing.
			view.api.hideAllColumns()
			expect(view.changes).toHaveLength(1)
			view.api.showAllColumns()
			expect(shown(view)).toEqual(['score', 'name', 'team', 'role'])
		} finally {
			view.unmount()
		}
	})

	test('a column that cannot be hidden stays, and then no other column has to', () => {
		const fixed = columns.map((column) =>
			column.id === 'score' ? { ...column, hideable: false } : column,
		)
		const view = setup({}, fixed)
		try {
			view.api.hideAllColumns()
			expect(shown(view)).toEqual(['score'])
			expect(view.state.columnVisibility).toEqual({ name: false, team: false, role: false })
		} finally {
			view.unmount()
		}
	})

	test('a column that leads the table stays in view, and does not count as the one column', () => {
		const lead: ColumnDef<Person>[] = [{ id: 'pick', lead: true }, ...columns]
		const view = setup({}, lead)
		try {
			view.api.hideAllColumns()
			expect(shown(view)).toEqual(['pick', 'name'])
			expect(view.state.columnVisibility).toEqual({ team: false, role: false, score: false })
		} finally {
			view.unmount()
		}
	})

	test('the owner of the state can hide every column: the table then has no column, and still answers', () => {
		const view = setup({
			defaultColumnVisibility: { name: false, work: false, score: false },
		})
		try {
			expect(shown(view)).toEqual([])
			expect(view.root.getAttribute('aria-colcount')).toBe('0')
			expect(view.api.rows()).toHaveLength(1)
			expect(view.api.getView().visibleColumns).toEqual([])
			// With nothing in view, "hide all" has no first column to keep, and hides the rest.
			view.api.hideAllColumns()
			expect(shown(view)).toEqual([])
			// The start of this table is the state of the owner, with no column.
			view.api.showAllColumns()
			expect(shown(view)).toEqual(['name', 'team', 'role', 'score'])
			view.api.resetColumnVisibility()
			expect(shown(view)).toEqual([])
		} finally {
			view.unmount()
		}
	})
})

describe('columns back to their start', () => {
	test('`resetColumnVisibility` goes back to `defaultColumnVisibility`, in one change with the reason `reset`', () => {
		const view = setup({ defaultColumnVisibility: { score: false } })
		try {
			view.api.setColumnVisibility('score', true)
			view.api.setColumnVisibility('name', false)
			view.api.setColumnVisibility('work', false)
			expect(shown(view)).toEqual(['score'])
			const before = view.changes.length
			view.api.resetColumnVisibility()
			expect(shown(view)).toEqual(['name', 'team', 'role'])
			expect(view.state.columnVisibility).toEqual({ score: false })
			expect(view.changes).toHaveLength(before + 1)
			expect(view.changes.at(-1)).toMatchObject({ key: 'columnVisibility', reason: 'reset' })
			// At its start already: no change to report.
			view.api.resetColumnVisibility()
			expect(view.changes).toHaveLength(before + 1)
		} finally {
			view.unmount()
		}
	})

	test('without a start of its own, the start is every column in view', () => {
		const view = setup()
		try {
			view.api.hideAllColumns()
			view.api.resetColumnVisibility()
			expect(shown(view)).toEqual(['name', 'team', 'role', 'score'])
			expect(view.state.columnVisibility).toEqual({})
		} finally {
			view.unmount()
		}
	})

	test('with a state of the owner, the reset is reported and the owner decides', () => {
		const asked: unknown[] = []
		const view = setup({
			columnVisibility: { name: false },
			onColumnVisibilityChange: (value) => asked.push(value),
		})
		try {
			view.api.resetColumnVisibility()
			expect(asked).toEqual([{}])
			// The owner did not pass the value back, so the state is as it was.
			expect(shown(view)).toEqual(['team', 'role', 'score'])
		} finally {
			view.unmount()
		}
	})

	test('the order and the pins go back to their start in the same way', () => {
		const view = setup({
			defaultColumnOrder: ['score', 'name'],
			defaultColumnPinning: { start: ['role'] },
		})
		try {
			expect(shown(view)).toEqual(['role', 'score', 'name', 'team'])
			view.api.setColumnOrder(['team', 'name', 'score'])
			view.api.pinColumn('role', null)
			view.api.pinColumn('score', 'end')
			expect(shown(view)).toEqual(['team', 'name', 'role', 'score'])
			view.api.resetColumnOrder()
			expect(view.state.columnOrder).toEqual(['score', 'name'])
			expect(view.changes.at(-1)).toMatchObject({ key: 'columnOrder', reason: 'reset' })
			view.api.resetColumnPinning()
			expect(view.state.columnPinning).toEqual({ start: ['role'] })
			expect(view.changes.at(-1)).toMatchObject({ key: 'columnPinning', reason: 'reset' })
			expect(shown(view)).toEqual(['role', 'score', 'name', 'team'])
			const count = view.changes.length
			view.api.resetColumnOrder()
			view.api.resetColumnPinning()
			expect(view.changes).toHaveLength(count)
		} finally {
			view.unmount()
		}
	})
})
