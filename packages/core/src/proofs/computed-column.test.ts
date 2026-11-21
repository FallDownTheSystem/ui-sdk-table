import { expect, test } from 'vite-plus/test'
import { createRowModel, type ColumnDef, type GroupRow, type SortRule } from '../rows'

// P3 of the formula work: a computed column is a column with `value`, and
// its value is kept for each row object in a `WeakMap`. These tests use a
// plain function in place of a formula; what they prove is how the row
// pipeline treats such a column.

type Order = { id: string; created: string; amount: number }

const orders: Order[] = [
	{ id: 'a', created: '2026-11-18', amount: 40 },
	{ id: 'b', created: '2026-11-02', amount: 10 },
	{ id: 'c', created: '2026-11-20', amount: 25 },
	{ id: 'd', created: '2026-10-30', amount: 5 },
	{ id: 'e', created: '2026-11-03', amount: 15 },
]

/** The Monday of the week of a day, as a day text: the value of a week group. */
function mondayOf(day: string): string {
	const time = Date.parse(`${day}T00:00:00Z`)
	const back = (new Date(time).getUTCDay() + 6) % 7
	return new Date(time - back * 86_400_000).toISOString().slice(0, 10)
}

/** A column whose value is computed once for each row object, and the count of the computations. */
function weekColumn() {
	const kept = new WeakMap<object, unknown>()
	const runs = { count: 0 }
	const column: ColumnDef<Order> = {
		id: 'week',
		value: (row) => {
			if (kept.has(row)) return kept.get(row)
			runs.count++
			const value = mondayOf(row.created)
			kept.set(row, value)
			return value
		},
	}
	return { column, runs }
}

function setup() {
	const base: ColumnDef<Order>[] = [{ id: 'created' }, { id: 'amount', aggregate: 'sum' }]
	const week = weekColumn()
	const state = {
		rows: orders as readonly Order[],
		columns: [...base, week.column] as readonly ColumnDef<Order>[],
		sort: [{ id: 'week' }, { id: 'created' }] as readonly SortRule[],
		groupBy: ['week'] as readonly string[],
		filter: {},
	}
	const model = createRowModel<Order>({
		rows: () => state.rows,
		columns: () => state.columns,
		sort: () => state.sort,
		groupBy: () => state.groupBy,
		filter: () => state.filter,
	})
	return { model, state, base, week }
}

test('P3: a group by a day text keeps the time order of a sort, and its key is the day', () => {
	const { model, week } = setup()
	const groups = model.grouped() as GroupRow<Order>[]
	expect(groups.map((group) => group.value)).toEqual(['2026-10-26', '2026-11-02', '2026-11-16'])
	expect(groups.map((group) => group.leaves.map((leaf) => leaf.id))).toEqual([
		['d'],
		['b', 'e'],
		['a', 'c'],
	])
	expect(model.aggregate(groups[1]).amount).toBe(25)
	// A sort and a group read the value of each row once; the rest comes from the map.
	expect(week.runs.count).toBe(5)
})

test('P3: a date range filter reads the day text of the computed column', () => {
	const { model, state } = setup()
	state.filter = { columns: { week: { from: '2026-11-01', to: '2026-11-30' } } }
	expect(model.filtered().map((row) => row.id)).toEqual(['b', 'e', 'a', 'c'])
})

test('P3: new column objects run the stages again, and the same columns run nothing', () => {
	const { model, state, base } = setup()
	const sorted = model.sorted()
	const grouped = model.grouped()

	// A cell formula changes no column and no row object: the table passes the same arrays.
	expect(model.sorted()).toBe(sorted)
	expect(model.grouped()).toBe(grouped)

	// A new column formula is a new column object in a new array.
	const month = weekColumn()
	state.columns = [...base, { ...month.column, value: (row: Order) => row.created.slice(0, 7) }]
	state.groupBy = ['week']
	expect(model.sorted()).not.toBe(sorted)
	expect(model.grouped()).not.toBe(grouped)
	expect((model.grouped() as GroupRow<Order>[]).map((group) => group.value)).toEqual([
		'2026-10',
		'2026-11',
	])
})

test('P3: an owner that changes a row object in place gets the value that was kept', () => {
	const { model, state, week } = setup()
	const first = model.grouped() as GroupRow<Order>[]
	expect(first.map((group) => group.value)).toContain('2026-10-26')

	// The owner changes the date of row d inside its object, and passes new
	// rows so that the pipeline runs again.
	const d = orders[3] as Order
	const changed = { ...d }
	const before = d.created
	d.created = '2026-11-19'
	state.rows = [...orders]
	try {
		const groups = model.grouped() as GroupRow<Order>[]
		// The kept value of the old object is read: row d stays in the week of October.
		expect(groups.find((group) => group.leaves.some((leaf) => leaf.id === 'd'))?.value).toBe(
			'2026-10-26',
		)
		// A new object for the changed row, as the table asks of an owner, is computed again.
		changed.created = '2026-11-19'
		state.rows = orders.map((row) => (row.id === 'd' ? changed : row))
		const again = model.grouped() as GroupRow<Order>[]
		expect(again.find((group) => group.leaves.some((leaf) => leaf.id === 'd'))?.value).toBe(
			'2026-11-16',
		)
		expect(week.runs.count).toBe(6)
	} finally {
		d.created = before
	}
})
