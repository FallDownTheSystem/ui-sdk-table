import { describe, expect, test } from 'vite-plus/test'
import type { FormulaSheet } from '../formula/types'
import type { ColumnDef } from '../rows'
import { createFormulaEngine } from './index'

// How a stored formula moves to another cell. The columns are Name A,
// Price B, Quantity C and Total D, and the rows r1 to r5 are 1 to 5.

const columns: ColumnDef[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'price', header: 'Price' },
	{ id: 'qty', header: 'Quantity' },
	{ id: 'total', header: 'Total' },
]
const ids = ['r1', 'r2', 'r3', 'r4', 'r5']
const sheet: FormulaSheet = {
	columns: () => columns,
	rowIds: () => ids,
	row: () => ({}),
	value: () => undefined,
	locale: () => undefined,
}
const engine = createFormulaEngine()
const at = (rowId: string, columnId: string) => ({ rowId, columnId })
const copy = (formula: string, from: [string, string], to: [string, string]) =>
	engine.move(formula, at(...from), at(...to), sheet, 'copy')

describe('a copy or a fill of a formula', () => {
	test('keeps "this row", so a fill down shares one text', () => {
		expect(copy('=[price]*[qty]', ['r1', 'total'], ['r4', 'total'])).toBe('=[price]*[qty]')
	})

	test('moves a row without `$` by as many rows as the cell moved, and keeps one with `$`', () => {
		expect(copy('=[price@r1]+[qty@$r1]', ['r2', 'total'], ['r4', 'total'])).toBe(
			'=[price@r3]+[qty@$r1]',
		)
		expect(copy('=[price@r4]', ['r5', 'total'], ['r2', 'total'])).toBe('=[price@r1]')
	})

	test('moves a column without `$` by as many letters, and keeps one with `$`', () => {
		expect(copy('=[price@r1]*[$price@r1]', ['r2', 'qty'], ['r2', 'total'])).toBe(
			'=[qty@r1]*[$price@r1]',
		)
		expect(copy('=SUM([price@*])', ['r1', 'qty'], ['r1', 'total'])).toBe('=SUM([qty@*])')
	})

	test('gives #REF! for a part past the last row or the last column', () => {
		expect(copy('=[price@r4]+1', ['r3', 'total'], ['r5', 'total'])).toBe('=#REF!+1')
		expect(copy('=[qty]*2', ['r1', 'qty'], ['r1', 'total'])).toBe('=[total]*2')
		expect(copy('=[total@r1]', ['r2', 'qty'], ['r2', 'total'])).toBe('=#REF!')
	})

	test('moves both ends of a range, and a range with an end past the edge is #REF!', () => {
		expect(copy('=SUM([price@r1]:[price@r2])', ['r3', 'total'], ['r4', 'total'])).toBe(
			'=SUM([price@r2]:[price@r3])',
		)
		expect(copy('=SUM([price@r3]:[price@r4])', ['r3', 'total'], ['r5', 'total'])).toBe(
			'=SUM(#REF!)',
		)
	})
})

describe('a cut of a formula', () => {
	test('keeps the cells that it read: "this row" becomes the row it came from', () => {
		expect(
			engine.move('=[price]*[qty@r2]', at('r1', 'total'), at('r3', 'total'), sheet, 'cut'),
		).toBe('=[price@r1]*[qty@r2]')
		expect(engine.move('=[price]*2', at('r1', 'total'), at('r1', 'qty'), sheet, 'cut')).toBe(
			'=[price]*2',
		)
	})
})
