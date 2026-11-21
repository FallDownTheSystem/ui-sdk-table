import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import type { CellEdit } from '../edit'
import { createTurnValues } from '../edit/turn'
import { cellValue, type ColumnDef } from '../rows'
import { table, type TableOptions } from '../table'

// P7 of the formula work, a measurement and not a check: it runs only with
// `BENCH=1 vp test run packages/core/src/proofs/formula-cost.perf --silent=false`.
// The engine of the formulas does not exist in the table yet, so a formula is
// a plain function here, and the dependents of an edit are found by a list
// that the test builds. What is real: the report of the table, its history,
// and the values of the turn (`createTurnValues`, which `valueNow` reads).
// The cost of the parse and the compile is measured in
// `formulas/formulas.perf.test.ts`.

const requested = !!(globalThis as { process?: { env?: Record<string, string | undefined> } })
	.process?.env?.BENCH

type Line = { id: string; price: number; qty: number; total: number; balance: number }

const ROWS = 50_000

const lines = (): Line[] =>
	Array.from({ length: ROWS }, (_, index) => ({
		id: `r${index}`,
		price: (index % 97) + 0.5,
		qty: index % 13,
		total: 0,
		balance: 0,
	}))

const columns: ColumnDef<Line>[] = [
	{ id: 'price' },
	{ id: 'qty' },
	{ id: 'total' },
	{ id: 'balance' },
]

async function median(run: (round: number) => void, rounds = 9): Promise<number> {
	const times: number[] = []
	for (let round = 0; round < rounds; round++) {
		await Promise.resolve()
		const start = performance.now()
		run(round)
		times.push(performance.now() - start)
	}
	times.sort((a, b) => a - b)
	return Math.round((times[Math.floor(times.length / 2)] ?? 0) * 100) / 100
}

function setup() {
	const rows = lines()
	const sizes: number[] = []
	const view = mount(
		table,
		{
			rows,
			columns,
			editable: true,
			cellSelection: true,
			history: true,
			onCellEdit: (edits: readonly CellEdit<Line>[]) => sizes.push(edits.length),
		} as TableOptions,
		'<root aria-label="Lines"></root>',
	)
	return { view, rows, sizes }
}

describe.runIf(requested)('formulas with 50,000 rows, before the engine', () => {
	test('median time of each operation', async () => {
		const results: Record<string, number> = {}
		const { view, rows, sizes } = setup()
		const byId = new Map(rows.map((row, index) => [row.id, index]))
		const [price, qty, , balance] = columns as [ColumnDef, ColumnDef, ColumnDef, ColumnDef]

		results['one edit of a value, today'] = await median((round) => {
			void view.api.editCell('r5', 'price', round + 0.25)
		})

		// The edit and its 10 dependents as one report: the cells of 11 rows of one column.
		view.api.selectCells({ rowId: 'r100', columnId: 'total' }, { rowId: 'r110', columnId: 'total' })
		results['one report of 11 cells (an edit and 10 dependents)'] = await median((round) => {
			void view.api.pasteCells(Array.from({ length: 11 }, (_, i) => round + i).join('\n'))
		})

		// A paste of 50,000 prices, and the 50,000 totals that read them, as one report.
		const block = (round: number) =>
			rows.map((_, index) => `${round * 100_000 + index + 0.5}\t${round + 20}`).join('\n')
		const texts = Array.from({ length: 9 }, (_, round) => block(round))
		view.api.selectCells(
			{ rowId: 'r0', columnId: 'price' },
			{ rowId: `r${ROWS - 1}`, columnId: 'qty' },
		)
		results['one report of 100,000 cells (a paste and its dependents)'] = await median((round) => {
			void view.api.pasteCells(texts[round] ?? '')
		})
		expect(sizes.at(-1)).toBe(ROWS * 2)

		// The dependents of 50,000 changed prices, read through the values of the turn.
		const pasted: CellEdit[] = rows.map((row, index) => ({
			rowId: row.id,
			columnId: 'price',
			row,
			column: price,
			value: index + 0.75,
			previous: row.price,
		}))
		const total = (read: (column: ColumnDef) => unknown) =>
			(read(price) as number) * (read(qty) as number)
		results['50,000 same-row formulas after 50,000 changed values, read through the turn'] =
			await median(() => {
				const turn = createTurnValues(() => rows)
				turn.add(pasted)
				const results: CellEdit[] = []
				for (const row of rows) {
					const read = (column: ColumnDef) => {
						const held = turn.read(row.id, column.id)
						return held ? held.value : cellValue(row, column)
					}
					results.push({
						rowId: row.id,
						columnId: 'total',
						row,
						column: price,
						value: total(read),
						previous: row.total,
					})
				}
				return results
			})

		// A chain: each balance reads the balance of the row before. One edit at the top
		// reaches every row. The order comes from a list, never from a recursion.
		results['a chain of 50,000 cells, one edit at the top'] = await median(() => {
			const turn = createTurnValues(() => rows)
			turn.add([
				{ rowId: 'r0', columnId: 'price', row: rows[0], column: price, value: 1, previous: 0.5 },
			])
			const readers = (index: number) => (index + 1 < ROWS ? [index + 1] : [])
			const reached = new Set<number>([0])
			const stack = [0]
			while (stack.length) {
				const at = stack.pop() ?? 0
				for (const next of readers(at)) {
					if (reached.has(next)) continue
					reached.add(next)
					stack.push(next)
				}
			}
			const waits = new Map<number, number>()
			for (const at of reached)
				for (const next of readers(at)) waits.set(next, (waits.get(next) ?? 0) + 1)
			const values = new Map<number, number>()
			const ready = [0]
			while (ready.length) {
				const at = ready.pop() ?? 0
				const row = rows[at] as Line
				const own = turn.read(row.id, 'price')
				const before = at === 0 ? 0 : (values.get(at - 1) ?? 0)
				values.set(at, before + ((own ? own.value : row.price) as number))
				for (const next of readers(at)) {
					const left = (waits.get(next) ?? 1) - 1
					waits.set(next, left)
					if (left === 0) ready.push(next)
				}
			}
			expect(values.size).toBe(ROWS)
			return byId
		}, 5)

		// The chain reported as one edit: 50,000 balances through the table.
		view.api.selectCells(
			{ rowId: 'r0', columnId: 'balance' },
			{ rowId: `r${ROWS - 1}`, columnId: 'balance' },
		)
		const chain = Array.from({ length: 9 }, (_, round) =>
			rows.map((_, index) => String(round * 100_000 + index + 1)).join('\n'),
		)
		results['one report of the 50,000 balances of the chain'] = await median((round) => {
			void view.api.pasteCells(chain[round] ?? '')
		})
		void balance

		view.unmount()
		console.log(JSON.stringify(results, null, '\t'))
	}, 120_000)
})
