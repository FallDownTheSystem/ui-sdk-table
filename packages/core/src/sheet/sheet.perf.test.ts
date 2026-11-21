import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import { applyEdits, type CellEdit } from '../edit'
import type { ColumnDef } from '../rows'
import { table, type TableOptions } from '../table'
import { setFormats, type CellFormats } from './formats'

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

	test('median time of a fill, a summary, a format and a change of a total', async () => {
		const results: Record<string, number> = {}

		// The owner of this table never changes its rows, so every fill starts from the same values.
		const fill = setup({ sheet: true })
		const selectColumn = () =>
			fill.view.api.selectCells(
				{ rowId: 'p0', columnId: 'score' },
				{ rowId: `p${ROWS - 1}`, columnId: 'score' },
			)
		selectColumn()
		results['fill down of 49,999 cells from one line, with its step'] = await median(
			() => void fill.view.api.fillCells('down'),
			() => selectColumn(),
		)
		// A cell that holds the value already is no edit, so a few cells report nothing.
		expect(fill.reports.at(-1)).toBeGreaterThan(ROWS - 100)
		results['fill down of 49,998 cells as a series from two lines'] = await median(
			() => void fill.view.api.fillCells('down', 2),
			() => selectColumn(),
		)
		expect(fill.reports.at(-1)).toBeGreaterThan(ROWS - 100)
		fill.view.unmount()

		const sum = setup({})
		results['summary of 250,000 selected cells, first ask'] = await median(
			() => void sum.view.api.getSelectionSummary(),
			(round) => {
				// Another range each round, so nothing of the last answer is kept.
				sum.view.api.selectCells(
					{ rowId: 'p0', columnId: 'name' },
					{ rowId: `p${ROWS - 1 - round}`, columnId: 'joined' },
				)
			},
		)
		results['summary of the same selection, again'] = await median(
			() => void sum.view.api.getSelectionSummary(),
		)
		expect(sum.view.api.getSelectionSummary()?.cells).toBe((ROWS - 8) * 5)
		sum.view.unmount()

		// The formats: the pure function first, then the table with its history.
		const ids = Array.from({ length: ROWS }, (_, index) => `p${index}`)
		let made: CellFormats = {}
		results['setFormats, one format for 50,000 cells of one column'] = await median(() => {
			made = setFormats({}, { rows: ids, columns: ['score'] }, { bold: true })
		})
		const rowRecords = new Set(Object.values(made.cells ?? {}))
		const formatObjects = new Set([...rowRecords].flatMap((row) => Object.values(row)))
		results['  keys of that value'] = Object.keys(made.cells ?? {}).length
		results['  objects of that value beside its one record (rows, formats)'] =
			rowRecords.size + formatObjects.size
		results['setFormats, a second property on the same 50,000 cells'] = await median(
			() => void setFormats(made, { rows: ids, columns: ['score'] }, { fill: 'red' }),
		)
		results['setFormats, a whole column over 50,000 cell formats'] = await median(
			() => void setFormats(made, { columns: ['score'] }, { bold: true }),
		)

		const formats = setup({ sheet: true, formatColors: ['red'] })
		const block = {
			from: { rowId: 'p0', columnId: 'name' },
			to: { rowId: `p${BLOCK - 1}`, columnId: 'joined' },
		}
		results['formatCells, 50,000 cells (10,000 rows by 5 columns), with its step'] = await median(
			() => formats.view.api.formatCells({ bold: true }, block),
			() => formats.view.api.clearCellFormats(block),
		)
		const held = formats.view.api.getView().cellFormats
		const heldRows = new Set(Object.values(held.cells ?? {}))
		results['  objects of the state for those cells (rows, formats)'] =
			heldRows.size + new Set([...heldRows].flatMap((row) => Object.values(row))).size
		results['undo of that format step'] = await median(
			() => formats.view.api.undo(),
			(round) => {
				if (round > 0) formats.view.api.redo()
			},
		)
		formats.view.api.redo()
		results['formatCells, a whole column of 50,000 rows'] = await median((round) =>
			formats.view.api.formatCells({ decimals: round % 2 ? 1 : 3 }, { columns: ['score'] }),
		)
		formats.view.unmount()

		const totals = setup({})
		void totals.view.api.getTotals()
		results['change of the function of a total, then the totals'] = await median((round) => {
			totals.view.api.setColumnAggregate('score', round % 2 ? 'sum' : 'mean')
			void totals.view.api.getTotals()
		})
		totals.view.unmount()
		const grouped = setup({ groupBy: ['team', 'country'], groupTotals: true })
		void grouped.view.api.getTotals()
		results['the same with 25 groups, then the totals of each group'] = await median((round) => {
			grouped.view.api.setColumnAggregate('score', round % 2 ? 'sum' : 'mean')
			void grouped.view.api.getTotals()
			for (const team of TEAMS) {
				for (const country of COUNTRIES) {
					void grouped.view.api.getTotals(`group/team=${team}/country=${country}`)
				}
			}
		})
		grouped.view.unmount()

		console.table(results)
	}, 120_000)

	// The cost of a text, which every cell, a copy and an export pay. The first
	// line uses nothing that the table did not have before cells had formats,
	// so it also runs on the code before them.
	test('median time of every text of the table', async () => {
		const results: Record<string, number> = {}
		const formatted: ColumnDef<Person>[] = columns.map((column) =>
			column.id === 'score' ? { ...column, format: 'decimal' } : column,
		)
		const plain = setup({ columns: formatted })
		results['export of 250,000 texts, no cell format'] = await median(
			() => void plain.view.api.exportData(),
		)
		expect(plain.view.api.exportData().rows).toHaveLength(ROWS)
		if ('formatCells' in plain.view.api) {
			plain.view.api.formatCells({ decimals: 1 }, { columns: ['score'] })
			results['export of 250,000 texts, one column with a format'] = await median(
				() => void plain.view.api.exportData(),
			)
			plain.view.api.clearCellFormats({ columns: ['score'] })
			plain.view.api.formatCells(
				{ decimals: 1 },
				{
					from: { rowId: 'p0', columnId: 'score' },
					to: { rowId: `p${ROWS - 2}`, columnId: 'score' },
				},
			)
			results['export of 250,000 texts, 49,999 cells with a format of their own'] = await median(
				() => void plain.view.api.exportData(),
			)
		}
		plain.view.unmount()
		console.table(results)
	}, 120_000)
})
