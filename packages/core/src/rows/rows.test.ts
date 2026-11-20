import { describe, expect, test } from 'vite-plus/test'
import {
	aggregateRows,
	clampPage,
	createRowModel,
	createRowNodes,
	createRowPredicate,
	dateRange,
	filterRows,
	flattenRows,
	groupRows,
	isEmptyFilter,
	leafColumns,
	numberRange,
	pageCount,
	paginate,
	sortRows,
	uniqueValues,
	type ColumnDef,
	type DataRow,
	type FilterState,
	type GroupRow,
	type SortRule,
	type TableRow,
} from './index'

type Person = {
	id: string
	name: string
	team: string | null
	score: number | null
	joined: string
	tags?: string[]
	reports?: Person[]
}

const people: Person[] = [
	{ id: 'a', name: 'Aino', team: 'Design', score: 70, joined: '2024-03-01', tags: ['lead'] },
	{
		id: 'b',
		name: 'eero',
		team: 'Platform',
		score: 20,
		joined: '2023-01-15',
		tags: ['new', 'remote'],
	},
	{ id: 'c', name: 'Helmi 10', team: 'Design', score: null, joined: '2025-06-30' },
	{ id: 'd', name: 'Helmi 9', team: null, score: 45, joined: '2022-11-02', tags: ['remote'] },
	{ id: 'e', name: 'Onni', team: 'Platform', score: 90, joined: '2024-03-01' },
]

const columns: ColumnDef<Person>[] = [
	{ id: 'name' },
	{ id: 'team' },
	{ id: 'score', aggregate: 'sum' },
	{ id: 'joined' },
	{ id: 'tags' },
]

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id)
const nodesOf = (rows: readonly Person[] = people) =>
	createRowNodes(rows, { getChildren: (row) => row.reports }).rows

describe('row nodes', () => {
	test('each node holds the caller row itself and its id', () => {
		const { rows, byId } = createRowNodes(people)
		expect(ids(rows)).toEqual(['a', 'b', 'c', 'd', 'e'])
		expect(rows[1]?.row).toBe(people[1])
		expect(byId.get('d')?.row).toBe(people[3])
	})

	test('rows without an id get their position, and tree children get a path', () => {
		const { rows } = createRowNodes([{ label: 'x', kids: [{ label: 'y' }] }, { label: 'z' }], {
			getChildren: (row: { label: string; kids?: { label: string }[] }) => row.kids,
		})
		expect(ids(rows)).toEqual(['0', '1'])
		expect(rows[0]?.children?.[0]).toMatchObject({ id: '0.0', depth: 1, parentId: '0' })
	})

	test('a duplicate id fails with a message that names it', () => {
		expect(() => createRowNodes([{ id: 1 }, { id: 1 }])).toThrow('Two rows have the id "1"')
	})

	test('getRowId wins over the id property', () => {
		const { rows } = createRowNodes(people, { getRowId: (row) => `p-${row.name}` })
		expect(rows[0]?.id).toBe('p-Aino')
	})
})

describe('filter', () => {
	const run = (state: FilterState, list = nodesOf()) => {
		const predicate = createRowPredicate(state, { columns })
		return predicate ? filterRows(list, predicate) : list
	}

	test('no active filter gives no predicate', () => {
		expect(
			createRowPredicate({ search: '  ', columns: { team: [], score: {} } }, { columns }),
		).toBeNull()
		expect(isEmptyFilter({ min: null, max: undefined })).toBe(true)
	})

	test('search finds text in any column, ignoring case', () => {
		expect(ids(run({ search: 'EER' }))).toEqual(['b'])
		expect(ids(run({ search: 'platform' }))).toEqual(['b', 'e'])
	})

	test('a column marked not searchable is skipped', () => {
		const predicate = createRowPredicate(
			{ search: 'platform' },
			{
				columns: columns.map((column) =>
					column.id === 'team' ? { ...column, searchable: false } : column,
				),
			},
		)
		expect(predicate && ids(filterRows(nodesOf(), predicate))).toEqual([])
	})

	test('fuzzy search accepts a near match', () => {
		const predicate = createRowPredicate({ search: 'ano' }, { columns, searchMode: 'fuzzy' })
		expect(predicate && ids(filterRows(nodesOf(), predicate))).toContain('a')
	})

	test('the shape of a filter value picks the kind of match', () => {
		expect(ids(run({ columns: { name: 'helmi' } }))).toEqual(['c', 'd'])
		expect(ids(run({ columns: { team: ['Design'] } }))).toEqual(['a', 'c'])
		expect(ids(run({ columns: { tags: ['remote'] } }))).toEqual(['b', 'd'])
		expect(ids(run({ columns: { score: { min: 45, max: 70 } } }))).toEqual(['a', 'd'])
		expect(ids(run({ columns: { score: { min: 80 } } }))).toEqual(['e'])
	})

	test('a date range includes both days, and a backwards range means the same days', () => {
		const forwards = run({ columns: { joined: { from: '2024-03-01', to: '2025-06-30' } } })
		const backwards = run({ columns: { joined: { from: '2025-06-30', to: '2024-03-01' } } })
		expect(ids(forwards)).toEqual(['a', 'c', 'e'])
		expect(ids(backwards)).toEqual(['a', 'c', 'e'])
	})

	test('several filters must all pass', () => {
		expect(ids(run({ search: 'o', columns: { team: ['Platform'], score: { min: 50 } } }))).toEqual([
			'e',
		])
	})

	test('a custom matcher gets the value, the filter and the row', () => {
		const predicate = createRowPredicate<Person>(
			{ columns: { score: 'high' } },
			{
				columns: [
					{
						id: 'score',
						filter: (value, filter, row) =>
							filter === 'high' && Number(value) > 60 && row.id !== 'e',
					},
				],
			},
		)
		expect(predicate && ids(filterRows(nodesOf(), predicate))).toEqual(['a'])
	})

	test('an unknown column fails with the valid ids', () => {
		expect(() => createRowPredicate({ columns: { nope: 'x' } }, { columns })).toThrow(
			'No column "nope" to filter. Columns: name, team, score, joined, tags.',
		)
	})

	test('when nothing is removed, the same array comes back', () => {
		const list = nodesOf()
		expect(run({ columns: { joined: { from: '2000-01-01' } } }, list)).toBe(list)
	})

	test('in a tree, a passing row keeps its subtree and a failing row stays for a passing child', () => {
		const tree: Person[] = [
			{
				id: 'boss',
				name: 'Boss',
				team: 'Design',
				score: 1,
				joined: '2020-01-01',
				reports: [
					{ id: 'r1', name: 'Kerttu', team: 'Design', score: 2, joined: '2021-01-01' },
					{ id: 'r2', name: 'Lauri', team: 'Design', score: 3, joined: '2021-01-01' },
				],
			},
			{ id: 'solo', name: 'Solo', team: 'Growth', score: 4, joined: '2021-01-01' },
		]
		const list = nodesOf(tree)

		const child = run({ search: 'lauri' }, list)
		expect(ids(child)).toEqual(['boss'])
		expect(ids(child[0]?.children ?? [])).toEqual(['r2'])
		expect(child[0]?.row).toBe(tree[0])
		expect(ids(list[0]?.children ?? [])).toEqual(['r1', 'r2'])

		const parent = run({ search: 'boss' }, list)
		expect(parent[0]).toBe(list[0])
	})
})

describe('sort', () => {
	const run = (rules: SortRule[], list = nodesOf()) => ids(sortRows(list, rules, { columns }))

	test('no rule gives the input back', () => {
		const list = nodesOf()
		expect(sortRows(list, [], { columns })).toBe(list)
	})

	test('text sorts without case, with numbers inside text in numeric order', () => {
		expect(run([{ id: 'name' }])).toEqual(['a', 'b', 'd', 'c', 'e'])
	})

	test('empty values come last in both directions', () => {
		expect(run([{ id: 'score' }])).toEqual(['b', 'd', 'a', 'e', 'c'])
		expect(run([{ id: 'score', desc: true }])).toEqual(['e', 'a', 'd', 'b', 'c'])
	})

	test('later rules break ties, and equal rows keep their order', () => {
		expect(run([{ id: 'team' }, { id: 'score', desc: true }])).toEqual(['a', 'c', 'e', 'b', 'd'])
		expect(run([{ id: 'joined' }])).toEqual(['d', 'b', 'a', 'e', 'c'])
	})

	test('a column compare function wins', () => {
		const byLength: ColumnDef<Person>[] = [
			{ id: 'name', compare: (a, b) => String(a).length - String(b).length },
		]
		expect(ids(sortRows(nodesOf(), [{ id: 'name' }], { columns: byLength }))).toEqual([
			'a',
			'b',
			'e',
			'd',
			'c',
		])
	})

	test('children sort only on request, and the source nodes stay as they were', () => {
		const tree: Person[] = [
			{
				id: 'p',
				name: 'P',
				team: null,
				score: 1,
				joined: '2020-01-01',
				reports: [
					{ id: 'z', name: 'Zed', team: null, score: 1, joined: '2020-01-01' },
					{ id: 'y', name: 'Abe', team: null, score: 1, joined: '2020-01-01' },
				],
			},
		]
		const list = nodesOf(tree)
		const plain = sortRows(list, [{ id: 'name' }], { columns })
		expect(ids(plain[0]?.children ?? [])).toEqual(['z', 'y'])
		const deep = sortRows(list, [{ id: 'name' }], { columns, sortChildren: true })
		expect(ids(deep[0]?.children ?? [])).toEqual(['y', 'z'])
		expect(ids(list[0]?.children ?? [])).toEqual(['z', 'y'])
		expect(deep[0]?.row).toBe(tree[0])
	})

	test('an unknown column fails with the valid ids', () => {
		expect(() => run([{ id: 'nope' }])).toThrow('No column "nope" to sort by.')
	})
})

describe('group and aggregate', () => {
	test('groups keep input order and hold the same row nodes', () => {
		const list = nodesOf()
		const groups = groupRows(list, ['team'], { columns }) as GroupRow<Person>[]
		expect(groups.map((group) => [group.value, ids(group.leaves)])).toEqual([
			['Design', ['a', 'c']],
			['Platform', ['b', 'e']],
			[null, ['d']],
		])
		expect(groups[0]?.children[0]).toBe(list[0])
		expect(groups[0]?.id).toBe('group/team=Design')
	})

	test('several columns nest, and ids hold the whole path', () => {
		const groups = groupRows(nodesOf(), ['team', 'joined'], { columns }) as GroupRow<Person>[]
		const platform = groups[1]
		const inner = platform?.children as GroupRow<Person>[]
		expect(inner.map((group) => group.id)).toEqual([
			'group/team=Platform/joined=2023-01-15',
			'group/team=Platform/joined=2024-03-01',
		])
		expect(inner[0]).toMatchObject({ depth: 1, parentId: 'group/team=Platform' })
	})

	test('rows that cannot group stay at the top level', () => {
		const result = groupRows(nodesOf(), ['team'], { columns, canGroup: (row) => row.team !== null })
		expect(result.map((node) => node.kind)).toEqual(['row', 'group', 'group'])
	})

	test('aggregates cover each column that asks for one', () => {
		const all: ColumnDef<Person>[] = [
			{ id: 'sum', key: 'score', aggregate: 'sum' },
			{ id: 'mean', key: 'score', aggregate: 'mean' },
			{ id: 'min', key: 'score', aggregate: 'min' },
			{ id: 'max', key: 'score', aggregate: 'max' },
			{ id: 'count', key: 'score', aggregate: 'count' },
			{ id: 'unique', key: 'team', aggregate: 'uniqueCount' },
			{ id: 'first', key: 'team', aggregate: 'first' },
			{ id: 'custom', key: 'name', aggregate: (values, rows) => `${values.length}/${rows.length}` },
			{ id: 'none', key: 'name' },
		]
		expect(aggregateRows(nodesOf(), all)).toEqual({
			sum: 225,
			mean: 56.25,
			min: 20,
			max: 90,
			count: 4,
			unique: 2,
			first: 'Design',
			custom: '5/5',
		})
	})
})

describe('pages', () => {
	test('a page is a slice, and a page outside the range moves inside it', () => {
		const list = [1, 2, 3, 4, 5]
		expect(paginate(list, { page: 2, pageSize: 2 })).toEqual([3, 4])
		expect(paginate(list, { page: 9, pageSize: 2 })).toEqual([5])
		expect(paginate(list, { page: 0, pageSize: 2 })).toEqual([1, 2])
		expect(paginate(list, { page: 1, pageSize: 0 })).toBe(list)
		expect(pageCount(5, 2)).toBe(3)
		expect(pageCount(0, 2)).toBe(1)
		expect(clampPage({ page: 7, pageSize: 2 }, 5)).toBe(3)
	})
})

describe('flatten and facets', () => {
	test('only expanded groups show their rows', () => {
		const groups = groupRows(nodesOf(), ['team'], { columns })
		const flat = flattenRows(groups, (node) => node.id === 'group/team=Platform')
		expect(flat.map((row) => [row.id, row.level, row.expanded])).toEqual([
			['group/team=Design', 0, false],
			['group/team=Platform', 0, true],
			['b', 1, false],
			['e', 1, false],
			['group/team=', 0, false],
		])
		expect(flat[2]).toMatchObject({ parentId: 'group/team=Platform', expandable: false })
	})

	test('facets count values, list entries one by one, and find ranges', () => {
		const list = nodesOf()
		const column = (id: string) =>
			leafColumns(columns).find((item) => item.id === id) as ColumnDef<Person>
		expect(uniqueValues(list, column('team'))).toEqual([
			{ value: 'Design', count: 2 },
			{ value: 'Platform', count: 2 },
		])
		expect(uniqueValues(list, column('tags')).map((facet) => facet.value)).toEqual([
			'lead',
			'new',
			'remote',
		])
		expect(numberRange(list, column('score'))).toEqual({ min: 20, max: 90 })
		expect(numberRange(list, column('name'))).toBeNull()
		expect(dateRange(list, column('joined'))?.from.getFullYear()).toBe(2022)
	})
})

describe('row model', () => {
	function setup() {
		const state = {
			rows: people as readonly Person[],
			filter: undefined as FilterState | undefined,
			sort: [] as readonly SortRule[],
			groupBy: [] as readonly string[],
			page: { page: 1, pageSize: 2 },
			expanded: new Set<string>(),
		}
		const model = createRowModel<Person>({
			rows: () => state.rows,
			columns: () => columns,
			filter: () => state.filter,
			sort: () => state.sort,
			groupBy: () => state.groupBy,
			page: () => state.page,
			isExpanded: (node: TableRow<Person>) => state.expanded.has(node.id),
			expansion: () => state.expanded,
		})
		return { state, model }
	}

	test('stages run in order: sort, filter, group, page, flatten', () => {
		const { state, model } = setup()
		state.filter = { columns: { score: { min: 20 } } }
		state.sort = [{ id: 'score', desc: true }]
		expect(ids(model.sorted())).toEqual(['e', 'a', 'd', 'b', 'c'])
		expect(ids(model.filtered())).toEqual(['e', 'a', 'd', 'b'])
		expect(ids(model.paged())).toEqual(['e', 'a'])
		expect(model.rowCount()).toBe(4)
		expect(model.pageCount()).toBe(2)

		state.groupBy = ['team']
		state.page = { page: 1, pageSize: 10 }
		state.expanded = new Set(['group/team=Platform'])
		expect(ids(model.flat())).toEqual([
			'group/team=Platform',
			'e',
			'b',
			'group/team=Design',
			'group/team=',
		])
	})

	test('a page change does not filter, sort or group again', () => {
		const { state, model } = setup()
		state.sort = [{ id: 'name' }]
		const sorted = model.sorted()
		const firstPage = model.paged()
		state.page = { page: 2, pageSize: 2 }
		expect(model.sorted()).toBe(sorted)
		expect(model.paged()).not.toBe(firstPage)
		expect(ids(model.paged())).toEqual(['d', 'c'])
	})

	test('a new search text filters again but does not sort again', () => {
		const { state, model } = setup()
		state.sort = [{ id: 'name' }]
		state.filter = { search: 'e' }
		const sorted = model.sorted()
		const filtered = model.filtered()
		state.filter = { search: 'el' }
		expect(model.sorted()).toBe(sorted)
		expect(model.filtered()).not.toBe(filtered)
		expect(ids(model.filtered())).toEqual(['d', 'c'])
	})

	test('an expansion change flattens again but keeps the pages', () => {
		const { state, model } = setup()
		state.groupBy = ['team']
		const paged = model.paged()
		const flat = model.flat()
		expect(model.flat()).toBe(flat)
		state.expanded = new Set(['group/team=Design'])
		expect(model.flat()).not.toBe(flat)
		expect(model.paged()).toBe(paged)
	})

	test('totals of a group are kept until the groups are built again', () => {
		const { state, model } = setup()
		state.groupBy = ['team']
		const group = model.grouped()[0] as GroupRow<Person>
		const totals = model.aggregate(group)
		expect(totals).toEqual({ score: 70 })
		expect(model.aggregate(group)).toBe(totals)
		expect(model.aggregate()).toEqual({ score: 225 })
	})

	test('no stage copies or changes a caller row', () => {
		const frozen = people.map((person) => Object.freeze({ ...person }))
		const { state, model } = setup()
		state.rows = frozen
		state.filter = { search: 'e' }
		state.sort = [{ id: 'score', desc: true }]
		state.groupBy = ['team']
		state.page = { page: 1, pageSize: 50 }
		state.expanded = new Set(model.grouped().map((node) => node.id))

		const shown = model
			.flat()
			.map((row) => row.node)
			.filter((node): node is DataRow<Person> => node.kind === 'row')
		expect(shown.length).toBeGreaterThan(0)
		for (const node of shown) {
			expect(frozen).toContain(node.row)
			expect(model.rowById(node.id)?.row).toBe(node.row)
		}
	})

	test('a model without optional features passes the rows through', () => {
		const model = createRowModel<Person>({ rows: () => people, columns: () => columns })
		expect(model.paged()).toBe(model.source().rows)
		expect(ids(model.flat())).toEqual(['a', 'b', 'c', 'd', 'e'])
		expect(model.pageCount()).toBe(1)
	})
})
