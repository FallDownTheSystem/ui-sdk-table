import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import type { ColumnDef, GroupRow } from './rows'
import { table, type TableOptions } from './table'

type Person = {
	id: string
	name: string
	team: string
	country: string
	score: number
	hours: number
	note: string
	reports?: Person[]
}

const person = (
	id: string,
	name: string,
	team: string,
	country: string,
	score: number,
): Person => ({
	id,
	name,
	team,
	country,
	score,
	hours: score / 10,
	note: '',
})

const people: Person[] = [
	person('a', 'Aino', 'Design', 'Finland', 70),
	person('b', 'Eero', 'Platform', 'Sweden', 20),
	person('c', 'Helmi', 'Design', 'Sweden', 45),
	person('d', 'Onni', 'Design', 'Finland', 5),
]

const columns: ColumnDef<Person>[] = [
	{ id: 'name' },
	{ id: 'team' },
	{ id: 'country' },
	{ id: 'score', aggregate: 'sum', format: 'integer' },
	{ id: 'hours', aggregate: 'mean', format: 'decimal' },
	{ id: 'note' },
]

const DESIGN = 'group/team=Design'
const PLATFORM = 'group/team=Platform'

type Options = Partial<TableOptions<Person>>

/**
 * Markup for the rows that the table shows at the start, in the way a
 * renderer writes it: a group row has its label cell, as wide as the table
 * says, and one cell for each column after it.
 */
function setup(options: Options = {}, cols: readonly ColumnDef<Person>[] = columns) {
	const all = { rows: people, columns: cols, defaultGroupBy: ['team'], ...options } as TableOptions
	// A first table says which rows and columns there are. It has no parts.
	const plan = mount(table, all, '<root aria-label="Plan"></root>')
	const leaves = plan.api.columns()
	const span = plan.api.groupSpan()
	const head = plan.api.headerRowCount()
	const header = leaves.map(
		(column, col) => `<cell value="h|${column.id}" row="0" col="${col}" header>x</cell>`,
	)
	const body = plan.api.rows().map((flat, position) => {
		const row = head + position
		let cells: string[]
		if (flat.node.kind === 'group') {
			const label = span ?? leaves.length
			cells = [`<cell value="g|${flat.id}" row="${row}" col="0" colspan="${label}">x</cell>`]
			for (let col = label; col < leaves.length; col++) {
				cells.push(
					`<cell value="t|${flat.id}|${leaves[col]?.id}" row="${row}" col="${col}">x</cell>`,
				)
			}
		} else {
			cells = leaves.map(
				(column, col) =>
					`<cell value="r|${flat.id}|${column.id}" row="${row}" col="${col}">x</cell>`,
			)
		}
		return `<row value="${flat.id}" index="${row}">${cells.join('')}</row>`
	})
	plan.unmount()
	return mount(
		table,
		all,
		`<root aria-label="People"><header-row index="0">${header.join('')}</header-row>${body.join('')}</root>`,
	)
}

const group = (view: ReturnType<typeof setup>, id: string) =>
	view.api.rows().find((row) => row.id === id)?.node as GroupRow<unknown>

describe('the totals of a group under their columns', () => {
	test('a group row has a label cell, and a cell for each column from the first total on', () => {
		const view = setup()
		try {
			// The label covers the columns before the first total: name, team and country.
			expect(view.api.groupSpan()).toBe(3)
			const label = view.part('cell', `g|${DESIGN}`)
			expect(label?.getAttribute('role')).toBe('gridcell')
			expect(label?.getAttribute('colspan')).toBe('3')
			expect(label?.getAttribute('aria-colindex')).toBe('1')
			expect(label?.getAttribute('data-kind')).toBe('group-label')
			const score = view.part('cell', `t|${DESIGN}|score`)
			expect(score?.getAttribute('role')).toBe('gridcell')
			expect(score?.getAttribute('aria-colindex')).toBe('4')
			expect(score?.getAttribute('data-column')).toBe('score')
			expect(score?.getAttribute('data-kind')).toBe('group-total')
			expect(score?.hasAttribute('colspan')).toBe(false)
			// A column without a total keeps its place, so every total is under its header.
			const note = view.part('cell', `t|${DESIGN}|note`)
			expect(note?.getAttribute('aria-colindex')).toBe('6')
			expect(note?.getAttribute('data-kind')).toBe('group-blank')
			// The row is the row of a tree, as before.
			const row = view.part('row', DESIGN)
			expect(row?.getAttribute('aria-expanded')).toBe('false')
			expect(row?.getAttribute('aria-level')).toBe('1')
			expect(row?.getAttribute('data-kind')).toBe('group')
			expect(view.root.getAttribute('aria-colcount')).toBe('6')
		} finally {
			view.unmount()
		}
	})

	test('the arrow keys go through the cells of a group row, and Enter and Space act on the group', async () => {
		const view = setup({ selection: 'multiple', defaultExpanded: [DESIGN] })
		try {
			const cell = (key: string) => view.part('cell', key)
			await view.keys('Tab', 'ArrowDown')
			expect(document.activeElement).toBe(cell(`g|${DESIGN}`))
			await view.keys('ArrowRight')
			expect(document.activeElement).toBe(cell(`t|${DESIGN}|score`))
			expect(view.state.active).toEqual({ row: 1, col: 3 })
			await view.keys('ArrowRight', 'ArrowRight')
			expect(document.activeElement).toBe(cell(`t|${DESIGN}|note`))
			// The total is above the cells of its column.
			await view.keys('ArrowLeft', 'ArrowDown')
			expect(document.activeElement).toBe(cell('r|a|hours'))
			await view.keys('ArrowUp', 'Home')
			expect(document.activeElement).toBe(cell(`g|${DESIGN}`))
			// From the label, down goes on in the column where the person came from:
			// the last column under the label, after a step to the left into it.
			await view.keys('ArrowRight', 'ArrowLeft', 'ArrowDown')
			expect(document.activeElement).toBe(cell('r|a|country'))
			await view.keys('ArrowLeft', 'ArrowUp')
			expect(document.activeElement).toBe(cell(`g|${DESIGN}`))
			await view.keys('ArrowDown')
			expect(document.activeElement).toBe(cell('r|a|team'))
			await view.keys('ArrowUp')
			await view.keys('End')
			expect(document.activeElement).toBe(cell(`t|${DESIGN}|note`))

			// A total cell is a cell of the group row: Space selects the rows of the group, Enter closes it.
			await view.keys('ArrowLeft', 'Space')
			expect(view.state.selected).toEqual(['a', 'c', 'd'])
			await view.keys('Enter')
			expect(view.state.expanded).toEqual([])
			expect(view.changes.at(-1)).toMatchObject({ key: 'expanded', reason: 'press' })
		} finally {
			view.unmount()
		}
	})

	test('without a total, or with `groupTotals` off, a group row is one wide cell', async () => {
		const plain = setup(
			{},
			columns.map(({ aggregate: _aggregate, ...column }) => column),
		)
		const off = setup({ groupTotals: false })
		try {
			for (const view of [plain, off]) {
				expect(view.api.groupSpan()).toBeUndefined()
				const label = view.part('cell', `g|${DESIGN}`)
				expect(label?.getAttribute('colspan')).toBe('6')
				expect(label?.getAttribute('data-kind')).toBe('group-label')
				expect(view.part('cell', `t|${DESIGN}|score`)).toBeUndefined()
			}
			await off.keys('Tab', 'ArrowRight', 'ArrowRight', 'ArrowDown')
			expect(document.activeElement).toBe(off.part('cell', `g|${DESIGN}`))
			await off.keys('ArrowRight')
			expect(document.activeElement).toBe(off.part('cell', `g|${DESIGN}`))
		} finally {
			plain.unmount()
			off.unmount()
		}
	})

	test('the label stops at a pinned edge, and follows hidden, moved and leading columns', () => {
		const span = (options: Options, cols = columns) => {
			const view = setup(options, cols)
			try {
				return view.api.groupSpan()
			} finally {
				view.unmount()
			}
		}
		// A pinned name sticks, and the free columns after it scroll: the label is the pinned cell.
		expect(span({ defaultColumnPinning: { start: ['name'] } })).toBe(1)
		expect(span({ defaultColumnPinning: { start: ['name', 'team'] } })).toBe(2)
		// A total that is pinned to the end is still under its header.
		expect(span({ defaultColumnPinning: { end: ['score'] } })).toBe(3)
		expect(span({ defaultColumnVisibility: { team: false, country: false } })).toBe(1)
		expect(span({ defaultColumnOrder: ['name', 'score'] })).toBe(1)
		// The first column has a total: the label covers it, and the columns up to the next total.
		expect(span({ defaultColumnOrder: ['score', 'name'] })).toBe(4)
		// A column that leads the table holds a control of the row. The label starts there and takes the first column too.
		const lead: ColumnDef<Person>[] = [{ id: 'pick', lead: true }, ...columns]
		expect(span({}, lead)).toBe(4)
		expect(span({ defaultColumnPinning: { start: ['name'] } }, lead)).toBe(2)
		expect(span({ defaultColumnOrder: ['score'] }, lead)).toBe(5)

		const pinned = setup({ defaultColumnPinning: { start: ['name'], end: ['hours'] } }, lead)
		try {
			const label = pinned.part('cell', `g|${DESIGN}`)
			expect(label?.getAttribute('colspan')).toBe('2')
			expect(label?.getAttribute('data-pinned')).toBe('start')
			// Its far column is the last start pin, next to the columns that scroll.
			expect(label?.hasAttribute('data-pinned-edge')).toBe(true)
			expect(label?.getAttribute('style')).toContain('--table-pin-offset')
			expect(pinned.part('cell', `t|${DESIGN}|score`)?.hasAttribute('data-pinned')).toBe(false)
			expect(pinned.part('cell', `t|${DESIGN}|hours`)?.getAttribute('data-pinned')).toBe('end')
		} finally {
			pinned.unmount()
		}
	})

	test('a group row is never part of a range of cells, and a copy gives an empty line for it', async () => {
		const view = setup({ cellSelection: true, defaultExpanded: [DESIGN, PLATFORM] })
		try {
			view.api.selectCells({ rowId: 'd', columnId: 'score' }, { rowId: 'b', columnId: 'hours' })
			expect(view.part('cell', 'r|d|score')?.hasAttribute('data-selected')).toBe(true)
			expect(view.part('cell', 'r|b|hours')?.hasAttribute('data-selected')).toBe(true)
			for (const key of [`t|${PLATFORM}|score`, `t|${PLATFORM}|hours`, `g|${PLATFORM}`]) {
				const cell = view.part('cell', key)
				expect(cell?.hasAttribute('data-selected')).toBe(false)
				expect(cell?.hasAttribute('aria-selected')).toBe(false)
				expect(cell?.hasAttribute('data-range-edge')).toBe(false)
			}
			expect(view.api.copyCells()).toBe('5\t0.5\n\t\n20\t2')
		} finally {
			view.unmount()
		}
	})
})

describe('one implementation for the totals of the footer, a group and an export', () => {
	const exported = (view: ReturnType<typeof setup>, rows: 'filtered' | 'page' = 'filtered') => {
		const data = view.api.exportData({ rows, groups: true, totals: true })
		const cells = (row: (typeof data.rows)[number] | undefined) =>
			Object.fromEntries(
				data.columns.flatMap((column, index) =>
					column.column.aggregate === undefined ? [] : [[column.id, row?.cells[index]?.value]],
				),
			)
		return {
			total: cells(data.rows.find((row) => row.kind === 'total')),
			groups: Object.fromEntries(
				data.rows.flatMap((row) =>
					row.kind === 'group' ? [[row.label ?? '', cells(row)] as const] : [],
				),
			),
		}
	}

	test('`getTotals` gives the totals of the footer and of a group, with their texts', () => {
		const view = setup()
		try {
			expect(view.api.getTotals()).toEqual({
				score: { value: 140, text: '140' },
				hours: { value: 3.5, text: '3.50' },
			})
			expect(view.api.getTotals(DESIGN)).toEqual({
				score: { value: 120, text: '120' },
				hours: { value: 4, text: '4.00' },
			})
			expect(view.api.totals(group(view, DESIGN))).toEqual({ score: 120, hours: 4 })
			expect(() => view.api.getTotals('group/team=Sales')).toThrow(
				`No group "group/team=Sales" to read the totals of. Groups: ${DESIGN}, ${PLATFORM}.`,
			)
		} finally {
			view.unmount()
		}
	})

	test('in a filtered table, the three agree, and a pinned row that the filter refuses is in none', () => {
		const view = setup({
			defaultFilter: { columns: { country: 'Sweden' } },
			// Aino is pinned and is in Finland: she is in view, and not in a total.
			defaultRowPinning: { top: ['a'] },
		})
		try {
			expect(view.api.rows().map((row) => row.id)).toEqual(['a', PLATFORM, DESIGN])
			expect(view.api.totals()).toEqual({ score: 65, hours: 3.25 })
			expect(view.api.totals(group(view, DESIGN))).toEqual({ score: 45, hours: 4.5 })
			const file = exported(view)
			expect(file.total).toEqual(view.api.totals())
			expect(file.groups['Sweden (1)']).toBeUndefined()
			expect(file.groups['Design (1)']).toEqual(view.api.totals(group(view, DESIGN)))
			expect(file.groups['Platform (1)']).toEqual(view.api.totals(group(view, PLATFORM)))
			// A pinned row that passes the filter is in the totals, and in its group no more: it left the list.
			view.api.pinRow('c', 'top')
			expect(view.api.totals()).toEqual({ score: 65, hours: 3.25 })
			expect(view.api.rows().map((row) => row.id)).toEqual(['a', 'c', PLATFORM])
			expect(exported(view).total).toEqual(view.api.totals())
		} finally {
			view.unmount()
		}
	})

	test('a page holds whole groups, so the total of a group is of all its rows on every page', () => {
		const view = setup({ defaultPage: { page: 2, pageSize: 1 }, defaultExpanded: [PLATFORM] })
		try {
			expect(view.api.rows().map((row) => row.id)).toEqual([PLATFORM, 'b'])
			expect(view.api.totals(group(view, PLATFORM))).toEqual({ score: 20, hours: 2 })
			// The footer is of every row that passes the filters, on all pages.
			expect(view.api.totals()).toEqual({ score: 140, hours: 3.5 })
			const file = exported(view, 'page')
			expect(file.total).toEqual(view.api.totals())
			expect(file.groups).toEqual({ 'Platform (1)': { score: 20, hours: 2 } })
		} finally {
			view.unmount()
		}
	})

	test('child rows count in the total of their group and of the footer, open or not', () => {
		const tree: Person[] = [
			{ ...person('a', 'Aino', 'Design', 'Finland', 70), reports: [people[2] as Person] },
			person('b', 'Eero', 'Platform', 'Sweden', 20),
		]
		const view = setup({ rows: tree, getChildren: (row) => row.reports })
		try {
			expect(view.api.totals(group(view, DESIGN))).toEqual({ score: 115, hours: 5.75 })
			expect(view.api.totals()).toEqual({ score: 135, hours: 4.5 })
			const file = exported(view)
			expect(file.total).toEqual(view.api.totals())
			expect(file.groups['Design (1)']).toEqual(view.api.totals(group(view, DESIGN)))
			// A parent that stays because a child passes the filter is on the screen, so it counts.
			view.api.setSearch('Helmi')
			expect(view.api.totals()).toEqual({ score: 115, hours: 5.75 })
			expect(exported(view).total).toEqual(view.api.totals())
		} finally {
			view.unmount()
		}
	})

	test('with rows from a server, the totals are of the page that the table has, until the owner gives them', () => {
		const server = { manualFilter: true, manualPage: true, rowCount: 40 }
		const page = people.slice(0, 2)
		const plain = setup({ ...server, rows: page, defaultPage: { page: 1, pageSize: 2 } })
		const given = setup({
			...server,
			rows: page,
			defaultPage: { page: 1, pageSize: 2 },
			totals: { table: { score: 1234 }, groups: { [DESIGN]: { score: 800, hours: 6 } } },
		})
		try {
			expect(plain.api.totals()).toEqual({ score: 90, hours: 4.5 })
			// The owner knows the sum of all 40 rows. The mean that it did not give is of the page.
			expect(given.api.totals()).toEqual({ score: 1234, hours: 4.5 })
			expect(given.api.getTotals().score).toEqual({ value: 1234, text: '1,234' })
			expect(given.api.totals(group(given, DESIGN))).toEqual({ score: 800, hours: 6 })
			expect(given.api.totals(group(given, PLATFORM))).toEqual({ score: 20, hours: 2 })
			const file = exported(given)
			expect(file.total).toEqual({ score: 1234, hours: 4.5 })
			expect(file.groups['Design (1)']).toEqual({ score: 800, hours: 6 })
			// The same object while nothing changed, so a part that reads it does not render again.
			expect(given.api.totals()).toBe(given.api.totals())
		} finally {
			plain.unmount()
			given.unmount()
		}
	})

	test('totals of the owner with a wrong shape or a wrong column fail with the reason', () => {
		const totals = (given: unknown) => {
			const view = setup({ totals: given as never })
			try {
				view.api.totals()
			} finally {
				view.unmount()
			}
		}
		expect(() => totals({ footer: {} })).toThrow(
			'`totals` is an object with `table` (totals by column id) and `groups` (totals by group id, then by column id).',
		)
		expect(() => totals({ table: { points: 1 } })).toThrow(
			'No column "points" to give a total to. Columns with a total: score, hours.',
		)
		expect(() => totals({ groups: { [DESIGN]: { name: 'x' } } })).toThrow(
			'Column "name" has no `aggregate`, so it shows no total. Columns with a total: score, hours.',
		)
	})
})

describe('the path of a group', () => {
	test('a nested group knows the groups above it, each with its column, value and text', () => {
		const dated = columns.map((column) =>
			column.id === 'score' ? { ...column, formatOptions: { suffix: ' pts' } } : column,
		)
		const view = setup(
			{
				defaultGroupBy: ['team', 'score'],
				defaultExpanded: [DESIGN],
			},
			dated,
		)
		try {
			const inner = view.api.rows().find((row) => row.id === `${DESIGN}/score=70`)
			const node = inner?.node as GroupRow<unknown>
			const path = view.api.groupPath(node)
			expect(path.map((entry) => [entry.column?.id, entry.value, entry.text])).toEqual([
				['team', 'Design', 'Design'],
				['score', 70, '70 pts'],
			])
			expect(path[0]?.group).toBe(group(view, DESIGN))
			expect(path[1]?.group).toBe(node)
			expect(node.parent).toBe(group(view, DESIGN))
			expect(group(view, DESIGN).parent).toBeNull()
			// Kept for the group, and the path of the outer group is its own.
			expect(view.api.groupPath(node)).toBe(path)
			expect(view.api.groupPath(group(view, DESIGN))).toEqual([path[0]])
			expect(view.api.getTotals(node.id)).toEqual({
				score: { value: 70, text: '70 pts' },
				hours: { value: 7, text: '7.00' },
			})
		} finally {
			view.unmount()
		}
	})
})

describe('the function of a total, chosen at run time', () => {
	test('a choice wins over the definition, in the footer, in a group row, in `getTotals` and in an export', () => {
		const view = setup()
		try {
			view.api.setColumnAggregate('score', 'mean')
			expect(view.state.columnAggregates).toEqual({ score: 'mean' })
			expect(view.changes.at(-1)).toMatchObject({ key: 'columnAggregates' })
			expect(view.api.getView().columnAggregates).toEqual({ score: 'mean' })
			expect(view.api.getTotals()).toEqual({
				score: { value: 35, text: '35' },
				hours: { value: 3.5, text: '3.50' },
			})
			expect(view.api.getTotals(DESIGN).score).toEqual({ value: 40, text: '40' })
			expect(view.api.totals(group(view, DESIGN))).toEqual({ score: 40, hours: 4 })
			const data = view.api.exportData({ groups: true, totals: true })
			const score = data.columns.findIndex((column) => column.id === 'score')
			expect(data.rows.find((row) => row.kind === 'total')?.cells[score]).toEqual({
				value: 35,
				text: '35',
			})
			expect(
				data.rows.find((row) => row.kind === 'group' && row.label?.startsWith('Design'))?.cells[
					score
				],
			).toEqual({ value: 40, text: '40' })
			// A count is a plain number, whatever the format of the column.
			view.api.setColumnAggregate('hours', 'count')
			expect(view.api.getTotals().hours).toEqual({ value: 4, text: '4' })
			// `undefined` gives the column the function of its definition back.
			view.api.setColumnAggregate('score', undefined)
			view.api.setColumnAggregate('hours', undefined)
			expect(view.state.columnAggregates).toEqual({})
			expect(view.api.getTotals()).toEqual({
				score: { value: 140, text: '140' },
				hours: { value: 3.5, text: '3.50' },
			})
		} finally {
			view.unmount()
		}
	})

	test('`null` takes a total away, and the footer row goes with the last one', () => {
		const view = setup()
		try {
			expect(view.api.footerRowCount()).toBe(1)
			const rows = view.api.gridRowCount()
			view.api.setColumnAggregate('score', null)
			expect(view.api.getTotals()).toEqual({ hours: { value: 3.5, text: '3.50' } })
			expect(view.api.footerRowCount()).toBe(1)
			// The label of a group row now covers the score column too.
			expect(view.api.groupSpan()).toBe(4)
			expect(view.api.groupCell(1, 3)).toBe('group-label')
			view.api.setColumnAggregate('hours', null)
			expect(view.api.getTotals()).toEqual({})
			expect(view.api.footerRowCount()).toBe(0)
			expect(view.api.gridRowCount()).toBe(rows - 1)
			// A group row is one wide cell again.
			expect(view.api.groupSpan()).toBeUndefined()
		} finally {
			view.unmount()
		}
	})

	test('a column without an `aggregate` gets one, and the footer row comes', () => {
		const plain: ColumnDef<Person>[] = [{ id: 'name' }, { id: 'team' }, { id: 'score' }]
		const view = setup({}, plain)
		try {
			expect(view.api.footerRowCount()).toBe(0)
			expect(view.api.groupSpan()).toBeUndefined()
			view.api.setColumnAggregate('score', 'max')
			expect(view.api.footerRowCount()).toBe(1)
			expect(view.api.groupSpan()).toBe(2)
			expect(view.api.getTotals()).toEqual({ score: { value: 70, text: '70' } })
			expect(view.api.getTotals(PLATFORM)).toEqual({ score: { value: 20, text: '20' } })
			// The column object is the one of the caller, with no `aggregate` on it.
			expect(view.api.column('score')).toBe(plain[2])
			expect(plain[2]).toEqual({ id: 'score' })
		} finally {
			view.unmount()
		}
	})

	test('the cells of a total say their function, and a chosen function names the footer cell', () => {
		const view = setup()
		try {
			const total = view.part('cell', `t|${DESIGN}|score`)
			expect(total?.getAttribute('data-aggregate')).toBe('sum')
			expect(view.part('cell', `t|${DESIGN}|note`)?.hasAttribute('data-aggregate')).toBe(false)
			expect(view.part('cell', `g|${DESIGN}`)?.hasAttribute('data-aggregate')).toBe(false)
			const score = view.api.column('score')
			if (!score) throw new Error('no score column')
			// The function of the definition is not said: the cell reads as before.
			expect(view.api.footerLabel(score)).toBeUndefined()
			view.api.setColumnAggregate('score', 'mean')
			expect(view.api.footerLabel(score)).toBe('Average: 35')
			view.api.setColumnAggregate('score', null)
			expect(view.api.footerLabel(score)).toBeUndefined()
		} finally {
			view.unmount()
		}
	})

	test('the totals of the owner still win, and a total for a column whose total was taken away is refused', () => {
		const view = setup({ totals: { table: { score: 1234 } } })
		try {
			view.api.setColumnAggregate('score', 'mean')
			// The owner hears the change and gives the number of the function: the table shows what it gives.
			expect(view.api.getTotals().score).toEqual({ value: 1234, text: '1,234' })
			view.api.setColumnAggregate('score', null)
			expect(() => view.api.getTotals()).toThrow(
				'Column "score" has no `aggregate`, so it shows no total. Columns with a total: hours.',
			)
		} finally {
			view.unmount()
		}
	})

	test('`setColumnAggregate` checks its arguments and lists the valid values', () => {
		const view = setup()
		try {
			expect(() => view.api.setColumnAggregate('age', 'sum')).toThrow(
				'No column "age" to set the total of. Columns: name, team, country, score, hours, note.',
			)
			expect(() => view.api.setColumnAggregate('score', 'median' as 'sum')).toThrow(
				'No aggregate "median" for column "score". Aggregates: sum, mean, min, max, count, uniqueCount, first; null for no total, or undefined for the aggregate of the column.',
			)
			// The same choice again is no change.
			view.api.setColumnAggregate('score', 'mean')
			const changes = view.changes.length
			view.api.setColumnAggregate('score', 'mean')
			view.api.setColumnAggregate('hours', undefined)
			expect(view.changes).toHaveLength(changes)
		} finally {
			view.unmount()
		}
	})

	test('a listener can refuse a choice, and a default starts the table with one', () => {
		const refused = setup({ onColumnAggregatesChange: (_value, details) => details.cancel() })
		try {
			refused.api.setColumnAggregate('score', 'mean')
			expect(refused.state.columnAggregates).toEqual({})
			expect(refused.api.getTotals().score?.value).toBe(140)
		} finally {
			refused.unmount()
		}
		const started = setup({ defaultColumnAggregates: { score: 'max', hours: null } })
		try {
			expect(started.api.getTotals()).toEqual({ score: { value: 70, text: '70' } })
			expect(started.api.groupSpan()).toBe(3)
		} finally {
			started.unmount()
		}
	})
})
