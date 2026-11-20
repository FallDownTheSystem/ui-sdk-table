import { describe, expect, test } from 'vite-plus/test'
import {
	createRowModel,
	createRowNodes,
	createRowPredicate,
	dateRange,
	dayEnd,
	filterRows,
	flattenRows,
	isEmptyFilter,
	sortRows,
	toTime,
	uniqueValues,
	type ColumnDef,
} from './index'

type Item = { id: string; n?: number; when?: Date | string; kids?: Item[] }

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id)
const nodes = (rows: Item[]) => createRowNodes(rows, { getChildren: (row) => row.kids }).rows

describe('sort', () => {
	test('a column inside a header group sorts by its own id', () => {
		const columns: ColumnDef<Item>[] = [{ id: 'numbers', columns: [{ id: 'n' }] }]
		const list = nodes([
			{ id: 'a', n: 2 },
			{ id: 'b', n: 1 },
		])
		expect(ids(sortRows(list, [{ id: 'n' }], { columns }))).toEqual(['b', 'a'])
		expect(() => sortRows(list, [{ id: 'numbers' }], { columns })).toThrow('Columns: n.')
	})

	test('NaN and an invalid date go last and leave the other rows in order', () => {
		const numbers = nodes([
			{ id: 'a', n: 5 },
			{ id: 'b', n: NaN },
			{ id: 'c', n: 3 },
			{ id: 'd', n: 1 },
		])
		expect(ids(sortRows(numbers, [{ id: 'n' }], { columns: [{ id: 'n' }] }))).toEqual([
			'd',
			'c',
			'a',
			'b',
		])
		const dates = nodes([
			{ id: 'a', when: new Date('2025-05-01') },
			{ id: 'b', when: new Date('nope') },
			{ id: 'c', when: new Date('2024-05-01') },
		])
		expect(
			ids(sortRows(dates, [{ id: 'when', desc: true }], { columns: [{ id: 'when' }] })),
		).toEqual(['a', 'c', 'b'])
	})
})

describe('dates', () => {
	test('a day ends one millisecond before the next day starts, also when the clocks change', () => {
		for (const day of ['2025-03-30', '2025-10-26', '2025-11-02', '2025-03-09', '2025-06-15']) {
			const end = new Date(dayEnd(day) ?? NaN)
			expect([end.getHours(), end.getMinutes(), end.getMilliseconds()]).toEqual([23, 59, 999])
			expect(end.getDate()).toBe(Number(day.slice(8)))
		}
		expect(dayEnd('2025-03-30T10:00:00')).toBeUndefined()
	})

	test('the facet and the filter read a date without a time the same way', () => {
		const columns: ColumnDef<Item>[] = [{ id: 'when' }]
		const list = nodes([
			{ id: 'a', when: '2025-03-21' },
			{ id: 'b', when: '2025-03-25' },
		])
		const range = dateRange(list, columns[0] as ColumnDef<Item>)
		expect(range?.from.getTime()).toBe(new Date(2025, 2, 21).getTime())
		expect(toTime('2025-03-21')).toBe(new Date(2025, 2, 21).getTime())

		const predicate = createRowPredicate<Item>(
			{ columns: { when: { from: range?.from, to: range?.from } } },
			{ columns },
		)
		expect(predicate && ids(filterRows(list, predicate))).toEqual(['a'])
	})

	test('a select filter and the facet match dates by their moment', () => {
		const columns: ColumnDef<Item>[] = [{ id: 'when' }]
		const list = nodes([
			{ id: 'a', when: new Date(2025, 0, 1) },
			{ id: 'b', when: new Date(2025, 0, 1) },
			{ id: 'c', when: new Date(2025, 0, 2) },
		])
		expect(uniqueValues(list, columns[0] as ColumnDef<Item>).map((facet) => facet.count)).toEqual([
			2, 1,
		])
		const predicate = createRowPredicate<Item>(
			{ columns: { when: [new Date(2025, 0, 1)] } },
			{ columns },
		)
		expect(predicate && ids(filterRows(list, predicate))).toEqual(['a', 'b'])
	})
})

describe('filter values', () => {
	test('a Date is a filter value, not an empty range', () => {
		expect(isEmptyFilter(new Date())).toBe(false)
		expect(isEmptyFilter(new Set())).toBe(false)
		expect(isEmptyFilter({ from: null, to: '' })).toBe(true)
	})

	test('a range bound that is not a number is no bound', () => {
		const columns: ColumnDef<Item>[] = [{ id: 'n' }]
		const list = nodes([
			{ id: 'a', n: -5 },
			{ id: 'b', n: 50 },
			{ id: 'c', n: 500 },
		])
		const run = (range: unknown) => {
			const predicate = createRowPredicate<Item>({ columns: { n: range } }, { columns })
			return predicate ? ids(filterRows(list, predicate)) : null
		}
		expect(run({ min: NaN, max: 100 })).toEqual(['a', 'b'])
		expect(run({ min: '', max: 100 })).toEqual(['a', 'b'])
	})

	test('a parent that fails with every child passing is the same node, and nothing changed', () => {
		const list = nodes([
			{
				id: 'p',
				n: 0,
				kids: [
					{ id: 'k1', n: 1 },
					{ id: 'k2', n: 2 },
				],
			},
		])
		expect(filterRows(list, (row) => row.id !== 'p')).toBe(list)
	})
})

describe('row model', () => {
	const columns: ColumnDef<Item>[] = [{ id: 'n', aggregate: 'sum' }]
	const tree: Item[] = [
		{
			id: 'p',
			n: 100,
			kids: [
				{ id: 'k1', n: 1 },
				{ id: 'k2', n: 2 },
			],
		},
		{ id: 'q', n: 10 },
	]

	test('totals count tree children, and a parent that stays for a child', () => {
		const state = { filter: undefined as { columns: Record<string, unknown> } | undefined }
		const model = createRowModel<Item>({
			rows: () => tree,
			columns: () => columns,
			getChildren: (row) => row.kids,
			filter: () => state.filter,
		})
		expect(model.aggregate()).toEqual({ n: 113 })
		state.filter = { columns: { n: { max: 1 } } }
		expect(ids(model.filtered())).toEqual(['p'])
		expect(model.aggregate()).toEqual({ n: 101 })
	})

	test('the page is the one that is shown', () => {
		const model = createRowModel<Item>({
			rows: () => tree,
			columns: () => columns,
			page: () => ({ page: 7, pageSize: 1 }),
		})
		expect(model.page()).toBe(2)
		expect(ids(model.paged())).toEqual(['q'])
	})

	test('isExpanded without expansion fails at creation', () => {
		expect(() =>
			createRowModel<Item>({ rows: () => tree, columns: () => columns, isExpanded: () => true }),
		).toThrow('also needs `expansion`')
	})

	test('flat rows carry the position and the size of their set', () => {
		const flat = flattenRows(nodes(tree), () => true)
		expect(flat.map((row) => [row.id, row.level, row.position, row.setSize])).toEqual([
			['p', 0, 1, 2],
			['k1', 1, 1, 2],
			['k2', 1, 2, 2],
			['q', 0, 2, 2],
		])
	})
})
