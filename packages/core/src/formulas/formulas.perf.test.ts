import { describe, expect, test } from 'vite-plus/test'
import { createRowModel, type ColumnDef, type SortRule } from '../rows'
import { compileRowFormula, formulaColumn, parseFormula } from './index'

// A measurement, not a pass or fail check: it runs only on request, with
// `BENCH=1 vp test run packages/core/src/formulas/formulas.perf --silent=false`,
// and prints one median time for each operation on 50,000 rows.
const requested = !!(globalThis as { process?: { env?: Record<string, string | undefined> } })
	.process?.env?.BENCH

type Line = { id: string; price: number; qty: number; total: number }

const ROWS = 50_000

const lines = (): Line[] =>
	Array.from({ length: ROWS }, (_, index) => ({
		id: `r${index}`,
		price: ((index * 7919) % 9973) / 10 + 0.5,
		qty: index % 13,
		total: 0,
	}))

const base: ColumnDef<Line>[] = [
	{ id: 'price', header: 'Price' },
	{ id: 'qty', header: 'Quantity' },
	{ id: 'total', header: 'Total' },
]

function median(run: () => unknown, rounds = 9): number {
	const times: number[] = []
	for (let round = 0; round < rounds; round++) {
		const start = performance.now()
		run()
		times.push(performance.now() - start)
	}
	times.sort((a, b) => a - b)
	return Math.round((times[Math.floor(times.length / 2)] ?? 0) * 100) / 100
}

describe.runIf(requested)('formulas with 50,000 rows', () => {
	test('median time of each operation', () => {
		const results: Record<string, number> = {}
		const rows = lines()

		const plain = compileRowFormula('=[price]*[qty]', base)
		results['one shared formula over 50,000 rows ([price]*[qty])'] = median(() => {
			let sum = 0
			for (const row of rows) sum += plain(row) as number
			return sum
		})
		const cases = compileRowFormula(
			'=IF([qty]>10, ROUND([price]*[qty]*0.9, 2), [price]*[qty])',
			base,
		)
		results['one shared formula with IF and ROUND over 50,000 rows'] = median(() => {
			for (const row of rows) cases(row)
		})
		const bands = compileRowFormula(
			'=IFS([price]<200, "small", [price]<600, "medium", TRUE, "large")',
			base,
		)
		results['IFS with 3 cases to a text over 50,000 rows'] = median(() => {
			for (const row of rows) bands(row)
		})
		results['parse of 50,000 different formulas'] = median(() => {
			for (let index = 0; index < ROWS; index++) {
				parseFormula(`=[price]*${index}+[qty]`, { columns: base })
			}
		}, 5)

		// The first sort by a computed column against the sort by a plain column.
		const sortBy = (columns: readonly ColumnDef<Line>[], id: string) => {
			const sort: readonly SortRule[] = [{ id }]
			return createRowModel<Line>({ rows: () => rows, columns: () => columns, sort: () => sort })
		}
		results['first sort by a plain column (price)'] = median(() => sortBy(base, 'price').sorted())
		results['first sort by a computed column (=[price]*[qty]), a new column each round'] = median(
			() => {
				const total = formulaColumn({ id: 'sum', formula: '=[price]*[qty]' }, base)
				return sortBy([...base, total], 'sum').sorted()
			},
		)
		const kept = formulaColumn({ id: 'sum', formula: '=[price]*[qty]' }, base)
		sortBy([...base, kept], 'sum').sorted()
		results['sort again by the computed column, its values kept'] = median(() =>
			sortBy([...base, kept], 'sum').sorted(),
		)
		expect(Object.keys(results).length).toBe(7)
		console.log(JSON.stringify(results, null, '\t'))
	}, 120_000)
})
