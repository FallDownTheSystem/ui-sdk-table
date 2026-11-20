import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import { headerCellMap, layoutColumns, mergeColumnTrack } from './columns/layout'
import type { ColumnDef } from './rows'
import { table, type TableOptions } from './table'

type Person = { id: string; name: string; team: string; role: string; score: number }

const people: Person[] = [
	{ id: 'a', name: 'Aino', team: 'Design', role: 'Lead', score: 70 },
	{ id: 'b', name: 'Eero', team: 'Platform', role: 'Engineer', score: 20 },
]

const flat: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true, width: 120 },
	{ id: 'team', header: 'Team', width: 100 },
	{ id: 'role', header: 'Role', width: 100 },
	{ id: 'score', header: 'Score', width: 80, minWidth: 60, maxWidth: 200 },
]

const nested: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'work', header: 'Work', columns: [{ id: 'team' }, { id: 'role' }] },
	{ id: 'score' },
]

/** Markup for the header and the rows of a table, in the way a renderer writes it. */
function markup(columns: readonly ColumnDef<Person>[], options: Partial<TableOptions<Person>>) {
	const layout = layoutColumns(columns, {
		visibility: options.defaultColumnVisibility,
		order: options.defaultColumnOrder,
		pinning: options.defaultColumnPinning,
	})
	const head = layout.headerRows.map((cells, index) => {
		const content = cells.map((cell) => {
			const resizer = cell.leaf ? `<resizer value="${cell.column.id}"></resizer>` : ''
			return `<cell value="h|${cell.key}" row="${cell.row}" col="${cell.col}" colspan="${cell.colSpan}" rowspan="${cell.rowSpan}" header>${cell.column.id}${resizer}</cell>`
		})
		return `<header-row index="${index}">${content.join('')}</header-row>`
	})
	const first = layout.headerRows.length
	const rows = people.map((person, position) => {
		const cells = layout.leaves.map(
			(column, col) =>
				`<cell value="r|${person.id}|${column.id}" row="${first + position}" col="${col}">x</cell>`,
		)
		return `<row value="${person.id}" index="${first + position}">${cells.join('')}</row>`
	})
	const cols = layout.leaves.map((column) => `<col value="${column.id}"></col>`)
	return `<root aria-label="People">${cols.join('')}<head>${head.join('')}</head><body>${rows.join('')}</body></root>`
}

function setup(
	columns: readonly ColumnDef<Person>[] = flat,
	options: Partial<TableOptions<Person>> = {},
) {
	const view = mount(
		table,
		{ rows: people, columns, ...options } as TableOptions,
		markup(columns, options),
	)
	// The test page has no layout. A browser gives a column with a width that
	// width, so the header cells say the same here.
	for (const column of layoutColumns(columns).all) {
		const cell = view.part('cell', `h|${column.id}`)
		const width = column.width
		if (cell && width !== undefined) {
			cell.getBoundingClientRect = () => ({ width, height: 20 }) as DOMRect
		}
	}
	return view
}

/** A `style` attribute without the spaces that the test page adds. */
const style = (el: Element | undefined) => (el?.getAttribute('style') ?? '').replaceAll(' ', '')

const ids = (columns: readonly { id: string }[]) => columns.map((column) => column.id)

describe('column helpers', () => {
	test('a move among some columns leaves every other column in its place', () => {
		expect(mergeColumnTrack(['a', 'b', 'c', 'd', 'e'], ['d', 'b'])).toEqual([
			'a',
			'd',
			'c',
			'b',
			'e',
		])
		expect(mergeColumnTrack(['a', 'b'], [])).toEqual(['a', 'b'])
	})

	test('the header map gives the cell that covers each place', () => {
		const map = headerCellMap(layoutColumns(nested))
		expect(map.map((row) => row.map((cell) => cell?.column.id))).toEqual([
			['name', 'work', 'work', 'score'],
			['name', 'team', 'role', 'score'],
		])
	})
})

describe('nested headers', () => {
	test('every header row counts as a grid row, and a group spans its columns', () => {
		const view = setup(nested)
		try {
			// Two header rows and two rows. No column has a total, so there is no footer row.
			expect(view.root.getAttribute('aria-rowcount')).toBe('4')
			expect(view.root.getAttribute('aria-colcount')).toBe('4')
			const work = view.part('cell', 'h|work@1')
			expect(work?.getAttribute('role')).toBe('columnheader')
			expect(work?.getAttribute('colspan')).toBe('2')
			expect(work?.getAttribute('data-column')).toBe('work')
			expect(view.part('cell', 'h|name')?.getAttribute('rowspan')).toBe('2')
			expect(view.part('row', 'a')?.getAttribute('aria-rowindex')).toBe('3')
		} finally {
			view.unmount()
		}
	})

	test('arrow keys cross cells that span, and go on along the column they started in', async () => {
		const view = setup(nested)
		try {
			await view.keys('Tab')
			expect(document.activeElement).toBe(view.part('cell', 'h|name'))
			// "Name" covers both header rows, so one step down leaves the header.
			await view.keys('ArrowDown')
			expect(document.activeElement).toBe(view.part('cell', 'r|a|name'))
			await view.keys('ArrowRight', 'ArrowRight', 'ArrowUp')
			expect(document.activeElement).toBe(view.part('cell', 'h|role'))
			await view.keys('ArrowUp')
			expect(document.activeElement).toBe(view.part('cell', 'h|work@1'))
			// The group has two columns. The way back down is the column the person came from.
			await view.keys('ArrowDown')
			expect(document.activeElement).toBe(view.part('cell', 'h|role'))
			await view.keys('ArrowUp', 'ArrowRight')
			expect(document.activeElement).toBe(view.part('cell', 'h|score'))
			await view.keys('ArrowLeft')
			expect(document.activeElement).toBe(view.part('cell', 'h|work@1'))
			await view.keys('ArrowLeft')
			expect(document.activeElement).toBe(view.part('cell', 'h|name'))
		} finally {
			view.unmount()
		}
	})
})

describe('column visibility', () => {
	test('a hidden column leaves the columns, and comes back', () => {
		const view = setup()
		try {
			view.api.setColumnVisibility('team', false)
			expect(view.state.columnVisibility).toEqual({ team: false })
			expect(view.changes.at(-1)).toMatchObject({ key: 'columnVisibility', reason: 'imperative' })
			expect(ids(view.api.columns())).toEqual(['name', 'role', 'score'])
			expect(ids(view.api.allColumns())).toEqual(['name', 'team', 'role', 'score'])
			expect(view.root.getAttribute('aria-colcount')).toBe('3')
			expect(view.api.isColumnVisible('team')).toBe(false)
			view.api.toggleColumnVisibility('team')
			expect(view.state.columnVisibility).toEqual({})
			view.api.setColumnVisibility('role', false)
			view.api.showAllColumns()
			expect(ids(view.api.columns())).toEqual(['name', 'team', 'role', 'score'])
		} finally {
			view.unmount()
		}
	})

	test('the id of a header group hides all its columns', () => {
		const view = setup(nested)
		try {
			view.api.setColumnVisibility('work', false)
			expect(ids(view.api.columns())).toEqual(['name', 'score'])
			expect(view.api.headerRowCount()).toBe(1)
			view.api.toggleColumnVisibility('work')
			expect(view.api.headerRowCount()).toBe(2)
		} finally {
			view.unmount()
		}
	})

	test('a wrong request fails with a reason', () => {
		const columns = [{ id: 'name', hideable: false }, { id: 'team' }]
		const view = setup(columns)
		try {
			expect(() => view.api.setColumnVisibility('nope', false)).toThrow(
				'No column "nope" to hide. Columns: name, team.',
			)
			expect(() => view.api.setColumnVisibility('name', false)).toThrow('cannot be hidden')
			view.api.setColumnVisibility('team', false)
			expect(ids(view.api.columns())).toEqual(['name'])
		} finally {
			view.unmount()
		}
		const last = setup([{ id: 'name' }])
		try {
			expect(() => last.api.setColumnVisibility('name', false)).toThrow('last visible column')
		} finally {
			last.unmount()
		}
	})

	test('the active cell stays on its column when a column before it hides', async () => {
		const view = setup()
		try {
			await view.keys('Tab', 'ArrowRight', 'ArrowRight')
			expect(view.state.active).toEqual({ row: 0, col: 2 })
			view.api.setColumnVisibility('name', false)
			expect(view.state.active).toEqual({ row: 0, col: 1 })
			// The column of the active cell hides: the cell stays inside the table.
			view.api.setColumnVisibility('role', false)
			view.api.setColumnVisibility('score', false)
			expect(view.state.active).toEqual({ row: 0, col: 0 })
		} finally {
			view.unmount()
		}
	})
})

describe('column order', () => {
	test('`moveColumn` and `setColumnOrder` change the order', () => {
		const view = setup(flat, { reorderable: true })
		try {
			view.api.moveColumn('score', 0)
			expect(view.state.columnOrder).toEqual(['score', 'name', 'team', 'role'])
			expect(view.changes.at(-1)).toMatchObject({ key: 'columnOrder', reason: 'imperative' })
			expect(ids(view.api.columns())).toEqual(['score', 'name', 'team', 'role'])
			view.api.setColumnOrder(['role'])
			expect(ids(view.api.columns())).toEqual(['role', 'name', 'team', 'score'])
			expect(() => view.api.moveColumn('name', 9)).toThrow('from 0 to 3')
			expect(() => view.api.setColumnOrder(['nope'])).toThrow('No column "nope" to order')
		} finally {
			view.unmount()
		}
	})

	test('Space picks a column up, arrows move it, Space drops it', async () => {
		const view = setup(flat, { reorderable: true })
		try {
			await view.keys('Tab', 'Space')
			expect(view.state.columnDrag?.key).toBe('name')
			expect(view.part('cell', 'h|name')?.hasAttribute('data-moving')).toBe(true)
			await view.keys('ArrowRight', 'ArrowRight')
			// The move shows at once, and the order of the state waits for the drop.
			expect(ids(view.api.columns())).toEqual(['team', 'role', 'name', 'score'])
			expect(view.state.columnOrder).toEqual([])
			await view.keys('Space')
			expect(view.state.columnOrder).toEqual(['team', 'role', 'name', 'score'])
			expect(view.changes.at(-1)).toMatchObject({
				key: 'columnOrder',
				reason: 'move-key',
				source: 'keyboard',
			})
			expect(view.announced.at(-1)).toBe('Dropped Name at column 3 of 4.')
			// The active cell went with its column.
			expect(view.state.active).toEqual({ row: 0, col: 2 })

			await view.keys('Space', 'Home', 'Escape')
			expect(view.state.columnDrag).toBeNull()
			expect(view.state.columnOrder).toEqual(['team', 'role', 'name', 'score'])
		} finally {
			view.unmount()
		}
	})

	test('without `reorderable`, Space on a header picks nothing up, and Enter still sorts', async () => {
		const view = setup()
		try {
			await view.keys('Tab', 'Space')
			expect(view.state.columnDrag).toBeNull()
			await view.keys('Enter')
			expect(view.state.sort).toEqual([{ id: 'name', desc: false }])
		} finally {
			view.unmount()
		}
		const fixed = setup([{ id: 'name', reorderable: false }, { id: 'team' }], { reorderable: true })
		try {
			await fixed.keys('Tab', 'Space')
			expect(fixed.state.columnDrag).toBeNull()
			await fixed.keys('ArrowRight', 'Space')
			expect(fixed.state.columnDrag?.key).toBe('team')
		} finally {
			fixed.unmount()
		}
	})

	test('a hidden column keeps its place in the order while others move', () => {
		const view = setup(flat, { reorderable: true, defaultColumnVisibility: { team: false } })
		try {
			view.api.moveColumn('score', 0)
			expect(view.state.columnOrder).toEqual(['score', 'team', 'name', 'role'])
			view.api.showAllColumns()
			expect(ids(view.api.columns())).toEqual(['score', 'team', 'name', 'role'])
		} finally {
			view.unmount()
		}
	})

	test('a controlled order changes only when the owner passes it back', () => {
		const seen: unknown[] = []
		const view = setup(flat, {
			reorderable: true,
			columnOrder: [],
			onColumnOrderChange: (value) => seen.push(value),
		})
		try {
			view.api.moveColumn('score', 0)
			expect(seen).toEqual([['score', 'name', 'team', 'role']])
			expect(ids(view.api.columns())).toEqual(['name', 'team', 'role', 'score'])
		} finally {
			view.unmount()
		}
	})
})

describe('column resize', () => {
	test('a drag of the handle reports each step as a change and the end as one commit', async () => {
		const commits: unknown[] = []
		const view = setup(flat, {
			resizable: true,
			onColumnWidthsCommit: (value, details) => commits.push([value, details.reason]),
		})
		try {
			const handle = view.part('resizer', 'name') as HTMLElement
			expect(handle.getAttribute('role')).toBe('separator')
			expect(handle.getAttribute('aria-label')).toBe('Resize Name')
			expect(handle.getAttribute('aria-valuenow')).toBe('120')
			await view.drag(handle, { by: { x: 30, y: 0 } })
			// The first resize also gives every other column the width it has on the
			// screen, so no other column moves while this one changes.
			const widths = { name: 150, team: 100, role: 100, score: 80 }
			expect(view.state.columnWidths).toEqual(widths)
			expect(view.state.columnResize).toBeNull()
			const steps = view.changes.filter((change) => change.key === 'columnWidths')
			expect(steps.length).toBeGreaterThan(0)
			expect(steps.every((change) => change.reason === 'drag')).toBe(true)
			expect(commits).toEqual([[widths, 'drag']])
			expect(handle.getAttribute('aria-valuenow')).toBe('150')
			expect(style(view.part('col', 'name'))).toContain('--table-column-width:150px')
		} finally {
			view.unmount()
		}
	})

	test('a press on the handle without a move changes nothing', async () => {
		const view = setup(flat, { resizable: true })
		try {
			await view.click(view.part('resizer', 'name') as HTMLElement)
			expect(view.state.columnWidths).toEqual({})
			expect(view.changes).toEqual([])
		} finally {
			view.unmount()
		}
	})

	test('arrow keys on the handle resize in steps, inside the limits of the column', async () => {
		const commits: unknown[] = []
		const view = setup(flat, {
			resizable: true,
			onColumnWidthsCommit: (value) => commits.push(value),
		})
		try {
			const handle = view.part('resizer', 'score') as HTMLElement
			handle.focus()
			await view.keys('ArrowRight')
			const others = { name: 120, team: 100, role: 100 }
			expect(view.state.columnWidths).toEqual({ ...others, score: 90 })
			expect(view.changes.at(-1)).toMatchObject({ key: 'columnWidths', reason: 'resize-key' })
			expect(commits).toEqual([{ ...others, score: 90 }])
			const cell = view.part('cell', 'h|score') as HTMLElement
			const shown = (width: number) =>
				(cell.getBoundingClientRect = () => ({ width, height: 20 }) as DOMRect)
			shown(90)
			await view.keys('Shift+ArrowLeft')
			expect(view.state.columnWidths.score).toBe(60)
			shown(60)
			await view.keys('ArrowLeft')
			expect(view.state.columnWidths.score).toBe(60)
			expect(commits).toHaveLength(2)
			for (let press = 0; press < 5; press++) {
				shown(view.state.columnWidths.score ?? 0)
				await view.keys('Shift+ArrowRight')
			}
			expect(view.state.columnWidths.score).toBe(200)
			expect(view.announced.at(-1)).toBe('Score, 200 pixels wide.')
			// The arrows on the handle did not move the active cell.
			expect(view.state.active).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('Alt with an arrow on a header cell resizes its column', async () => {
		const view = setup(flat, { resizable: true })
		try {
			await view.keys('Tab', 'Alt+ArrowRight')
			expect(view.state.columnWidths.name).toBe(130)
			expect(view.state.active).toEqual({ row: 0, col: 0 })
			const cell = view.part('cell', 'h|name') as HTMLElement
			cell.getBoundingClientRect = () => ({ width: 130, height: 20 }) as DOMRect
			await view.keys('Alt+Shift+ArrowLeft')
			expect(view.state.columnWidths.name).toBe(80)
		} finally {
			view.unmount()
		}
	})

	test('`setColumnWidth` clamps, reports a commit, and null takes the width away', () => {
		const commits: unknown[] = []
		const view = setup(flat, { onColumnWidthsCommit: (value) => commits.push(value) })
		try {
			view.api.setColumnWidth('score', 500)
			expect(view.state.columnWidths).toEqual({ score: 200 })
			expect(view.api.columnWidth('score')).toBe(200)
			view.api.setColumnWidth('score', null)
			expect(view.state.columnWidths).toEqual({})
			expect(view.api.columnWidth('score')).toBe(80)
			expect(commits).toEqual([{ score: 200 }, {}])
			expect(() => view.api.setColumnWidth('score', -1)).toThrow('number of pixels above 0')
			expect(() => view.api.setColumnWidth('nope', 10)).toThrow('No column "nope" to resize')
		} finally {
			view.unmount()
		}
	})

	test('with a width for every column, the table has the sum as its width', () => {
		const view = setup()
		try {
			expect(style(view.root)).toContain('--table-width:400px')
			expect(view.root.hasAttribute('data-sized')).toBe(true)
		} finally {
			view.unmount()
		}
		const free = setup(nested)
		try {
			expect(free.root.hasAttribute('data-sized')).toBe(false)
		} finally {
			free.unmount()
		}
	})
})

describe('column pinning', () => {
	test('a pinned column goes to its edge and gets an offset', () => {
		const view = setup(flat, { defaultColumnPinning: { start: ['team'], end: ['name'] } })
		try {
			expect(ids(view.api.columns())).toEqual(['team', 'role', 'score', 'name'])
			const team = view.part('cell', 'h|team')
			expect(team?.getAttribute('data-pinned')).toBe('start')
			expect(team?.hasAttribute('data-pinned-edge')).toBe(true)
			expect(style(team)).toContain('--table-pin-offset:var(--table-pin-start-0,0px)')
			expect(view.part('cell', 'r|a|name')?.getAttribute('data-pinned')).toBe('end')
			expect(view.part('cell', 'r|a|role')?.hasAttribute('data-pinned')).toBe(false)

			view.api.pinColumn('score', 'start')
			expect(view.state.columnPinning).toEqual({ start: ['team', 'score'], end: ['name'] })
			expect(ids(view.api.columns())).toEqual(['team', 'score', 'role', 'name'])
			// The second pinned column starts after the width of the first.
			expect(view.api.pins.offset('score')).toBe('var(--table-pin-start-1, 100px)')
			expect(view.api.isPinEdge('team')).toBe(false)
			expect(view.api.isPinEdge('score')).toBe(true)

			view.api.pinColumn('team', null)
			expect(view.state.columnPinning).toEqual({ start: ['score'], end: ['name'] })
			expect(() => view.api.pinColumn('team', 'left' as never)).toThrow('"start" or "end"')
		} finally {
			view.unmount()
		}
	})

	test('a pinned column keeps its place: it cannot be moved', async () => {
		const view = setup(flat, { reorderable: true, defaultColumnPinning: { start: ['name'] } })
		try {
			expect(view.state.columnTrack).toEqual(['team', 'role', 'score'])
			expect(view.api.canReorder('name')).toBe(false)
			expect(() => view.api.moveColumn('name', 1)).toThrow('is pinned')
			await view.keys('Tab', 'Space')
			expect(view.state.columnDrag).toBeNull()
			// The other columns move among themselves, and the pinned one stays first.
			view.api.moveColumn('score', 0)
			expect(ids(view.api.columns())).toEqual(['name', 'score', 'team', 'role'])
			view.api.pinColumn('name', null)
			expect(view.state.columnTrack).toEqual(['name', 'score', 'team', 'role'])
		} finally {
			view.unmount()
		}
	})
})

describe('column widths that the caller owns', () => {
	test('the commit holds the widths that were asked for, not the widths of the state', async () => {
		const changes: unknown[] = []
		const commits: unknown[] = []
		const view = setup(flat, {
			resizable: true,
			columnWidths: { name: 180, team: 100, role: 100, score: 80 },
			onColumnWidthsChange: (value) => changes.push(value),
			onColumnWidthsCommit: (value) => commits.push(value),
		})
		try {
			const cell = view.part('cell', 'h|name') as HTMLElement
			cell.getBoundingClientRect = () => ({ width: 180, height: 20 }) as DOMRect
			await view.keys('Tab', 'Alt+ArrowRight')
			const asked = { name: 190, team: 100, role: 100, score: 80 }
			expect(changes).toEqual([asked])
			expect(commits).toEqual([asked])
			// The owner did not pass the value back, so the state is as before.
			expect(view.state.columnWidths.name).toBe(180)

			view.api.setColumnWidth('name', 200)
			expect(commits.at(-1)).toEqual({ ...asked, name: 200 })
			view.api.resetColumnWidths()
			expect(commits.at(-1)).toEqual({})
		} finally {
			view.unmount()
		}
	})

	test('a drag that the caller refuses at every step ends without a commit', async () => {
		const commits: unknown[] = []
		const view = setup(flat, {
			resizable: true,
			onColumnWidthsChange: (_value, details) => details.cancel(),
			onColumnWidthsCommit: (value) => commits.push(value),
		})
		try {
			await view.drag(view.part('resizer', 'name') as HTMLElement, { by: { x: 30, y: 0 } })
			expect(view.state.columnWidths).toEqual({})
			expect(commits).toEqual([])
			expect(view.announced).toEqual([])
		} finally {
			view.unmount()
		}
	})

	test('a pointer resize ends on the pixel where the pointer is', async () => {
		const view = setup(flat, { resizable: true })
		try {
			const handle = view.part('resizer', 'name') as HTMLElement
			await view.drag(handle, { by: { x: 33, y: 0 } })
			expect(view.state.columnWidths.name).toBe(153)
			expect(handle.getAttribute('aria-valuetext')).toBe('Name, 153 pixels wide.')
			expect(view.changes.at(-1)).toMatchObject({ key: 'columnWidths', source: 'mouse' })
			handle.focus()
			await view.keys('ArrowRight')
			expect(view.changes.at(-1)).toMatchObject({ reason: 'resize-key', source: 'keyboard' })
		} finally {
			view.unmount()
		}
	})
})

describe('column rules at the edges', () => {
	const grouped: ColumnDef<Person>[] = [
		{ id: 'name' },
		{ id: 'work', columns: [{ id: 'team', hideable: false }, { id: 'role' }] },
		{ id: 'score' },
	]

	test('a header group cannot hide a column that cannot be hidden', () => {
		const view = setup(grouped)
		try {
			expect(() => view.api.setColumnVisibility('work', false)).toThrow(
				'Column "team" cannot be hidden, so header group "work" cannot be hidden.',
			)
			expect(() => view.api.toggleColumnVisibility('work')).toThrow('cannot be hidden')
			expect(ids(view.api.columns())).toEqual(['name', 'team', 'role', 'score'])
		} finally {
			view.unmount()
		}
	})

	test('a column under a hidden header group cannot show alone, and the error says why', () => {
		const view = setup(nested, { defaultColumnVisibility: { work: false } })
		try {
			expect(() => view.api.setColumnVisibility('team', true)).toThrow(
				'Column "team" stays hidden while header group "work" is hidden. Show "work" first.',
			)
			expect(() => view.api.toggleColumnVisibility('team')).toThrow('Show "work" first')
			expect(view.state.columnVisibility).toEqual({ work: false })
			// A header group is a valid id for these two methods, so the error lists the groups too.
			expect(() => view.api.setColumnVisibility('nope', false)).toThrow('Header groups: work.')
			view.api.setColumnVisibility('work', true)
			expect(ids(view.api.columns())).toEqual(['name', 'team', 'role', 'score'])
		} finally {
			view.unmount()
		}
	})

	test('a column that is pinned again keeps its place, and an order cannot name a column twice', () => {
		const view = setup(flat, { defaultColumnPinning: { start: ['name', 'team'] } })
		try {
			view.api.pinColumn('name', 'start')
			expect(view.state.columnPinning).toEqual({ start: ['name', 'team'] })
			expect(view.changes).toEqual([])
			expect(() => view.api.setColumnOrder(['role', 'score', 'role'])).toThrow(
				'Column "role" is in the order twice.',
			)
		} finally {
			view.unmount()
		}
	})

	test('`moveColumn` moves a column also when a person cannot', () => {
		const view = setup()
		try {
			view.api.moveColumn('score', 0)
			expect(ids(view.api.columns())).toEqual(['score', 'name', 'team', 'role'])
		} finally {
			view.unmount()
		}
	})

	test('the header group above a pinned column is pinned with it', () => {
		const pinning = { start: ['role'], end: ['team'] }
		const view = setup(nested, { defaultColumnPinning: pinning })
		try {
			const groups = layoutColumns(nested, { pinning }).headerRows[0]?.filter(
				(cell) => cell.column.id === 'work',
			)
			expect(groups?.map((cell) => cell.pin)).toEqual(['start', 'end'])
			for (const cell of groups ?? []) {
				const el = view.part('cell', `h|${cell.key}`)
				expect(el?.getAttribute('data-pinned')).toBe(cell.pin)
				expect(el?.hasAttribute('data-pinned-edge')).toBe(true)
				expect(style(el)).toContain(`--table-pin-offset:var(--table-pin-${cell.pin}-0,0px)`)
			}
		} finally {
			view.unmount()
		}
	})

	test('a press in a text field of a header does not pick the column up', async () => {
		const view = setup(flat, { reorderable: true })
		try {
			const cell = view.part('cell', 'h|team') as HTMLElement
			const field = document.createElement('input')
			cell.append(field)
			const press = () => new PointerEvent('pointerdown', { bubbles: true, button: 0 })
			const move = () =>
				new PointerEvent('pointermove', { bubbles: true, clientX: 300, clientY: 0 })
			field.dispatchEvent(press())
			field.dispatchEvent(move())
			expect(view.state.columnDrag).toBeNull()
			document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
			// The same press on the header itself picks the column up.
			cell.dispatchEvent(press())
			cell.dispatchEvent(move())
			expect(view.state.columnDrag).not.toBeNull()
			document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
			await view.settle()
		} finally {
			view.unmount()
		}
	})
})
