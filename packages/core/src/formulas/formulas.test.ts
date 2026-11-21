import { describe, expect, test } from 'vite-plus/test'
import type { ColumnDef } from '../rows'
import {
	compileRowFormula,
	describeFormulaIssue,
	FORMULA_FUNCTIONS,
	formulaColumn,
	parseFormula,
	printFormula,
} from './index'

// The expected values come from the function reference of Microsoft Excel,
// not from what JavaScript gives: a formula from a spreadsheet must mean the
// same here.

type Line = {
	id: string
	price: number
	qty: number
	note: string | null
	flag: boolean
	bad: string
	word: string
	digits: string
}

const LINE: Line = {
	id: 'a',
	price: 2.5,
	qty: 4,
	note: null,
	flag: true,
	bad: '#DIV/0!',
	word: '  Big   red  box ',
	digits: '3',
}

const columns: ColumnDef<Line>[] = [
	{ id: '#', rowHeader: true },
	{ id: 'price', header: 'Price' },
	{ id: 'qty', header: 'Quantity' },
	{ id: 'note', header: 'Note' },
	{ id: 'flag', header: 'Flag' },
	{ id: 'bad', header: 'Bad' },
	{ id: 'word', header: 'Word' },
	{ id: 'digits', header: 'Digits' },
]

/** Reads the text of a person in a locale, then computes the stored form for a row. */
function run(formula: string, locale?: string, row: Line = LINE) {
	const parsed = parseFormula(formula, { columns, locale })
	if ('issues' in parsed)
		throw new Error(describeFormulaIssue(parsed.issues[0] ?? { code: 'empty' }))
	return compileRowFormula(parsed.formula, columns)(row)
}

const parse = (text: string, locale?: string) => parseFormula(text, { columns, locale })

describe('the operators', () => {
	test.each([
		['=1+2*3', 7],
		['=(1+2)*3', 9],
		// A negation binds closer than a power, and a power goes from the left.
		['=-2^2', 4],
		['=2^3^2', 64],
		['=10%', 0.1],
		['=50%*[price]', 1.25],
		['=0.1+0.2', 0.3],
		['=7/2', 3.5],
		['=[price]*[qty]', 10],
		['=[Price]*[QUANTITY]', 10],
		['="3"+1', 4],
		['=[digits]+1', 4],
		['=TRUE+1', 2],
		['=[note]+1', 1],
		['=[note]*5', 0],
	])('%s is %s', (formula, value) => {
		expect(run(formula)).toBe(value)
	})

	test.each([
		['=1/0', '#DIV/0!'],
		['=0^0', '#NUM!'],
		['=(-8)^(1/3)', '#NUM!'],
		['=10^400', '#NUM!'],
		['="x"+1', '#VALUE!'],
		['=[word]*2', '#VALUE!'],
		['=[bad]+1', '#DIV/0!'],
		['=1+[bad]', '#DIV/0!'],
		['=#N/A', '#N/A'],
	])('%s is the error %s', (formula, error) => {
		expect(run(formula)).toBe(error)
	})

	test('`&` joins texts, with a number as its plain text and a boolean in capitals', () => {
		expect(run('="a"&1')).toBe('a1')
		expect(run('=1&TRUE')).toBe('1TRUE')
		expect(run('=[note]&"x"')).toBe('x')
		expect(run('=1/3&""')).toBe('0.333333333333333')
		expect(run('="say ""hi"""')).toBe('say "hi"')
		expect(run('="a"&[bad]')).toBe('#DIV/0!')
	})

	test.each([
		['="a"="A"', true],
		['="a"<"B"', true],
		['="é"="e"', false],
		// Kinds that do not match: numbers, then texts, then booleans.
		['=1<"a"', true],
		['="z"<TRUE', true],
		['=9<FALSE', true],
		['="1"=1', false],
		['=[note]=0', true],
		['=[note]=""', true],
		['=[note]=FALSE', true],
		['=0.1+0.2=0.3', true],
		// A spreadsheet keeps 15 digits: the 16th is no difference, the 14th is.
		['=1.000000000000001=1', true],
		['=1.0000000000001>1', true],
		['=1<>2', true],
		['=2>=2', true],
		['=1+1=2', true],
	])('%s is %s', (formula, value) => {
		expect(run(formula)).toBe(value)
	})

	test('an empty cell gives an empty cell, and a whole result loses its last binary digits', () => {
		expect(run('=[note]')).toBeNull()
		expect(run('=3*1.1')).toBe(3.3)
	})
})

describe('the functions of numbers', () => {
	test.each([
		['=SUM(1, 2, 3)', 6],
		// A cell with a text, a boolean or nothing is left out; a value written in the formula counts.
		['=SUM([price], [digits], [flag], [note])', 2.5],
		['=SUM([price], "3", TRUE)', 6.5],
		['=SUM(1, "x")', '#VALUE!'],
		['=SUM([price], [bad])', '#DIV/0!'],
		['=AVERAGE([price], [qty])', 3.25],
		['=AVERAGE([note], [word])', '#DIV/0!'],
		['=MIN([price], [qty], 3)', 2.5],
		['=MAX([note])', 0],
		['=MAX(-1, -5)', -1],
		['=COUNT([price], [digits], [flag], [note], [bad], 1, "2", TRUE, "x")', 4],
		['=COUNTA([price], [note], [bad], [word], "")', 4],
		['=ROUND(2.5, 0)', 3],
		['=ROUND(-2.5, 0)', -3],
		['=ROUND(2.15, 1)', 2.2],
		['=ROUND(-1.475, 2)', -1.48],
		['=ROUND(1.005, 2)', 1.01],
		['=ROUND(21.5, -1)', 20],
		['=ROUND(626.3, -3)', 1000],
		['=ROUND(1.98, -1)', 0],
		['=ROUND(-50.55, -2)', -100],
		['=ROUND(2.567, 1.9)', 2.6],
		['=ROUNDUP(3.2, 0)', 4],
		['=ROUNDUP(76.9, 0)', 77],
		['=ROUNDUP(3.14159, 3)', 3.142],
		['=ROUNDUP(-3.14159, 1)', -3.2],
		['=ROUNDUP(31415.92654, -2)', 31500],
		['=ROUNDDOWN(3.2, 0)', 3],
		['=ROUNDDOWN(76.9, 0)', 76],
		['=ROUNDDOWN(3.14159, 3)', 3.141],
		['=ROUNDDOWN(-3.14159, 1)', -3.1],
		['=ROUNDDOWN(31415.92654, -2)', 31400],
		['=FLOOR(3.7, 2)', 2],
		['=FLOOR(-2.5, -2)', -2],
		['=FLOOR(-2.5, 2)', -4],
		['=FLOOR(2.5, -2)', '#NUM!'],
		['=FLOOR(1.58, 0.1)', 1.5],
		['=FLOOR(0.234, 0.01)', 0.23],
		['=FLOOR(3, 0)', '#DIV/0!'],
		['=CEILING(2.5, 1)', 3],
		['=CEILING(-2.5, -2)', -4],
		['=CEILING(-2.5, 2)', -2],
		['=CEILING(1.5, 0.1)', 1.5],
		['=CEILING(0.234, 0.01)', 0.24],
		['=CEILING(2.5, -2)', '#NUM!'],
		['=CEILING(4, 0)', 0],
		['=ABS(-4)', 4],
		['=INT(8.9)', 8],
		['=INT(-8.9)', -9],
		['=INT(-2.5)', -3],
		['=MOD(3, 2)', 1],
		['=MOD(-3, 2)', 1],
		['=MOD(3, -2)', -1],
		['=MOD(-3, -2)', -1],
		['=MOD(5.5, 2)', 1.5],
		['=MOD(1, 0)', '#DIV/0!'],
	])('%s is %s', (formula, value) => {
		expect(run(formula)).toBe(value)
	})
})

describe('the conditions', () => {
	test.each([
		['=IF([qty]>3, "many", "few")', 'many'],
		['=IF([qty]>9, "many")', false],
		// A branch that is not taken does no harm.
		['=IF(TRUE, 1, 1/0)', 1],
		['=IF(FALSE, 1/0, 2)', 2],
		['=IF([bad], 1, 2)', '#DIV/0!'],
		['=IF("x", 1, 2)', '#VALUE!'],
		['=IF("true", 1, 2)', 1],
		['=IF([note], 1, 2)', 2],
		['=IF(0.5, 1, 2)', 1],
		['=IFS([price]<1, "small", [price]<10, "medium", TRUE, "large")', 'medium'],
		['=IFS([price]>100, "large")', '#N/A'],
		['=IFS(FALSE, 1/0, TRUE, 2)', 2],
		['=SWITCH([qty], 1, "one", 4, "four", "other")', 'four'],
		['=SWITCH([qty], 1, "one", "other")', 'other'],
		['=SWITCH([qty], 1, "one", 2, "two")', '#N/A'],
		['=SWITCH("A", "a", "letter")', 'letter'],
		['=AND(TRUE, 1, [qty]>3)', true],
		['=AND(TRUE, 0)', false],
		// Every test is read, so an error after a false one is the answer.
		['=AND(FALSE, 1/0)', '#DIV/0!'],
		['=OR(FALSE, 1/0)', '#DIV/0!'],
		['=AND([flag], [word])', true],
		['=AND([word])', '#VALUE!'],
		['=AND("x")', '#VALUE!'],
		['=OR(FALSE, [price]>2)', true],
		['=NOT([flag])', false],
		['=IFERROR(1/0, "none")', 'none'],
		['=IFERROR([price], "none")', 2.5],
		['=ISBLANK([note])', true],
		['=ISBLANK("")', false],
		['=ISBLANK([price])', false],
		['=ISNUMBER([price])', true],
		['=ISNUMBER([digits])', false],
		['=ISTEXT([word])', true],
		['=ISTEXT([bad])', false],
		['=ISERROR([bad])', true],
		['=ISERROR(1/0)', true],
		['=ISERROR([price])', false],
	])('%s is %s', (formula, value) => {
		expect(run(formula)).toBe(value)
	})
})

describe('the functions of texts', () => {
	test.each([
		['=CONCAT("a", 1, TRUE, [note])', 'a1TRUE'],
		['=CONCAT("a", [bad])', '#DIV/0!'],
		['=LEN([word])', 17],
		['=LEN(123.4)', 5],
		['=LEFT("Sale Price", 4)', 'Sale'],
		['=LEFT("Sweden")', 'S'],
		['=LEFT("abc", 9)', 'abc'],
		['=LEFT("abc", -1)', '#VALUE!'],
		['=RIGHT("Sale Price", 5)', 'Price'],
		['=RIGHT("Stock Number")', 'r'],
		['=RIGHT("abc", 0)', ''],
		['=MID("Fluid Flow", 1, 5)', 'Fluid'],
		['=MID("Fluid Flow", 7, 20)', 'Flow'],
		['=MID("Fluid Flow", 20, 5)', ''],
		['=MID("abc", 0, 1)', '#VALUE!'],
		['=MID("abc", 1, -1)', '#VALUE!'],
		['=UPPER("total")', 'TOTAL'],
		['=LOWER("E. E. Cummings")', 'e. e. cummings'],
		['=TRIM([word])', 'Big red box'],
	])('%s is %s', (formula, value) => {
		expect(run(formula)).toBe(value)
	})
})

describe('the issues of a formula', () => {
	const issueOf = (text: string, locale?: string) => {
		const parsed = parse(text, locale)
		if (!('issues' in parsed)) throw new Error(`"${text}" was read as ${parsed.formula}.`)
		const issue = parsed.issues[0]
		if (!issue) throw new Error('No issue.')
		return { ...issue, words: describeFormulaIssue(issue) }
	}

	test('each issue says what is valid', () => {
		expect(issueOf('=')).toMatchObject({ code: 'empty' })
		expect(issueOf('=SUMM([price])')).toMatchObject({
			code: 'unknownFunction',
			name: 'SUMM',
			at: 1,
			words: expect.stringContaining('Functions: ABS, AND, AVERAGE,'),
		})
		expect(issueOf('=[Pric]*2')).toMatchObject({
			code: 'unknownColumn',
			words: 'No column `Pric`. Columns: Price, Quantity, Note, Flag, Bad, Word, Digits.',
		})
		expect(issueOf('=IF(1, 2, 3, 4)')).toMatchObject({
			code: 'arguments',
			words: '`IF` takes 2 or 3 values, not 4.',
		})
		expect(issueOf('=IFS(TRUE, 1, FALSE)').words).toBe(
			'`IFS` takes pairs of values, at least 2, not 3.',
		)
		expect(issueOf('=ROUND(1)').words).toBe('`ROUND` takes 2 values, not 1.')
		expect(issueOf('=SUM()').words).toBe('`SUM` takes at least 1 value, not 0.')
		expect(issueOf('=1+')).toMatchObject({
			code: 'syntax',
			found: '',
			words: 'The formula ends too soon.',
		})
		expect(issueOf('=1+*2')).toMatchObject({ code: 'syntax', found: '*', at: 3 })
		expect(issueOf('=(1+2')).toMatchObject({ code: 'syntax', found: '' })
		expect(issueOf('=1+2)')).toMatchObject({ code: 'syntax', found: ')' })
		expect(issueOf('="open')).toMatchObject({ code: 'syntax' })
		expect(issueOf('=[price')).toMatchObject({ code: 'syntax' })
		expect(issueOf('=#OOPS')).toMatchObject({ code: 'syntax', found: '#' })
		expect(issueOf('=price*2')).toMatchObject({
			code: 'unknownName',
			words: expect.stringContaining('such as [price]'),
		})
	})

	test.each(['=B7*2', '=$B$7', '=B:B', '=[price@r3]', '=[price]:[qty]', '=SUM(B2:B9)'])(
		'a reference to another row, an address or a range is read and refused: %s',
		(text) => {
			expect(issueOf(text)).toMatchObject({
				code: 'otherRow',
				words: expect.stringContaining('reads the cells of its own row only'),
			})
		},
	)

	test('a header that two columns share names neither, and an id still does', () => {
		const shared: ColumnDef<Line>[] = [
			{ id: 'price', header: 'Amount' },
			{ id: 'qty', header: 'amount' },
		]
		const parsed = parseFormula('=[Amount]+1', { columns: shared })
		expect(parsed).toMatchObject({ issues: [{ code: 'sharedHeader', valid: ['price', 'qty'] }] })
		expect(parseFormula('=[qty]+1', { columns: shared })).toEqual({ formula: '=[qty]+1' })
		// The printer writes the id where the header would not lead back.
		expect(printFormula('=[price]+[qty]', { columns: shared })).toBe('=[price]+[qty]')
	})

	test('a formula holds at most 8,192 characters and 64 levels', () => {
		expect(issueOf(`=${'1+'.repeat(4096)}1`)).toMatchObject({ code: 'tooLong', limit: 8192 })
		expect(parse(`=${'1+'.repeat(4000)}1`)).toHaveProperty('formula')
		expect(issueOf(`=${'('.repeat(65)}1${')'.repeat(65)}`)).toMatchObject({ code: 'tooDeep' })
		expect(parse(`=${'('.repeat(64)}1${')'.repeat(64)}`)).toHaveProperty('formula')
		expect(issueOf(`=${'ABS('.repeat(65)}1${')'.repeat(65)}`)).toMatchObject({ code: 'tooDeep' })
		expect(issueOf(`=${'-'.repeat(65)}1`)).toMatchObject({ code: 'tooDeep' })
	})

	test('every function of the list has a name, its arguments and a line of help', () => {
		expect(FORMULA_FUNCTIONS.length).toBe(33)
		for (const info of FORMULA_FUNCTIONS) {
			expect(info.name).toMatch(/^[A-Z]+$/)
			expect(info.args).not.toBe('')
			expect(info.help).toMatch(/\.$/)
		}
	})
})

describe('the stored form and the text of a locale', () => {
	test.each([
		// The text of a person in en-US, the stored form, the text of a person in fi-FI.
		['=[Price]*[Quantity]', '=[price]*[qty]', '=[Price]*[Quantity]'],
		[
			'=IF([Price]>1.5, "high", "low")',
			'=IF([price]>1.5, "high", "low")',
			'=IF([Price]>1,5; "high"; "low")',
		],
		['=ROUND([Price]*1.24, 2)', '=ROUND([price]*1.24, 2)', '=ROUND([Price]*1,24; 2)'],
		['=-(2.50+0.5)%&"x"', '=-(2.50+0.5)%&"x"', '=-(2,50+0,5)%&"x"'],
		['=SUM([$Price], 1E3, #N/A)', '=SUM([$price], 1E3, #N/A)', '=SUM([$Price]; 1E3; #N/A)'],
	])('%s', (english, stored, finnish) => {
		expect(parse(english, 'en-US')).toEqual({ formula: stored })
		expect(printFormula(stored, { columns, locale: 'en-US' })).toBe(english)
		expect(printFormula(stored, { columns, locale: 'fi-FI' })).toBe(finnish)
		// The text of fi-FI is read back to the same stored form, and prints in en-US with `.` and `,`.
		expect(parse(finnish, 'fi-FI')).toEqual({ formula: stored })
	})

	test('`.5` is the number 0.5', () => {
		expect(parse('=.5*2')).toEqual({ formula: '=0.5*2' })
	})

	test('a locale with `.` takes both `,` and `;` between arguments', () => {
		expect(parse('=IF([qty]>1; 2; 3)', 'en-US')).toEqual({ formula: '=IF([qty]>1, 2, 3)' })
		expect(run('=IF([qty]>1; 2; 3)', 'en-US')).toBe(2)
	})

	test('a locale with `,` reads `1,5` as a number, and `,` is never a separator there', () => {
		expect(run('=[price]*1,5', 'fi-FI')).toBe(3.75)
		expect(run('=IF([qty]>1,5; "high"; "low")', 'de-DE')).toBe('high')
		const comma = parse('=SUM([price], 2)', 'fi-FI')
		expect(comma).toMatchObject({ issues: [{ code: 'separator', expected: ';' }] })
		expect('issues' in comma && describeFormulaIssue(comma.issues[0] ?? { code: 'empty' })).toBe(
			'This language puts `;` between the values of a function, such as IF([a]>1; "yes"; "no").',
		)
		const point = parse('=[price]*1.5', 'fi-FI')
		expect(point).toMatchObject({ issues: [{ code: 'decimalSign', expected: ',', at: 10 }] })
		expect('issues' in point && describeFormulaIssue(point.issues[0] ?? { code: 'empty' })).toBe(
			'This language writes a decimal number with `,`, such as 1,5.',
		)
	})

	test('a stored formula is read in the stored form, whatever the locale of its text was', () => {
		expect(() => compileRowFormula('=[price]*1,5', columns)).toThrow('`,` cannot stand')
		expect(compileRowFormula('=ROUND([price]*1.5, 1)', columns)(LINE)).toBe(3.8)
	})

	test('a text that a formula turns into a number reads `.` in every locale', () => {
		const row = { ...LINE, digits: '1.5' }
		expect(run('=[digits]*2', 'fi-FI', row)).toBe(3)
		expect(run('=[digits]*2', 'fi-FI', { ...row, digits: '1,5' })).toBe('#VALUE!')
	})

	test('a name with signs that brackets give a meaning is written with `\\`', () => {
		const odd: ColumnDef<Record<string, number>>[] = [
			{ id: 'a]b', header: 'Cost ($)' },
			{ id: 'x@y\\z', header: 'Odd' },
			{ id: '*' },
		]
		const parsed = parseFormula('=[Cost (\\$)]+[x\\@y\\\\z]+[\\*]', { columns: odd })
		expect(parsed).toEqual({ formula: '=[a\\]b]+[x\\@y\\\\z]+[\\*]' })
		const stored = 'formula' in parsed ? parsed.formula : ''
		expect(printFormula(stored, { columns: odd })).toBe('=[Cost (\\$)]+[Odd]+[\\*]')
		expect(compileRowFormula(stored, odd)({ 'a]b': 1, 'x@y\\z': 2, '*': 3 })).toBe(6)
	})
})

describe('a column of a formula', () => {
	test('computes each row once, and again for a new row object', () => {
		let reads = 0
		const counted: ColumnDef<Line>[] = [
			{
				id: 'price',
				value: (row) => {
					reads++
					return row.price
				},
			},
			{ id: 'qty' },
		]
		const total = formulaColumn(
			{ id: 'total', header: 'Total', formula: '=[price]*[qty]' },
			counted,
		)
		expect(total).toMatchObject({ id: 'total', header: 'Total', editable: false })
		const row = { ...LINE }
		expect(total.value?.(row)).toBe(10)
		expect(total.value?.(row)).toBe(10)
		expect(reads).toBe(1)
		expect(total.value?.({ ...row, qty: 2 })).toBe(5)
		expect(reads).toBe(2)
	})

	test('reads another column of a formula', () => {
		const total = formulaColumn({ id: 'total', formula: '=[price]*[qty]' }, columns)
		const band = formulaColumn(
			{ id: 'band', formula: '=IFS([total]<5, "small", [total]<50, "medium", TRUE, "large")' },
			[...columns, total],
		)
		expect(band.value?.(LINE)).toBe('medium')
	})

	test('throws with the words of the issue, and a formula that reads its own column is refused', () => {
		expect(() => formulaColumn({ id: 'total', formula: '=[Pric]*2' }, columns)).toThrow(
			'The formula "=[Pric]*2" of column "total" cannot be read: No column `Pric`. Columns: Price,',
		)
		expect(() => formulaColumn({ id: 'price', formula: '=[price]*2' }, columns)).toThrow(
			'The formula of column `price` reads that column itself.',
		)
	})

	test('reads nothing of a row but the columns that it names', () => {
		const row = Object.create({ secret: 1 }) as Line
		Object.assign(row, LINE)
		expect(() => parseFormula('=[secret]', { columns })).not.toThrow()
		expect(parseFormula('=[secret]', { columns })).toMatchObject({
			issues: [{ code: 'unknownColumn' }],
		})
		expect(parseFormula('=[constructor]', { columns })).toMatchObject({
			issues: [{ code: 'unknownColumn' }],
		})
	})
})
