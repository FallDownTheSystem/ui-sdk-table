import { describe, expect, test } from 'vite-plus/test'
import { createRowModel, type ColumnDef, type FilterState, type SortRule } from './index'

// A measurement, not a pass or fail check: it runs only on request, with
// `BENCH=1 vp test run packages/core/src/rows/rows.perf`, and prints one
// median time for each operation on 50,000 rows.
const requested = !!(globalThis as { process?: { env?: Record<string, string | undefined> } })
	.process?.env?.BENCH

type Person = {
	id: string
	name: string
	team: string
	country: string
	score: number
	joined: string
}

const TEAMS = ['Billing', 'Design', 'Growth', 'Platform', 'Support']
const COUNTRIES = ['Finland', 'Sweden', 'Norway', 'Denmark', 'Estonia']

function createPeople(count: number): Person[] {
	let seed = 42
	const random = () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296
		return seed / 4294967296
	}
	return Array.from({ length: count }, (_, index) => ({
		id: `p${index}`,
		name: `Person ${Math.floor(random() * 100000)}`,
		team: TEAMS[Math.floor(random() * TEAMS.length)] ?? 'Design',
		country: COUNTRIES[Math.floor(random() * COUNTRIES.length)] ?? 'Finland',
		score: Math.round(random() * 10000) / 100,
		joined: `20${10 + Math.floor(random() * 16)}-0${1 + Math.floor(random() * 9)}-1${Math.floor(random() * 9)}`,
	}))
}

const columns: ColumnDef<Person>[] = [
	{ id: 'name' },
	{ id: 'team' },
	{ id: 'country' },
	{ id: 'score', aggregate: 'sum' },
	{ id: 'joined' },
]

function median(run: (round: number) => void, rounds = 9): number {
	const times: number[] = []
	for (let round = 0; round < rounds; round++) {
		const start = performance.now()
		run(round)
		times.push(performance.now() - start)
	}
	times.sort((a, b) => a - b)
	return Math.round((times[Math.floor(times.length / 2)] ?? 0) * 100) / 100
}

describe.runIf(requested)('row pipeline with 50,000 rows', () => {
	test('median time of each operation', () => {
		const people = createPeople(50_000)
		const setup = () => {
			const state = {
				filter: undefined as FilterState | undefined,
				sort: [] as readonly SortRule[],
				groupBy: [] as readonly string[],
				page: { page: 1, pageSize: 50 },
			}
			const model = createRowModel<Person>({
				rows: () => people,
				columns: () => columns,
				filter: () => state.filter,
				sort: () => state.sort,
				groupBy: () => state.groupBy,
				page: () => state.page,
			})
			model.flat()
			return { state, model }
		}

		const results: Record<string, number> = {}

		results['build row nodes'] = median(() => {
			createRowModel<Person>({ rows: () => people, columns: () => columns }).source()
		})

		const search = setup()
		results['search, one keystroke'] = median((round) => {
			search.state.filter = { search: `person ${round}` }
			search.model.flat()
		})

		const sortedSearch = setup()
		sortedSearch.state.sort = [{ id: 'name' }]
		sortedSearch.model.flat()
		results['search on sorted rows, one keystroke'] = median((round) => {
			sortedSearch.state.filter = { search: `person ${round}` }
			sortedSearch.model.flat()
		})

		const range = setup()
		results['number range filter'] = median((round) => {
			range.state.filter = { columns: { score: { min: round, max: 90 } } }
			range.model.flat()
		})

		const text = setup()
		results['sort by text'] = median((round) => {
			text.state.sort = [{ id: 'name', desc: round % 2 === 0 }]
			text.model.flat()
		})

		const number = setup()
		results['sort by number'] = median((round) => {
			number.state.sort = [{ id: 'score', desc: round % 2 === 0 }]
			number.model.flat()
		})

		const groups = setup()
		results['group by two columns, with totals'] = median((round) => {
			groups.state.groupBy = round % 2 === 0 ? ['team', 'country'] : ['country', 'team']
			for (const node of groups.model.grouped()) {
				if (node.kind === 'group') groups.model.aggregate(node)
			}
		})

		const pages = setup()
		pages.state.sort = [{ id: 'name' }]
		pages.model.flat()
		results['page change on sorted rows'] = median((round) => {
			pages.state.page = { page: round + 2, pageSize: 50 }
			pages.model.flat()
		})

		// A pinned row leaves the list. No page here: all 50,000 rows are flattened again.
		let omit = new Set<string>()
		const pinned = createRowModel<Person>({
			rows: () => people,
			columns: () => columns,
			omit: () => omit,
		})
		pinned.flat()
		results['pin one row, all rows listed'] = median((round) => {
			omit = new Set([`p${round * 1000}`])
			pinned.flat()
		})

		// A detail row opens: the visible rows are listed again.
		let open = new Set<string>()
		const everyRow = () => true
		const details = createRowModel<Person>({
			rows: () => people,
			columns: () => columns,
			isExpanded: (node) => open.has(node.id),
			expansion: () => open,
			hasDetail: () => everyRow,
		})
		details.flat()
		results['open a detail row, all rows listed'] = median((round) => {
			open = new Set([`p${round * 1000}`])
			details.flat()
		})

		console.table(results)
		expect(Object.keys(results)).toHaveLength(10)
	})
})
