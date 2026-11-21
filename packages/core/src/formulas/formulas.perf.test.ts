import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import { createRowModel, type ColumnDef, type SortRule } from '../rows'
import { table, type TableOptions } from '../table'
import { compileRowFormula, createFormulaEngine, formulaColumn, parseFormula } from './index'

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
		// The periods of 50,000 moments of one year in a zone.
		type Event = { id: string; created: Date }
		const year = Date.UTC(2026, 0, 1)
		const events = (): Event[] =>
			Array.from({ length: ROWS }, (_, index) => ({
				id: `e${index}`,
				created: new Date(
					year + Math.floor((index * 365 * 86_400_000) / ROWS) + (index % 977) * 1000,
				),
			}))
		const moments: ColumnDef<Event>[] = [
			{ id: 'created', format: 'datetime', formatOptions: { timeZone: 'Europe/Helsinki' } },
		]
		const rounds = Array.from({ length: 5 }, () => events())
		let round = 0
		results['WEEKOF over 50,000 moments in a zone, first read'] = median(() => {
			const week = formulaColumn({ id: 'week', formula: '=WEEKOF([created], 2)' }, moments)
			for (const event of rounds[round++] ?? []) week.value?.(event)
		}, 5)
		const fresh = events()
		const week = formulaColumn({ id: 'week', formula: '=WEEKOF([created], 2)' }, moments)
		for (const event of fresh) week.value?.(event)
		results['the same again, the values kept'] = median(() => {
			for (const event of fresh) week.value?.(event)
		})
		const byWeek = (rows: readonly Event[], column: ColumnDef<Event>) => {
			const sort: readonly SortRule[] = [{ id: 'week' }]
			const groupBy = ['week']
			return createRowModel<Event>({
				rows: () => rows,
				columns: () => [...moments, column],
				sort: () => sort,
				groupBy: () => groupBy,
			}).grouped()
		}
		results['sort and group by WEEKOF, a new column (computes every row)'] = median(() =>
			byWeek(fresh, formulaColumn({ id: 'week', formula: '=WEEKOF([created], 2)' }, moments)),
		)
		results['sort and group by WEEKOF, the values kept'] = median(() => byWeek(fresh, week))
		expect(byWeek(fresh, week).length).toBe(53)
		expect(Object.keys(results).length).toBe(11)
		console.log(JSON.stringify(results, null, '\t'))
	}, 120_000)
})

describe.runIf(requested)('formulas of columns in a table with 50,000 rows', () => {
	test('median time to set a formula of a column and read the rows again', () => {
		let reports = 0
		const view = mount(
			table,
			{
				rows: lines(),
				columns: base,
				formulas: createFormulaEngine(),
				onCellEdit: () => {
					reports++
				},
			} as TableOptions,
			'<root aria-label="Lines"></root>',
		)
		try {
			const formulas = ['=[price]*[qty]', '=[price]+[qty]']
			let turn = 0
			const next = () => formulas[turn++ % 2] ?? ''
			const results: Record<string, number> = {}
			results['set a formula of a column, then getView (no value is read)'] = median(() => {
				view.api.setColumnFormula('total', next())
				return view.api.getView().dataRowCount
			})
			view.api.sortBy('total', 'asc')
			results['set a formula of a column while the table sorts by it, then getView'] = median(
				() => {
					view.api.setColumnFormula('total', next())
					return view.api.getView().dataRowCount
				},
			)
			results['sort again by the column, values kept'] = median(() => {
				view.api.sortBy('total', turn++ % 2 ? 'asc' : 'desc')
				return view.api.getView().dataRowCount
			})
			expect(reports).toBe(0)
			console.table(results)
		} finally {
			view.unmount()
		}
	})
})

describe.runIf(requested)('addresses with 50,000 rows', () => {
	test('median time of the maps of the addresses and of a parse at a cell', () => {
		const engine = createFormulaEngine()
		const ids = lines().map((line) => line.id)
		const results: Record<string, number> = {}
		results['the maps for 50,000 new rows, then one number'] = median(() => {
			const rowIds = [...ids]
			return engine.rowNumber('r49999', {
				columns: () => base as readonly ColumnDef[],
				rowIds: () => rowIds,
				row: () => undefined,
				value: () => undefined,
				locale: () => undefined,
			})
		})
		const kept = {
			columns: () => base as readonly ColumnDef[],
			rowIds: () => ids,
			row: () => undefined,
			value: () => undefined,
			locale: () => undefined,
		}
		results['the number of each of 50,000 rows, maps kept'] = median(() => {
			for (const id of ids) engine.rowNumber(id, kept)
		})
		results['parse of "=A1+A50000*B2" at a cell, maps kept'] = median(() =>
			engine.parse('=A1+A50000*B2', { rowId: 'r1', columnId: 'total' }, kept),
		)
		expect(engine.rowNumber('r49999', kept)).toBe(50_000)
		console.table(results)
	})
})

describe.runIf(requested)('the engine of cell formulas with 50,000 rows', () => {
	test('median time of `follow`', () => {
		const engine = createFormulaEngine()
		const defs: ColumnDef[] = [
			{ id: 'price', header: 'Price' },
			{ id: 'qty', header: 'Quantity' },
			{ id: 'total', header: 'Total' },
			{ id: 'sum', header: 'Sum' },
		]
		const ids = Array.from({ length: ROWS }, (_, index) => `r${index}`)
		const values = new Map<string, number>()
		const sheet = {
			columns: () => defs,
			rowIds: () => ids,
			row: () => ({}),
			value: (rowId: string, columnId: string) => values.get(`${rowId}|${columnId}`) ?? 1,
			locale: () => undefined,
		}
		const results: Record<string, number> = {}

		const same: Record<string, Record<string, string>> = {}
		for (const id of ids) same[id] = { total: '=[price]*[qty]' }
		const sameFormulas = { cells: same }
		const changed = ids.map((rowId, index) => ({ rowId, columnId: 'price', value: index }))
		engine.follow(changed.slice(0, 1), sameFormulas, sheet)
		results['50,000 same-row formulas after 50,000 changed values'] = median(() => {
			const found = engine.follow(changed, sameFormulas, sheet)
			return 'results' in found ? found.results.length : 0
		}, 5)
		results['one changed value, 50,000 same-row formulas in the table'] = median(() =>
			engine.follow([{ rowId: 'r7', columnId: 'price', value: 3 }], sameFormulas, sheet),
		)

		const chain: Record<string, Record<string, string>> = {}
		ids.forEach((id, index) => {
			if (index) chain[id] = { total: `=[total@r${index - 1}]+1` }
		})
		const chainFormulas = { cells: chain }
		results['a chain of 50,000 cells, one edit at the top (index built)'] = median(() => {
			const found = engine.follow(
				[{ rowId: 'r0', columnId: 'total', value: 1 }],
				chainFormulas,
				sheet,
			)
			return 'results' in found ? found.results.length : 0
		}, 5)
		results['a chain of 50,000 cells, with a new index'] = median(() => {
			const found = engine.follow(
				[{ rowId: 'r0', columnId: 'total', value: 1 }],
				{ cells: { ...chain } },
				sheet,
			)
			return 'results' in found ? found.results.length : 0
		}, 5)

		const ranges: Record<string, Record<string, string>> = {}
		for (let index = 0; index < 1000; index++) {
			const from = index * 50
			ranges[`r${from}`] = { sum: `=SUM([price@r${from}]:[price@r${from + 49}])` }
		}
		const rangeFormulas = { cells: ranges }
		results['1,000 ranges of 50 rows and 50,000 changed cells'] = median(() => {
			const found = engine.follow(changed, rangeFormulas, sheet)
			return 'results' in found ? found.results.length : 0
		}, 5)

		const running: Record<string, Record<string, string>> = {}
		ids.slice(0, 5000).forEach((id) => (running[id] = { sum: `=SUM([price@r0]:[price@${id}])` }))
		results['a running sum over 5,000 rows (12.5 million reads), refused by `maxReads`'] = median(
			() =>
				engine.follow([{ rowId: 'r0', columnId: 'price', value: 2 }], { cells: running }, sheet),
			3,
		)
		const refused = engine.follow(
			[{ rowId: 'r0', columnId: 'price', value: 2 }],
			{ cells: running },
			sheet,
		)
		expect('issues' in refused).toBe(true)
		console.table(results)
	}, 120_000)
})
