import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import { applyEdits, type CellEdit } from '../edit'
import type { ColumnDef } from '../rows'
import { table, type TableOptions } from '../table'

// A measurement, not a pass or fail check: it runs only on request, with
// `BENCH=1 vp test run packages/core/src/sheet/sheet.perf --silent=false`,
// and prints one median time for each operation of a sheet on 50,000 rows.
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
const ROWS = 50_000
// A block of 50,000 cells: 10,000 rows of the 5 columns.
const BLOCK = 10_000

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

/** The text of a block where every cell differs from the rows and from the block of another round. */
function blockText(round: number): string {
	const lines: string[] = []
	for (let index = 0; index < BLOCK; index++) {
		lines.push(
			`N${round} ${index}\tT${round}\tC${round}\t${round * 1000 + (index % 997) + 0.5}\t2031-0${(round % 9) + 1}-11`,
		)
	}
	return lines.join('\n')
}

/** The median time of `run`, with a turn between the rounds, as a person or an owner leaves one. */
async function median(
	run: (round: number) => void,
	before?: (round: number) => void | Promise<void>,
	rounds = 9,
): Promise<number> {
	const times: number[] = []
	for (let round = 0; round < rounds; round++) {
		await before?.(round)
		await Promise.resolve()
		const start = performance.now()
		run(round)
		times.push(performance.now() - start)
	}
	times.sort((a, b) => a - b)
	return Math.round((times[Math.floor(times.length / 2)] ?? 0) * 100) / 100
}

function setup(options: Partial<TableOptions<Person>>) {
	const people = createPeople(ROWS)
	const reports: number[] = []
	// The rows of this owner never change, so every round starts from the same values.
	const view = mount(
		table,
		{
			rows: people,
			columns,
			editable: true,
			cellSelection: true,
			onCellEdit: (edits: readonly CellEdit<Person>[]) => reports.push(edits.length),
			...options,
		} as TableOptions,
		'<root aria-label="People"></root>',
	)
	const selectBlock = () =>
		view.api.selectCells(
			{ rowId: 'p0', columnId: 'name' },
			{ rowId: `p${BLOCK - 1}`, columnId: 'joined' },
		)
	return { view, people, reports, selectBlock }
}

describe.runIf(requested)('sheet with 50,000 rows', () => {
	test('median time of each operation', async () => {
		const texts = Array.from({ length: 9 }, (_, round) => blockText(round))
		const results: Record<string, number> = {}

		const plain = setup({})
		plain.selectBlock()
		results['paste of 50,000 cells, history off'] = await median(
			(round) => void plain.view.api.pasteCells(texts[round] ?? ''),
			() => plain.selectBlock(),
		)
		expect(plain.reports.every((cells) => cells === BLOCK * 5)).toBe(true)
		// A second report in the same turn reads the values of the first, which this turn holds.
		results['two pastes of 50,000 cells in one turn'] = await median(
			(round) => {
				void plain.view.api.pasteCells(texts[round] ?? '')
				void plain.view.api.pasteCells(texts[(round + 1) % 9] ?? '')
			},
			() => plain.selectBlock(),
		)
		plain.view.unmount()

		const kept = setup({ history: true })
		results['paste of 50,000 cells, history on (records a step)'] = await median(
			(round) => void kept.view.api.pasteCells(texts[round] ?? ''),
			() => kept.selectBlock(),
		)
		expect(kept.view.api.getHistory().entries.at(-1)?.cells).toBe(BLOCK * 5)
		kept.view.unmount()

		// An owner that puts the values into a store beside its rows, so an undo has values to put back.
		const store = new Map<string, unknown>()
		const stored: ColumnDef<Person>[] = columns.map((column) => ({
			...column,
			value: (row) =>
				store.has(`${row.id}|${column.id}`)
					? store.get(`${row.id}|${column.id}`)
					: (row as unknown as Record<string, unknown>)[column.id],
		}))
		const owned = setup({
			history: true,
			columns: stored,
			onCellEdit: (edits: readonly CellEdit<Person>[]) => {
				for (const edit of edits) store.set(`${edit.rowId}|${edit.columnId}`, edit.value)
			},
		})
		owned.selectBlock()
		void owned.view.api.pasteCells(texts[0] ?? '')
		await Promise.resolve()
		results['undo of a step of 50,000 cells'] = await median(
			() => owned.view.api.undo(),
			(round) => {
				if (round > 0) owned.view.api.redo()
			},
		)
		results['redo of a step of 50,000 cells'] = await median(
			() => owned.view.api.redo(),
			(round) => {
				if (round > 0) owned.view.api.undo()
			},
		)
		owned.view.unmount()

		const sheet = setup({ sheet: true })
		sheet.selectBlock()
		results['clear of 50,000 cells (Delete), with its step'] = await median(
			() => void sheet.view.api.clearCells(),
			() => sheet.selectBlock(),
		)
		results['paste of 2 by 5 cells that repeats over 50,000 cells'] = await median(
			(round) =>
				void sheet.view.api.pasteCells((texts[round] ?? '').split('\n').slice(0, 2).join('\n')),
			() => sheet.selectBlock(),
		)
		results['getView with a selection of 50,000 cells, first call'] = await median(
			() => void sheet.view.api.getView(),
			(round) => {
				// Another range each round, so the count of its rows is made again.
				sheet.view.api.selectCells(
					{ rowId: 'p0', columnId: 'name' },
					{ rowId: `p${BLOCK - 1 - round}`, columnId: 'joined' },
				)
			},
		)
		results['getView with the same selection, again'] = await median(
			() => void sheet.view.api.getView(),
		)
		sheet.view.unmount()

		// What the owner pays: `applyEdits` for 50,000 edits on 50,000 rows.
		const people = createPeople(ROWS)
		const edits: CellEdit<Person>[] = []
		for (let index = 0; index < BLOCK; index++) {
			const row = people[index]
			if (!row) continue
			for (const column of columns) {
				edits.push({
					rowId: row.id,
					columnId: column.id,
					row,
					column,
					value: column.id === 'score' ? index : `v${index}`,
					previous: undefined,
				})
			}
		}
		results['applyEdits, 50,000 edits on 50,000 rows'] = await median(
			() => void applyEdits(people, edits),
		)
		// The rows of a second report in one turn: the objects of the edits are gone, and the ids find the rows.
		const replaced = people.map((row) => ({ ...row }))
		results['applyEdits, the same edits on rows that were replaced'] = await median(
			() => void applyEdits(replaced, edits),
		)

		console.table(results)
	}, 120_000)
})
