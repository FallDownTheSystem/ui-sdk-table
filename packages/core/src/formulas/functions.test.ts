import SSF from 'ssf'
import { describe, expect, test } from 'vite-plus/test'
import type { FormulaSheet } from '../formula/types'
import type { ColumnDef } from '../rows/types'
import { createFormulaEngine, type FormulaEngineOptions } from './index'

// The functions over ranges, the lookups, the texts and the dates that came
// with the list of the owner. The expected values are worked out by hand
// from the function reference of Microsoft Excel, and the codes of `TEXT`
// are checked against `ssf`, which reads the format codes of Excel.

// The letters: A name, B qty, C kind, D day, E up, F down, G moment.
const columns: ColumnDef[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'qty', header: 'Qty' },
	{ id: 'kind', header: 'Kind' },
	{ id: 'day', header: 'Day' },
	{ id: 'up', header: 'Up' },
	{ id: 'down', header: 'Down' },
	{ id: 'moment', header: 'Moment' },
]

type Grid = Record<string, Record<string, unknown>>

const grid: Grid = {
	r1: { name: 'Apple', qty: 10, kind: 'fruit', day: '2026-01-15', up: 1, down: 9 },
	r2: { name: 'apricot', qty: 5, kind: 'Fruit', day: '2026-02-28', up: 3, down: 7 },
	// A text of a number: a criterion of 7 takes it, a comparison does not.
	r3: { name: 'Banana', qty: '7', kind: 'fruit', day: null, up: 5, down: 5 },
	r4: { name: 'Carrot', qty: null, kind: 'veg', day: '2026-03-31', up: 7, down: 3 },
	r5: { name: 'a*b', qty: 20, kind: '', day: '2024-02-29', up: 9, down: 1 },
}

function sheetOf(cells: Grid): FormulaSheet {
	const rowIds = Object.keys(cells)
	return {
		columns: () => columns,
		rowIds: () => rowIds,
		row: (rowId) => cells[rowId],
		value: (rowId, columnId) => cells[rowId]?.[columnId],
		locale: () => undefined,
	}
}

function evaluate(text: string, options: FormulaEngineOptions = {}, cells: Grid = grid): unknown {
	return createFormulaEngine(options).evaluateText(
		text,
		{ rowId: 'r1', columnId: 'name' },
		sheetOf(cells),
	)
}

const cases = (list: [string, unknown][]) =>
	test.each(list)('%s is %j', (formula, expected) => expect(evaluate(formula)).toEqual(expected))

describe('the criteria of COUNTIF and its family', () => {
	cases([
		// Capital and small letters are the same.
		['=COUNTIF(C1:C5, "fruit")', 3],
		// Both sides of a boundary; the text "7" is no number for a comparison.
		['=COUNTIF(B1:B5, ">=10")', 2],
		['=COUNTIF(B1:B5, ">10")', 1],
		['=COUNTIF(B1:B5, "<5")', 0],
		['=COUNTIF(B1:B5, "<=5")', 1],
		// A number takes a text of that number.
		['=COUNTIF(B1:B5, 7)', 1],
		['=COUNTIF(B1:B5, "=7")', 1],
		// The wildcards, and `~` before one.
		['=COUNTIF(A1:A5, "a*")', 3],
		['=COUNTIF(A1:A5, "a~*b")', 1],
		['=COUNTIF(A1:A5, "?????")', 1],
		// `<>` takes the empty cell too; an empty text takes only the empty cells.
		['=COUNTIF(C1:C5, "<>fruit")', 2],
		['=COUNTIF(C1:C5, "")', 1],
		['=COUNTIF(B1:B5, "<>")', 4],
		// A day compares with the days, and never with a number.
		['=COUNTIF(D1:D5, ">2026-01-31")', 2],
		['=COUNTIF(D1:D5, ">=2026-02-28")', 2],
		['=COUNTIF(D1:D5, "2024-02-29")', 1],
		['=COUNTIF(D1:D5, ">0")', 0],
		// A value that is no range, and an error as the criterion.
		['=COUNTIF(5, 5)', '#VALUE!'],
		['=COUNTIF(B1:B5, 1/0)', 0],
		['=COUNTIFS(C1:C5, "fruit", B1:B5, ">=7")', 1],
		['=COUNTIFS(C1:C5, "fruit", A1:A5, "a*")', 2],
		// The ranges must have the same size.
		['=COUNTIFS(C1:C5, "fruit", B1:B4, ">=7")', '#VALUE!'],
		['=COUNTBLANK(B1:B5)', 1],
		['=COUNTBLANK(C1:D5)', 2],
		['=SUMIF(C1:C5, "fruit", B1:B5)', 15],
		['=SUMIF(B1:B5, ">5")', 30],
		['=SUMIF(C1:C5, "fruit", B1:B4)', '#VALUE!'],
		['=SUMIFS(B1:B5, C1:C5, "fruit", A1:A5, "a*")', 15],
		['=SUMIFS(B1:B4, C1:C5, "fruit")', '#VALUE!'],
		['=AVERAGEIF(C1:C5, "fruit", B1:B5)', 7.5],
		// The matching cell holds no number.
		['=AVERAGEIF(C1:C5, "veg", B1:B5)', '#DIV/0!'],
		['=AVERAGEIFS(B1:B5, C1:C5, "<>veg")', 11.6666666666667],
		['=AVERAGEIFS(B1:B5, C1:C5, "none")', '#DIV/0!'],
	])

	test('an error in the values of a matching cell is the answer, and one in a cell that does not match is not', () => {
		const cells: Grid = {
			r1: { kind: 'a', qty: 1 },
			r2: { kind: 'b', qty: '#N/A' },
		}
		expect(evaluate('=SUMIF(C1:C2, "a", B1:B2)', {}, cells)).toBe(1)
		expect(evaluate('=SUMIF(C1:C2, "b", B1:B2)', {}, cells)).toBe('#N/A')
		expect(evaluate('=COUNTIF(B1:B2, "#N/A")', {}, cells)).toBe(1)
	})
})

describe('the lookups', () => {
	cases([
		['=MATCH("apricot", A1:A5, 0)', 2],
		['=MATCH("BAN*", A1:A5, 0)', 3],
		['=MATCH("zzz", A1:A5, 0)', '#N/A'],
		// A range of two columns is no list.
		['=MATCH("Apple", A1:B5, 0)', '#N/A'],
		// Type 1, the default: the largest value up to it, in a range sorted up.
		['=MATCH(6, E1:E5)', 3],
		['=MATCH(5, E1:E5, 1)', 3],
		['=MATCH(0, E1:E5)', '#N/A'],
		['=MATCH(10, E1:E5)', 5],
		// Type -1: the smallest value from it, in a range sorted down.
		['=MATCH(6, F1:F5, -1)', 2],
		['=MATCH(10, F1:F5, -1)', '#N/A'],
		['=MATCH(1, F1:F5, -1)', 5],
		['=MATCH(1/0, E1:E5)', '#DIV/0!'],
		['=VLOOKUP("banana", A1:C5, 3, FALSE)', 'fruit'],
		['=VLOOKUP("Banana", A1:C5, 4, FALSE)', '#REF!'],
		['=VLOOKUP("Banana", A1:C5, 0, FALSE)', '#VALUE!'],
		['=VLOOKUP("Pear", A1:C5, 2, FALSE)', '#N/A'],
		['=VLOOKUP(6, E1:F5, 2)', 5],
		['=VLOOKUP(9, E1:F5, 2, TRUE)', 1],
		['=VLOOKUP(0, E1:F5, 2)', '#N/A'],
		['=XLOOKUP("carrot", A1:A5, C1:C5)', 'veg'],
		['=XLOOKUP("Pear", A1:A5, C1:C5, "none")', 'none'],
		['=XLOOKUP("Pear", A1:A5, C1:C5)', '#N/A'],
		// Match -1: or the next smaller; 1: or the next larger; 2: with wildcards.
		['=XLOOKUP(6, E1:E5, A1:A5, "-", -1)', 'Banana'],
		['=XLOOKUP(6, E1:E5, A1:A5, "-", 1)', 'Carrot'],
		['=XLOOKUP(0, E1:E5, A1:A5, "-", -1)', '-'],
		['=XLOOKUP("a?ple", A1:A5, B1:B5, "-", 2)', 10],
		['=XLOOKUP("a?ple", A1:A5, B1:B5, "-", 0)', '-'],
		// Search -1 starts at the last cell.
		['=XLOOKUP("fruit", C1:C5, A1:A5, "-", 0, -1)', 'Banana'],
		['=XLOOKUP("fruit", C1:C5, A1:A5, "-", 0, 1)', 'Apple'],
		// Results of two columns would spill.
		['=XLOOKUP("Apple", A1:A5, B1:C5)', '#VALUE!'],
		['=XLOOKUP("Apple", A1:A5, B1:B4)', '#VALUE!'],
		['=XLOOKUP("Apple", A1:B5, C1:C5)', '#VALUE!'],
		['=XLOOKUP("Apple", A1:A5, C1:C5, "-", 3)', '#VALUE!'],
		['=INDEX(A1:C5, 2, 3)', 'Fruit'],
		['=INDEX(A1:C5, 6, 1)', '#REF!'],
		['=INDEX(A1:C5, 1, 4)', '#REF!'],
		['=INDEX(A1:A5, 3)', 'Banana'],
		// A range of one row: the second argument is the column.
		['=INDEX(A1:C1, 2)', 10],
		// A whole column of a range of more than one would spill.
		['=INDEX(A1:C5, 0, 1)', '#VALUE!'],
		['=INDEX(A1:C5, -1, 1)', '#VALUE!'],
		['=INDEX(A1:A5, MATCH("Carrot", A1:A5, 0))', 'Carrot'],
		['=IFNA(MATCH("zzz", A1:A5, 0), "none")', 'none'],
		['=IFNA(1/0, "none")', '#DIV/0!'],
		['=IFNA(4, "none")', 4],
	])
})

describe('the texts', () => {
	cases([
		['=TEXTJOIN(", ", TRUE, A1:A3)', 'Apple, apricot, Banana'],
		['=TEXTJOIN("-", FALSE, C3:C5)', 'fruit-veg-'],
		['=TEXTJOIN("-", TRUE, C3:C5)', 'fruit-veg'],
		['=TEXTJOIN("-", TRUE, B1:B2, "x")', '10-5-x'],
		['=TEXTJOIN("-", TRUE, 1/0)', '#DIV/0!'],
		['=SUBSTITUTE("a-b-c", "-", "+")', 'a+b+c'],
		['=SUBSTITUTE("a-b-c", "-", "+", 2)', 'a-b+c'],
		['=SUBSTITUTE("a-b-c", "-", "+", 3)', 'a-b-c'],
		['=SUBSTITUTE("a-b-c", "-", "+", 0)', '#VALUE!'],
		['=SUBSTITUTE("Aa", "a", "x")', 'Ax'],
		['=SUBSTITUTE("abc", "", "x")', 'abc'],
		['=FIND("b", "abcb")', 2],
		['=FIND("b", "abcb", 3)', 4],
		['=FIND("B", "abc")', '#VALUE!'],
		['=FIND("", "abc")', 1],
		['=FIND("a", "abc", 4)', '#VALUE!'],
		['=FIND("a", "abc", 0)', '#VALUE!'],
		['=FIND("*", "a*b")', 2],
		['=SEARCH("B", "abc")', 2],
		['=SEARCH("c*", "abcd")', 3],
		['=SEARCH("?c", "abcd")', 2],
		['=SEARCH("~*", "a*b")', 2],
		['=SEARCH("x", "abc")', '#VALUE!'],
		['=SEARCH(".", "a.b")', 2],
		['=VALUE("12.5")', 12.5],
		['=VALUE(" -3 ")', -3],
		['=VALUE("1e3")', 1000],
		['=VALUE("abc")', '#VALUE!'],
		['=VALUE("")', '#VALUE!'],
		['=VALUE(B4)', 0],
		['=VALUE(B3)', 7],
		['=VALUE(1/0)', '#DIV/0!'],
	])
})

describe('TEXT', () => {
	const numbers: [number, string][] = [
		[1234.567, '#,##0.00'],
		[1234567, '#,##0'],
		[-1234.5, '$#,##0'],
		[0.5, '#.00'],
		[0.5, '0.0%'],
		[0.125, '0%'],
		[-0.001, '0'],
		[-0.4, '0'],
		[2.5, '0'],
		[5, '000'],
		[0, '#'],
		[0, '#.##'],
		[1.5, '#.##'],
		[2, '#.##'],
		[0.5, '0.##'],
		[12.345, '0.0#'],
		[-5, '"Total: "0'],
		[12, '# ##0'],
		[12345, '##,##0'],
		[7, '0\\h'],
	]
	test.each(numbers)('%j in %s is the text of Excel', (value, code) => {
		const formula = `=TEXT(${value}, "${code.replaceAll('"', '""')}")`
		expect(evaluate(formula)).toBe(SSF.format(code, value))
	})

	// The serial number of Excel for a moment in UTC.
	const serial = (iso: string) => Date.parse(iso) / 86_400_000 + 25_569
	const dates: [string, string][] = [
		['2023-03-15T18:00:00Z', 'yyyy-mm-dd hh:mm:ss'],
		['2023-03-15T18:00:00Z', 'd mmm yyyy'],
		['2023-03-15T18:00:00Z', 'dddd, mmmm d'],
		['2023-03-15T18:00:00Z', 'h:mm AM/PM'],
		['2023-03-15T00:00:00Z', 'h AM/PM'],
		['2023-03-15T06:00:00Z', 'm/d/yy'],
		['2023-03-15T12:34:56Z', 'mm:ss'],
		['2023-03-15T12:34:56Z', 'h:mm:ss'],
		['2023-03-15T12:00:00Z', 'ddd mm'],
		['2023-03-15T23:59:59.400Z', 'hh:mm:ss'],
		['2024-02-29T07:05:00Z', 'mmmmm yy, d/m/yyyy'],
	]
	test.each(dates)('%s in %s is the text of Excel', (iso, code) => {
		const cells: Grid = { r1: { moment: new Date(iso) } }
		expect(evaluate(`=TEXT(G1, "${code}")`, { timeZone: 'UTC' }, cells)).toBe(
			SSF.format(code, serial(iso)),
		)
	})

	cases([
		// A half goes away from zero, also below zero and after the binary digits of 1.005.
		['=TEXT(-2.5, "0")', '-3'],
		['=TEXT(1.005, "0.00")', '1.01'],
		['=TEXT(D1, "d mmmm yyyy")', '15 January 2026'],
		['=TEXT(D1, "ddd")', 'Thu'],
		// A point between the parts of a day, as many countries write it. `ssf` does not read this code.
		['=TEXT(D5, "d.m.yyyy")', '29.2.2024'],
		['=TEXT(B4, "0")', '0'],
		['=TEXT("abc", "0")', 'abc'],
		['=TEXT(TRUE, "0")', 'TRUE'],
		['=TEXT(1/0, "0")', '#DIV/0!'],
		['=TEXT(12.5, "General")', '12.5'],
		// Codes outside the stated set.
		['=TEXT(1, "0.0E+00")', '#VALUE!'],
		['=TEXT(1, "[Red]0")', '#VALUE!'],
		['=TEXT(1, "0;-0")', '#VALUE!'],
		['=TEXT(1, "0,")', '#VALUE!'],
		['=TEXT(1, "yyyy0")', '#VALUE!'],
		// A quote that is never closed.
		['=TEXT(1, """open")', '#VALUE!'],
		// A date of the table is no number, and a number is no date.
		['=TEXT(D1, "0")', '#VALUE!'],
		['=TEXT(5, "yyyy")', '#VALUE!'],
	])
})

describe('the dates', () => {
	cases([
		['=EOMONTH("2026-01-15", 1)', '2026-02-28'],
		['=EOMONTH("2024-01-31", 1)', '2024-02-29'],
		['=EOMONTH("2026-03-31", -1)', '2026-02-28'],
		['=EOMONTH(D1, 0)', '2026-01-31'],
		['=EOMONTH("2026-12-15", 1)', '2027-01-31'],
		['=EOMONTH(D1, 1.9)', '2026-02-28'],
		['=EOMONTH("x", 1)', '#VALUE!'],
		['=EOMONTH(D1, "x")', '#VALUE!'],
	])

	test('TODAY and NOW read the clock of the engine, and TODAY its zone', () => {
		// 23:30 in UTC is 00:30 of the next day in Berlin.
		const now = () => Date.UTC(2026, 10, 22, 23, 30)
		expect(evaluate('=TODAY()', { now, timeZone: 'UTC' })).toBe('2026-11-22')
		expect(evaluate('=TODAY()', { now, timeZone: 'Europe/Berlin' })).toBe('2026-11-23')
		expect(evaluate('=NOW()', { now })).toEqual(new Date(now()))
		expect(evaluate('=EOMONTH(TODAY(), 0)', { now, timeZone: 'UTC' })).toBe('2026-11-30')
	})
})
