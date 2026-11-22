import { describe, expect, test } from 'vite-plus/test'
import type { FormulaSheet } from '../formula/types'
import type { ColumnDef } from '../rows'
import { createFormulaEngine, FORMULA_FUNCTIONS, formulaHelp, insertReference } from './index'

// The helpers of a field that writes a formula. The columns are Name A,
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
const info = (name: string) => FORMULA_FUNCTIONS.find((found) => found.name === name)
/** The help at the place of `|` in the text. */
const helpAt = (marked: string, locale?: string) =>
	formulaHelp(marked.replace('|', ''), marked.indexOf('|'), { locale })

describe('the list of functions', () => {
	test('gives each function its group and its arguments as a list', () => {
		expect(info('SUM')?.group).toBe('math')
		expect(info('COUNTIFS')?.group).toBe('condition')
		expect(info('XLOOKUP')?.group).toBe('lookup')
		expect(info('IFNA')?.group).toBe('logic')
		expect(info('TEXT')?.group).toBe('text')
		expect(info('WEEKOF')?.group).toBe('date')
		expect(info('ROUND')?.arguments).toEqual([
			{ name: 'number', optional: false, repeats: false },
			{ name: 'digits', optional: false, repeats: false },
		])
		expect(info('NOW')?.arguments).toEqual([])
		// `[range2, criterion2], …`: two optional arguments that repeat as a pair.
		expect(info('COUNTIFS')?.arguments).toEqual([
			{ name: 'range1', optional: false, repeats: false },
			{ name: 'criterion1', optional: false, repeats: false },
			{ name: 'range2', optional: true, repeats: true },
			{ name: 'criterion2', optional: true, repeats: true },
		])
		expect(info('XLOOKUP')?.arguments.map((arg) => arg.name)).toContain('if not found')
		expect(FORMULA_FUNCTIONS.every((found) => found.args !== undefined && found.help)).toBe(true)
	})
})

describe('formulaHelp', () => {
	test('names the call around the caret and the argument at it, in the innermost call', () => {
		const help = helpAt('=IF(A1>2, SUM(B1, |')
		expect(help.call).toMatchObject({ name: 'SUM', start: 10, index: 1, argument: 1 })
		expect(helpAt('=IF(A1>2|, 1)').call).toMatchObject({ name: 'IF', index: 0, argument: 0 })
		// After the inner call is closed, the caret is in IF again.
		expect(helpAt('=IF(SUM(B1), |').call).toMatchObject({ name: 'IF', index: 1 })
	})

	test('counts a repeated argument again in its group, and none past the last', () => {
		// COUNTIFS(range1, criterion1, range2, criterion2, range3, …): the 5th is range2 again.
		expect(helpAt('=COUNTIFS(A:A, 1, B:B, 2, |').call?.argument).toBe(2)
		expect(helpAt('=COUNTIFS(A:A, 1, B:B, 2, C:C, |').call?.argument).toBe(3)
		// SUM(number1, [number2], …): every argument after the first is number2.
		expect(helpAt('=SUM(1, 2, 3, |').call?.argument).toBe(1)
		expect(helpAt('=ROUND(1, 2, |').call?.argument).toBeUndefined()
		expect(helpAt('=SUMM(|').call).toMatchObject({ name: 'SUMM', info: undefined })
	})

	test('reads the sign between arguments of the locale', () => {
		expect(helpAt('=SUM(1,5; |', 'fi-FI').call?.index).toBe(1)
		// With a decimal comma, `1,5` is one number and not two arguments.
		expect(helpAt('=SUM(1,5|', 'fi-FI').call?.index).toBe(0)
		expect(helpAt('=SUM(1,5|', 'en-US').call?.index).toBe(1)
	})

	test('gives the token at the caret, with its kind and its place', () => {
		expect(helpAt('=SU|').token).toEqual({ kind: 'name', text: 'SU', start: 1, end: 3 })
		expect(helpAt('=SU|M(B1)').token).toEqual({ kind: 'function', text: 'SUM', start: 1, end: 4 })
		expect(helpAt('=B2|').token?.kind).toBe('reference')
		expect(helpAt('=SUM(B:B|)').token?.kind).toBe('reference')
		expect(helpAt('=[Price|').token?.kind).toBe('reference')
		expect(helpAt('=TRUE|').token?.kind).toBe('boolean')
		expect(helpAt('=1+|').token).toEqual({ kind: 'operator', text: '+', start: 2, end: 3 })
		expect(helpAt('=1 |').token).toBeNull()
	})

	test('says where a reference fits', () => {
		expect(helpAt('=|').reference).toBe(true)
		expect(helpAt('=SUM(|').reference).toBe(true)
		expect(helpAt('=SUM(B1, |').reference).toBe(true)
		expect(helpAt('=B1*|').reference).toBe(true)
		expect(helpAt('=B1|').reference).toBe(false)
		expect(helpAt('=SUM(B1)|').reference).toBe(false)
		expect(helpAt('=5%|').reference).toBe(false)
		// Inside a text in quotes that is not closed yet.
		expect(helpAt('=IF(A1>2, "ope|').reference).toBe(false)
		expect(helpAt('=IF(A1>2, "ope|').call?.name).toBe('IF')
		// A text that is no formula.
		expect(helpAt('SUM(|')).toEqual({ call: null, token: null, reference: false })
	})

	test('never throws for a text that cannot be read', () => {
		for (const text of ['=#', '=SUM(1.5;', '=[a', '=)))', '=1 ! 2', '=SUM(B2;']) {
			expect(() => formulaHelp(text, text.length, { locale: 'fi-FI' })).not.toThrow()
		}
	})
})

describe('insertReference', () => {
	test('puts the address at the caret, or in place of the selection', () => {
		expect(insertReference('=SUM(', { start: 5, end: 5 }, 'B2')).toEqual({
			text: '=SUM(B2',
			start: 5,
			end: 7,
		})
		expect(insertReference('=SUM(X9)', { start: 7, end: 5 }, 'B2:C5')).toEqual({
			text: '=SUM(B2:C5)',
			start: 5,
			end: 10,
		})
	})

	test('replaces the reference of the step before, so a drag writes one', () => {
		let step = insertReference('=SUM()', { start: 5, end: 5 }, 'B1')
		step = insertReference(step.text, step, 'B1:B2')
		step = insertReference(step.text, step, 'B1:B3')
		expect(step.text).toBe('=SUM(B1:B3)')
	})
})

describe('the references of a text and the address of a range', () => {
	const refs = (text: string, row = 'r5') =>
		engine
			.references(text, at(row, 'total'), sheet)
			.map(({ text: name, start, end, from, to, columns: whole }) => ({
				name,
				start,
				end,
				from: `${from.rowId}:${from.columnId}`,
				to: `${to.rowId}:${to.columnId}`,
				whole,
			}))

	test('gives each reference with its place and the cells from the first to the last', () => {
		expect(refs('=SUM(C3:B1)+$D$2*2')).toEqual([
			{ name: 'C3:B1', start: 5, end: 10, from: 'r1:price', to: 'r3:qty', whole: false },
			{ name: '$D$2', start: 12, end: 16, from: 'r2:total', to: 'r2:total', whole: false },
		])
		expect(refs('=SUM(B:C)')).toEqual([
			{ name: 'B:C', start: 5, end: 8, from: 'r1:price', to: 'r5:qty', whole: true },
		])
		// A reference in brackets is of the own row; one that names a row by id is of that row.
		expect(refs('=[Price]+[qty@r2]', 'r4').map((ref) => ref.from)).toEqual(['r4:price', 'r2:qty'])
	})

	test('leaves out what the document does not hold, and a function that looks like an address', () => {
		expect(refs('=B9+Z1+LOG10(2)+B')).toEqual([])
		expect(refs('=SUM(B1, "C2", [nothing])').map((ref) => ref.name)).toEqual(['B1'])
		// A text that is not whole yet.
		expect(refs('=SUM(B1:B2; C').map((ref) => ref.name)).toEqual(['B1:B2'])
	})

	test('writes the text of a range as a person types it', () => {
		const address = (from: string, to: string, whole = false) =>
			engine.rangeAddress(
				at(...(from.split(':') as [string, string])),
				at(...(to.split(':') as [string, string])),
				whole,
				sheet,
			)
		expect(address('r2:price', 'r2:price')).toBe('B2')
		expect(address('r5:qty', 'r2:price')).toBe('B2:C5')
		expect(address('r1:total', 'r5:price', true)).toBe('B:D')
		expect(address('r1:qty', 'r5:qty', true)).toBe('C:C')
		expect(address('gone:qty', 'r1:qty')).toBeUndefined()
	})
})
