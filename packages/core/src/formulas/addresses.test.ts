import { describe, expect, test } from 'vite-plus/test'
import type { FormulaSheet } from '../formula/types'
import type { ColumnDef } from '../rows/types'
import { rowNumberColumn } from '../sheet/chrome'
import { createFormulaEngine } from './index'

// The addresses of a formula of a cell: the letter of a column is its place
// among the columns of the owner, without the columns that lead, and the
// number of a row is its place in the document. A test gives a plain sheet.

const columns: ColumnDef[] = [
	rowNumberColumn(),
	{ id: 'product', header: 'Product' },
	{ id: 'price', header: 'Price' },
	{ id: 'qty', header: 'Quantity' },
	{ id: 'total', header: 'Total' },
]

function sheet(rowIds: readonly string[], locale?: string): FormulaSheet {
	return {
		columns: () => columns,
		rowIds: () => rowIds,
		row: () => undefined,
		value: () => undefined,
		locale: () => locale,
	}
}

const engine = createFormulaEngine()
const rows = ['r1', 'r7', 'x', 'r3']
const at = (rowId: string) => ({ rowId, columnId: 'total' })

function stored(text: string, rowId = 'r7', locale?: string): string {
	const parsed = engine.parse(text, at(rowId), sheet(rows, locale))
	if ('issues' in parsed) throw new Error(engine.describe(parsed.issues[0] ?? { code: 'empty' }))
	return parsed.formula
}

describe('the address of a cell', () => {
	test('a letter skips the column of row numbers, and a number is the place in the document', () => {
		expect(engine.address({ rowId: 'x', columnId: 'product' }, sheet(rows))).toBe('A3')
		expect(engine.address({ rowId: 'r3', columnId: 'total' }, sheet(rows))).toBe('D4')
		expect(engine.address({ rowId: 'r1', columnId: '#' }, sheet(rows))).toBeUndefined()
		expect(engine.cellAt('$c$2', sheet(rows))).toEqual({ rowId: 'r7', columnId: 'qty' })
		expect(engine.rowNumber('r3', sheet(rows))).toBe(4)
	})

	test('an address past the end, or of no column, is an issue that says what is valid', () => {
		const past = engine.cellAt('B5', sheet(rows))
		expect('issues' in past && engine.describe(past.issues[0] ?? { code: 'empty' })).toBe(
			'No cell `B5`. The table has 4 rows.',
		)
		const none = engine.cellAt('Z1', sheet(rows))
		expect('issues' in none && engine.describe(none.issues[0] ?? { code: 'empty' })).toBe(
			'No column `Z1`. Columns: A, B, C, D.',
		)
	})
})

describe('a formula of a cell', () => {
	test('a cell of its own row without `$` on the number is "this row"; other rows are stored by id', () => {
		expect(stored('=B2*C2')).toBe('=[price]*[qty]')
		expect(stored('=B$2*C2')).toBe('=[price@$r7]*[qty]')
		expect(stored('=$B$3+B1')).toBe('=[$price@$x]+[price@r1]')
		// The row with the id `x` is the third row, and a row id that is a number is an id.
		expect(stored('=B3', 'r1')).toBe('=[price@x]')
	})

	test('a range of rows and a whole column', () => {
		expect(stored('=SUM(B1:B4)')).toBe('=SUM([price@r1]:[price@r3])')
		expect(stored('=SUM(B:B)')).toBe('=SUM([price@*])')
		expect(stored('=SUM(B:C)')).toBe('=SUM([price@*]:[qty@*])')
		// One end in the own row: the range names that row, so it does not move in a fill as \"this row\".
		expect(stored('=SUM(B1:B2)')).toBe('=SUM([price@r1]:[price@r7])')
	})

	test('prints back as addresses of now, in each locale, and an unknown address is refused', () => {
		const here = sheet(rows)
		for (const text of [
			'=B2*C2',
			'=$B$3+B1',
			'=SUM(B1:B4)',
			'=SUM(B:B)',
			'=IF(B2>1.5, "high", "low")',
		]) {
			expect(engine.print(stored(text), at('r7'), here)).toBe(text)
		}
		const fi = sheet(rows, 'fi-FI')
		const finnish = '=IF(B2>1,5; SUM(B:B); $C$3)'
		const formula = stored(finnish, 'r7', 'fi-FI')
		expect(formula).toBe('=IF([price]>1.5, SUM([price@*]), [$qty@$x])')
		expect(engine.print(formula, at('r7'), fi)).toBe(finnish)
		expect(engine.print(formula, at('r7'), here)).toBe('=IF(B2>1.5, SUM(B:B), $C$3)')

		const parsed = engine.parse('=B9', at('r7'), here)
		expect('issues' in parsed && engine.describe(parsed.issues[0] ?? { code: 'empty' })).toBe(
			'No cell `B9`. The table has 4 rows.',
		)
	})

	test('after a sort of the document the same ids print other numbers, and a row that is gone is #REF!', () => {
		const formula = stored('=B3+B1')
		expect(engine.print(formula, at('r7'), sheet(['x', 'r7', 'r1']))).toBe('=B1+B3')
		expect(engine.print(formula, at('r7'), sheet(['r7', 'r1']))).toBe('=#REF!+B2')
	})

	test('a formula of a column still reads its own row only', () => {
		const parsed = engine.parse('=B2*2', { columnId: 'total' }, sheet(rows))
		expect('issues' in parsed && parsed.issues[0]?.code).toBe('otherRow')
	})
})
