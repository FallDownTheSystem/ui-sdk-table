import { mount } from '@ui-sdk/core/testing'
import SSF from 'ssf'
import { describe, expect, test } from 'vite-plus/test'
import { toXlsx } from '../export'
import type { ColumnDef } from '../rows'
import { table, type TableOptions } from '../table'
import { createFormulaEngine, excelFormulas, formulaColumn } from './index'

type Line = {
	id: string
	item: string
	price: number
	qty: number
	total?: unknown
	note?: unknown
}

const rows = (): Line[] => [
	{ id: 'a', item: 'Bolt', price: 2.5, qty: 4, total: 10 },
	{ id: 'b', item: 'Nut', price: 0.5, qty: 9, total: 4.5 },
	{ id: 'c', item: 'Washer', price: 4, qty: 1, total: 4 },
]

const columns: ColumnDef<Line>[] = [
	{ id: 'item', header: 'Item' },
	{ id: 'price', header: 'Price', sortable: true },
	{ id: 'qty', header: 'Quantity' },
	{ id: 'total', header: 'Total' },
	{ id: 'note', header: 'Note' },
]

// The table computes nothing at the mount, so the rows hold the results of their formulas.
function setup(
	cells: Record<string, Record<string, string>>,
	more: Partial<TableOptions> = {},
	values: Record<string, Partial<Line>> = {},
) {
	return mount(
		table,
		{
			rows: rows().map((row) => ({ ...row, ...values[row.id] })),
			columns,
			formulas: createFormulaEngine(),
			defaultCellFormulas: { cells },
			...more,
		} as TableOptions,
		'<root aria-label="Lines"></root>',
	)
}

/** The files of an archive whose files are stored as they are. */
function unzip(bytes: Uint8Array): Map<string, string> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const decoder = new TextDecoder()
	const files = new Map<string, string>()
	const end = bytes.length - 22
	let at = view.getUint32(end + 16, true)
	for (let index = 0; index < view.getUint16(end + 10, true); index++) {
		const size = view.getUint32(at + 20, true)
		const nameLength = view.getUint16(at + 28, true)
		const local = view.getUint32(at + 42, true)
		const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength))
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
		files.set(name, decoder.decode(bytes.subarray(start, start + size)))
		at += 46 + nameLength
	}
	return files
}

type Cell = { type: string; formula?: string; value: string; style: number }

/** The cells of the sheet by their address. */
async function cellsOf(
	view: ReturnType<typeof setup>,
	formula = true,
	exportOptions = {},
): Promise<Map<string, Cell>> {
	const bytes = await toXlsx(view.api.exportData(exportOptions), {
		compress: false,
		...(formula ? { formula: excelFormulas() } : {}),
	})
	const sheet = unzip(bytes).get('xl/worksheets/sheet1.xml') ?? ''
	const cells = new Map<string, Cell>()
	for (const match of sheet.matchAll(
		/<c r="([A-Z]+\d+)"(?: s="(\d+)")?(?: t="(\w+)")?>(?:<f>([^<]*)<\/f>)?(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)?<\/c>/g,
	)) {
		const found: Cell = {
			type: match[3] ?? 'n',
			value: match[5] ?? match[6] ?? '',
			style: Number(match[2] ?? 0),
		}
		if (match[4] !== undefined)
			found.formula = match[4]
				.replace(/&quot;/g, '"')
				.replace(/&gt;/g, '>')
				.replace(/&lt;/g, '<')
				.replace(/&amp;/g, '&')
		cells.set(match[1] ?? '', found)
	}
	return cells
}

describe('an Excel file with formulas', () => {
	test('a formula of its own row is a formula of the file, with its result beside it', async () => {
		const view = setup({ a: { total: '=[price]*[qty]' }, b: { total: '=ROUND([price]*[qty], 0)' } })
		try {
			const cells = await cellsOf(view)
			// The columns of the file are A to E and its rows start at 2, under the header.
			expect(cells.get('D2')).toEqual({ type: 'n', formula: 'B2*C2', value: '10', style: 0 })
			expect(cells.get('D3')?.formula).toBe('ROUND(B3*C3,0)')
			expect(cells.get('D3')?.value).toBe('4.5')
			expect(cells.get('D4')?.formula).toBeUndefined()
		} finally {
			view.unmount()
		}
	})

	test('a file without the option is the same bytes as a table without formulas', async () => {
		const plain = mount(
			table,
			{ rows: rows(), columns } as TableOptions,
			'<root aria-label="Lines"></root>',
		)
		const withFormulas = setup({ a: { total: '=[price]*[qty]' } })
		try {
			const before = await toXlsx(plain.api.exportData(), { compress: false })
			const after = await toXlsx(withFormulas.api.exportData(), { compress: false })
			expect(after).toEqual(before)
		} finally {
			plain.unmount()
			withFormulas.unmount()
		}
	})

	test('a reference to another row names its place in the file, also after a sort', async () => {
		const view = setup(
			{ c: { note: '=[total@a]+[$price@$b]' } },
			{ defaultSort: [{ id: 'price', desc: true }] },
		)
		try {
			// Sorted by price: c (4), a (2.5), b (0.5) in the rows 2, 3 and 4.
			const cells = await cellsOf(view)
			expect(cells.get('A2')?.value).toBe('Washer')
			expect(cells.get('E2')?.formula).toBe('D3+$B$4')
		} finally {
			view.unmount()
		}
	})

	test('a range goes over when its rows are next to each other in the file, in the order of the document', async () => {
		const sum = { c: { note: '=SUM([price@a]:[price@c])' } }
		const inOrder = setup(sum, {}, { c: { note: 7 } })
		const sorted = setup(sum, { defaultSort: [{ id: 'price', desc: true }] }, { c: { note: 7 } })
		try {
			expect((await cellsOf(inOrder)).get('E4')?.formula).toBe('SUM(B2:B4)')
			// After a sort the cells B2 to B4 of the file are other rows than the range.
			const cells = await cellsOf(sorted)
			expect(cells.get('E2')?.formula).toBeUndefined()
			expect(cells.get('E2')?.value).toBe('7')
		} finally {
			inOrder.unmount()
			sorted.unmount()
		}
	})

	test('a whole column is the rows of the file when the file holds every row in order', async () => {
		const view = setup({ a: { note: '=SUM([qty@*])' } }, {}, { a: { note: 14 } })
		try {
			const cells = await cellsOf(view)
			expect(cells.get('E2')?.formula).toBe('SUM(C2:C4)')
			expect(cells.get('E2')?.value).toBe('14')
		} finally {
			view.unmount()
		}
	})

	test('a cell that the file does not hold, or holds as another value, keeps the result', async () => {
		const view = setup(
			{ a: { note: '=[total@c]*2' }, b: { note: '=[price]+1' } },
			// Row c is not in the file.
			{ defaultFilter: { search: 't' } },
			{ a: { note: 8 }, b: { note: 1.5 } },
		)
		try {
			const cells = await cellsOf(view, true, { columns: ['item', 'price', 'note'] })
			expect(cells.get('C2')?.formula).toBeUndefined()
			expect(cells.get('C2')?.value).toBe('8')
			expect(cells.get('C3')?.formula).toBe('B3+1')
		} finally {
			view.unmount()
		}
		// A column that the file does not hold.
		const without = setup({ a: { note: '=[price]*[qty]' } }, {}, { a: { note: 10 } })
		try {
			const cells = await cellsOf(without, true, { columns: ['item', 'price', 'note'] })
			expect(cells.get('C2')?.formula).toBeUndefined()
			expect(cells.get('C2')?.value).toBe('10')
		} finally {
			without.unmount()
		}
	})

	test('a function that Excel has with the same meaning goes over, any other function is the result', async () => {
		const view = setup(
			{
				a: { note: '=IF([qty]>3, UPPER([item]), "few")' },
				b: { note: '=DATEADD("2026-01-31", 1, "month")' },
				c: { note: '=IFERROR(1/0, "none")&"!"' },
			},
			{},
			{ a: { note: 'BOLT' }, b: { note: '2026-02-28' }, c: { note: 'none!' } },
		)
		try {
			const cells = await cellsOf(view)
			expect(cells.get('E2')).toEqual({
				type: 'str',
				formula: 'IF(C2>3,UPPER(A2),"few")',
				value: 'BOLT',
				style: 0,
			})
			expect(cells.get('E3')?.formula).toBeUndefined()
			expect(cells.get('E4')?.formula).toBe('IFERROR(1/0,"none")&"!"')
		} finally {
			view.unmount()
		}
	})

	test('an error of a formula is an error of the file, and a formula that reads it passes it on', async () => {
		const view = setup(
			{ a: { total: '=[price]/0' }, b: { note: '=ISERROR([total@a])' } },
			{},
			{ a: { total: '#DIV/0!' }, b: { note: true } },
		)
		try {
			const cells = await cellsOf(view)
			expect(cells.get('D2')).toEqual({ type: 'e', formula: 'B2/0', value: '#DIV/0!', style: 0 })
			expect(cells.get('E3')?.formula).toBe('ISERROR(D2)')
			expect(cells.get('E3')?.type).toBe('b')
		} finally {
			view.unmount()
		}
	})

	test('a formula of a column is a formula in each row', async () => {
		const view = mount(
			table,
			{
				rows: rows(),
				columns,
				formulas: createFormulaEngine(),
				defaultCellFormulas: { columns: { note: '=[price]*[qty]' } },
			} as TableOptions,
			'<root aria-label="Lines"></root>',
		)
		try {
			const cells = await cellsOf(view)
			expect(['E2', 'E3', 'E4'].map((at) => cells.get(at)?.formula)).toEqual([
				'B2*C2',
				'B3*C3',
				'B4*C4',
			])
		} finally {
			view.unmount()
		}
	})
})

describe('a period in an Excel file', () => {
	type Order = { id: string; created: Date }
	const created: ColumnDef<Order> = {
		id: 'created',
		header: 'Created',
		format: 'datetime',
		formatOptions: { timeZone: 'Europe/Helsinki' },
	}
	const of = (formula: string) => formulaColumn({ id: 'period', formula }, [created])
	const sheetOf = async (formula: string, locale: string) => {
		const view = mount(
			table,
			{
				rows: [{ id: 'a', created: new Date('2026-11-21T12:05:00Z') }],
				columns: [of(formula)],
				locale,
			} as TableOptions,
			'<root aria-label="Orders"></root>',
		)
		try {
			const data = view.api.exportData()
			const files = unzip(await toXlsx(data, { compress: false }))
			const sheet = files.get('xl/worksheets/sheet1.xml') ?? ''
			const styles = files.get('xl/styles.xml') ?? ''
			const cell =
				/<c r="A2"(?: s="(\d+)")?(?: t="(\w+)")?>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*))/.exec(
					sheet,
				)
			const xf = [
				...(/<cellXfs[^>]*>(.*)<\/cellXfs>/.exec(styles)?.[1] ?? '').matchAll(/numFmtId="(\d+)"/g),
			][Number(cell?.[1] ?? 0)]?.[1]
			const pattern = new RegExp(`numFmtId="${xf}" formatCode="([^"]*)"`)
				.exec(styles)?.[1]
				?.replace(/&quot;/g, '"')
			return {
				type: cell?.[2] ?? 'n',
				value: cell?.[3] ?? cell?.[4] ?? '',
				pattern,
				screen: data.rows[0]?.cells[0]?.text ?? '',
			}
		} finally {
			view.unmount()
		}
	}

	// The pattern of the file, read by a reader of patterns, gives the text of the screen.
	test.each([
		['=DAYOF([created])', 'en-US'],
		['=MONTHOF([created])', 'en-US'],
		['=YEAROF([created])', 'en-US'],
		['=MONTHOF([created])', 'en-GB'],
	])(
		'%s in %s is a date cell whose pattern shows the text of the screen',
		async (formula, locale) => {
			const cell = await sheetOf(formula, locale)
			expect(cell.type).toBe('n')
			expect(cell.pattern).toBeDefined()
			expect(SSF.format(cell.pattern ?? '', Number(cell.value))).toBe(cell.screen)
		},
	)

	test.each([
		['=WEEKOF([created], 2)', 'en-US'],
		['=QUARTEROF([created])', 'en-US'],
		// The name of a month of another language is no name that a spreadsheet writes.
		['=MONTHOF([created])', 'fi-FI'],
	])('%s in %s is the text of the screen', async (formula, locale) => {
		const cell = await sheetOf(formula, locale)
		expect(cell.type).toBe('inlineStr')
		expect(cell.value).toBe(cell.screen)
	})
})
