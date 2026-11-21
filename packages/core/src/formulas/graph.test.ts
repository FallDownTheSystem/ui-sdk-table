import { describe, expect, test } from 'vite-plus/test'
import type { CellFormulas, FormulaChange, FormulaSheet } from '../formula/types'
import type { ColumnDef } from '../rows/types'
import { createFormulaEngine, describeFormulaIssue } from './index'

// The formulas of cells over a sheet that is a plain object: what follows
// from a change, in which order, circles, `#REF!` and the limit of reads.
// The expected values are counted by hand.

const columns: ColumnDef[] = [
	{ id: 'a', header: 'A' },
	{ id: 'b', header: 'B' },
	{ id: 'c', header: 'C' },
	{ id: 'd', header: 'D' },
	// A computed column: its value is `[a]*2`, from the `columns` layer.
	{ id: 'double', header: 'Double' },
]

type Grid = Record<string, Record<string, unknown>>

function sheetOf(grid: Grid, rowIds = Object.keys(grid)): FormulaSheet & { reads: number } {
	const sheet = {
		reads: 0,
		columns: () => columns,
		rowIds: () => rowIds,
		row: (rowId: string) => grid[rowId],
		value(rowId: string, columnId: string) {
			sheet.reads++
			const row = grid[rowId]
			if (columnId === 'double') return typeof row?.a === 'number' ? row.a * 2 : 0
			return row?.[columnId]
		},
		locale: () => undefined,
	}
	return sheet
}

const engine = createFormulaEngine()

/** Puts the results into the grid, as an owner takes a report. */
function follow(
	grid: Grid,
	formulas: CellFormulas,
	changes: FormulaChange[],
	sheet = sheetOf(grid),
	use = engine,
) {
	for (const change of changes) {
		if ('value' in change) {
			const row = (grid[change.rowId] ??= {})
			row[change.columnId] = change.value
		}
	}
	const found = use.follow(changes, formulas, sheet)
	if ('issues' in found) return found
	for (const result of found.results) {
		const row = (grid[result.rowId] ??= {})
		row[result.columnId] = result.value
	}
	return found
}

const ids = (found: ReturnType<typeof follow>) =>
	'results' in found ? found.results.map((result) => `${result.rowId}.${result.columnId}`) : found

describe('the cells that follow from a change', () => {
	test('a formula of its own row, of another row, of a range and of a whole column', () => {
		const grid: Grid = {
			r1: { a: 1, b: 10 },
			r2: { a: 2, b: 20 },
			r3: { a: 3, b: 30 },
		}
		const formulas: CellFormulas = {
			cells: {
				r1: { c: '=[a]+[b]', d: '=SUM([a@r1]:[a@r3])' },
				r2: { c: '=[b@r1]*2', d: '=SUM([b@*])' },
				r3: { c: '=COUNT([a@r1]:[b@r2])' },
			},
		}
		const sheet = sheetOf(grid)
		// The first report of every formula: each formula cell is changed to its formula.
		const all = Object.entries(formulas.cells ?? {}).flatMap(([rowId, row]) =>
			Object.entries(row).map(([columnId, formula]) => ({ rowId, columnId, formula })),
		)
		follow(grid, formulas, all, sheet)
		expect(grid.r1).toMatchObject({ c: 11, d: 6 })
		expect(grid.r2).toMatchObject({ c: 20, d: 60 })
		expect(grid.r3).toMatchObject({ c: 4 })

		// A change of b in row 1 reaches its own row, the cell by id and the whole column.
		const found = follow(grid, formulas, [{ rowId: 'r1', columnId: 'b', value: 15 }], sheet)
		expect(ids(found)).toEqual(['r1.c', 'r2.c', 'r2.d'])
		expect('results' in found && found.results[1]).toEqual({
			rowId: 'r2',
			columnId: 'c',
			value: 30,
			previous: 20,
		})
		// A change of a in row 3 reaches the range of a and nothing of b.
		expect(ids(follow(grid, formulas, [{ rowId: 'r3', columnId: 'a', value: 4 }], sheet))).toEqual([
			'r1.d',
		])
		expect(grid.r1?.d).toBe(7)
		// A value that does not change the result is no result.
		expect(
			ids(follow(grid, formulas, [{ rowId: 'r2', columnId: 'a', value: 'x' }], sheet)),
		).toEqual(['r1.d', 'r3.c'])
		expect(grid.r3?.c).toBe(3)
	})

	test('a chain and a diamond: each cell after the cells it reads, and once', () => {
		const grid: Grid = { r1: { a: 1 }, r2: {}, r3: {}, r4: {} }
		const formulas: CellFormulas = {
			cells: {
				r2: { a: '=[a@r1]+1' },
				r3: { a: '=[a@r1]*10' },
				// Reads both paths from r1.
				r4: { a: '=[a@r2]+[a@r3]' },
			},
		}
		const sheet = sheetOf(grid)
		const found = follow(grid, formulas, [{ rowId: 'r1', columnId: 'a', value: 2 }], sheet)
		expect(ids(found)).toEqual(['r2.a', 'r3.a', 'r4.a'])
		expect(grid.r4?.a).toBe(23)
	})

	test('a chain of 5,000 cells needs no recursion', () => {
		const grid: Grid = {}
		const cells: Record<string, Record<string, string>> = {}
		for (let index = 1; index <= 5000; index++) {
			grid[`r${index}`] = { a: 0 }
			if (index > 1) cells[`r${index}`] = { a: `=[a@r${index - 1}]+1` }
		}
		const found = follow(grid, { cells }, [{ rowId: 'r1', columnId: 'a', value: 1 }])
		expect('results' in found && found.results.length).toBe(4999)
		expect(grid.r5000?.a).toBe(5000)
	})

	test('a formula of a cell reads a computed column, and follows a change of what that column reads', () => {
		const grid: Grid = { r1: { a: 3 } }
		const formulas: CellFormulas = {
			columns: { double: '=[a]*2' },
			cells: { r1: { b: '=[double]+1' } },
		}
		follow(grid, formulas, [{ rowId: 'r1', columnId: 'b', formula: '=[double]+1' }])
		expect(grid.r1?.b).toBe(7)
		// The value of now of the computed cell is not read again: the change gives it.
		const found = follow(grid, formulas, [{ rowId: 'r1', columnId: 'a', value: 5 }])
		expect(ids(found)).toEqual(['r1.b'])
		expect(grid.r1?.b).toBe(11)
	})

	test('a range whose ends changed places reads the same rows', () => {
		const grid: Grid = { r1: { a: 1 }, r2: { a: 2 }, r3: { a: 4 }, r4: {} }
		const formulas = { cells: { r4: { a: '=SUM([a@r3]:[a@r1])' } } }
		follow(grid, formulas, [{ rowId: 'r4', columnId: 'a', formula: '=SUM([a@r3]:[a@r1])' }])
		expect(grid.r4?.a).toBe(7)
		// The owner moved r3 before r1: the range now holds the rows between them in the new order.
		const sheet = sheetOf(grid, ['r3', 'r1', 'r2', 'r4'])
		expect(engine.evaluate('=SUM([a@r3]:[a@r1])', { rowId: 'r4', columnId: 'a' }, sheet)).toBe(5)
	})
})

describe('a circle', () => {
	const words = (found: ReturnType<typeof follow>) =>
		'issues' in found ? found.issues.map((issue) => describeFormulaIssue(issue)) : found

	test('of one, two and five cells is refused at entry, with the path in addresses', () => {
		const grid: Grid = { r1: {}, r2: {}, r3: {}, r4: {}, r5: {} }
		expect(
			words(
				follow(grid, { cells: { r1: { a: '=[a]+1' } } }, [
					{ rowId: 'r1', columnId: 'a', formula: '=[a]+1' },
				]),
			),
		).toEqual(['The formula would read its own cell: A1 reads A1.'])
		expect(
			words(
				follow(grid, { cells: { r1: { a: '=[b]', b: '=[a]' } } }, [
					{ rowId: 'r1', columnId: 'b', formula: '=[a]' },
				]),
			),
		).toEqual(['The formula would read its own cell: B1 reads A1 reads B1.'])
		const five = {
			r1: { a: '=[a@r2]' },
			r2: { a: '=[a@r3]' },
			r3: { a: '=[a@r4]' },
			r4: { a: '=[a@r5]' },
			r5: { a: '=[a@r1]' },
		}
		expect(
			words(follow(grid, { cells: five }, [{ rowId: 'r5', columnId: 'a', formula: '=[a@r1]' }])),
		).toEqual([
			'The formula would read its own cell: A5 reads A1 reads A2 reads A3 reads A4 reads A5.',
		])
	})

	test('that the formulas held before shows #CYCLE!, and the cells outside it are computed', () => {
		const grid: Grid = { r1: { b: 1 }, r2: {} }
		const formulas = { cells: { r1: { a: '=[c]+[b]', c: '=[a]' }, r2: { a: '=[b@r1]*3' } } }
		const found = follow(grid, formulas, [{ rowId: 'r1', columnId: 'b', value: 2 }])
		expect(grid.r1).toMatchObject({ a: '#CYCLE!', c: '#CYCLE!' })
		expect(grid.r2?.a).toBe(6)
		expect(ids(found)).toEqual(['r2.a', 'r1.a', 'r1.c'])
	})
})

describe('a cell that is gone', () => {
	test('a row that the owner removed gives #REF!, and so does a column', () => {
		const grid: Grid = { r1: { a: 5 }, r2: {} }
		const formulas = { cells: { r2: { a: '=[a@r1]+1', b: '=[gone]+1' } } }
		follow(grid, formulas, [
			{ rowId: 'r2', columnId: 'a', formula: '=[a@r1]+1' },
			{ rowId: 'r2', columnId: 'b', formula: '=[gone]+1' },
		])
		expect(grid.r2).toMatchObject({ a: 6, b: '#REF!' })
		delete grid.r1
		const sheet = sheetOf(grid, ['r2'])
		expect(engine.evaluate('=[a@r1]+1', { rowId: 'r2', columnId: 'a' }, sheet)).toBe('#REF!')
		expect(engine.evaluate('=SUM([a@r1]:[a@r2])', { rowId: 'r2', columnId: 'a' }, sheet)).toBe(
			'#REF!',
		)
		expect(engine.print('=[a@r1]+1', { rowId: 'r2', columnId: 'a' }, sheet)).toBe('=#REF!+1')
	})
})

describe('the reads of a formula', () => {
	test('are its own cells, the cells by id and every cell of its ranges', () => {
		const grid: Grid = { r1: {}, r2: {}, r3: {} }
		expect(
			engine.reads('=[a]+[b@r3]+SUM([c@r1]:[d@r2])', { rowId: 'r2', columnId: 'a' }, sheetOf(grid)),
		).toEqual([
			{ rowId: 'r2', columnId: 'a' },
			{ rowId: 'r3', columnId: 'b' },
			{ rowId: 'r1', columnId: 'c' },
			{ rowId: 'r1', columnId: 'd' },
			{ rowId: 'r2', columnId: 'c' },
			{ rowId: 'r2', columnId: 'd' },
		])
	})

	test('past the limit refuse the change with the count', () => {
		const grid: Grid = {}
		const cells: Record<string, Record<string, string>> = {}
		for (let index = 1; index <= 100; index++) {
			grid[`r${index}`] = { a: index }
			cells[`r${index}`] = { b: `=SUM([a@r1]:[a@r${index}])` }
		}
		const small = createFormulaEngine({ maxReads: 1000 })
		const found = follow(
			grid,
			{ cells },
			[{ rowId: 'r1', columnId: 'a', value: 2 }],
			sheetOf(grid),
			small,
		)
		expect('issues' in found && describeFormulaIssue(found.issues[0] ?? { code: 'empty' })).toMatch(
			/^The change would read 10\d\d cells, more than 1000\./,
		)
		// Under the limit, the same change is a running sum.
		expect(ids(follow(grid, { cells }, [{ rowId: 'r1', columnId: 'a', value: 2 }]))).toHaveLength(
			100,
		)
		expect(grid.r100?.b).toBe(5051)
	})
})
