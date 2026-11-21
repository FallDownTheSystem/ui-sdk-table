import { mount } from '@ui-sdk/core/testing'
import SSF from 'ssf'
import { describe, expect, test } from 'vite-plus/test'
import { isNumericFormat } from '../format'
import type { ColumnDef } from '../rows'
import { table, type TableOptions } from '../table'
import { toCsv } from './csv'
import type { ExportData } from './data'
import { toXlsx } from './xlsx'
import { zip } from './zip'

type Sale = {
	id: string
	name: string
	team: string
	units: number | null
	price: number | null
	share: number | null
	day: string | null
	seen: string | Date | null
	active: boolean | null
	children?: Sale[]
}

const sales = (): Sale[] => [
	{
		id: 'a',
		name: 'Aino',
		team: 'Design',
		units: 12,
		price: 1234.5,
		// Not a value such as 0.285: times 100 that is 28.499999999999996 in binary, and the reader
		// of this test rounds that down, where Intl and a spreadsheet round the decimal number up.
		share: 0.2812,
		day: '2026-11-21',
		seen: '2026-11-21T22:30:00Z',
		active: true,
	},
	{
		id: 'b',
		name: 'Eero',
		team: 'Platform',
		units: -3,
		price: -99.999,
		share: 1.5,
		day: '2024-02-29',
		seen: new Date(Date.UTC(2026, 5, 1, 0, 0, 0)),
		active: false,
	},
	{
		id: 'c',
		name: 'Helmi',
		team: 'Design',
		units: 1500,
		price: 0,
		share: 0.5,
		day: '2025-07-04',
		seen: '2025-07-04T09:05:00Z',
		active: true,
	},
	{
		id: 'd',
		name: 'Onni',
		team: 'Platform',
		units: null,
		price: null,
		share: null,
		day: null,
		seen: null,
		active: null,
	},
]

const columns: ColumnDef<Sale>[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'team', header: 'Team' },
	{ id: 'units', header: 'Units', format: 'integer', aggregate: 'sum' },
	{ id: 'price', header: 'Price', format: 'decimal', aggregate: 'sum' },
]

function setup(options: Partial<TableOptions<Sale>> = {}) {
	const rows = sales()
	const view = mount(
		table,
		{ rows, columns, ...options } as TableOptions,
		'<root aria-label="Sales"></root>',
	)
	return { view, rows }
}

const texts = (data: ExportData) => data.rows.map((row) => row.cells.map((cell) => cell.text))
const names = (data: ExportData) => data.rows.map((row) => row.cells[0]?.text)

describe('the cells of an export', () => {
	test('by default: every row that passes the filters, on all pages, in the order of the screen', () => {
		const { view } = setup({
			defaultSort: [{ id: 'name', desc: true }],
			defaultFilter: { columns: { team: 'Design' } },
			defaultPage: { page: 1, pageSize: 1 },
		})
		try {
			const data = view.api.exportData()
			expect(data.columns.map((column) => column.header)).toEqual([
				'Name',
				'Team',
				'Units',
				'Price',
			])
			// The page holds one row. The export holds both rows of the team, sorted.
			expect(view.api.rows()).toHaveLength(1)
			expect(texts(data)).toEqual([
				['Helmi', 'Design', '1,500', '0.00'],
				['Aino', 'Design', '12', '1,234.50'],
			])
			expect(data.rows[1]?.cells[3]?.value).toBe(1234.5)
			expect(names(view.api.exportData({ rows: 'page' }))).toEqual(['Helmi'])
			// Every row of the data, in the order of the data.
			expect(names(view.api.exportData({ rows: 'all' }))).toEqual(['Aino', 'Eero', 'Helmi', 'Onni'])
		} finally {
			view.unmount()
		}
	})

	test('the selected rows, also the ones that the filter hides', () => {
		const { view } = setup({
			selection: 'multiple',
			defaultSelected: ['d', 'a'],
			defaultFilter: { search: 'Aino' },
		})
		try {
			expect(names(view.api.exportData({ rows: 'selected' }))).toEqual(['Aino', 'Onni'])
		} finally {
			view.unmount()
		}
	})

	test('the columns of the screen in their order, all columns, or a list', () => {
		const { view } = setup({
			defaultColumnOrder: ['price', 'name'],
			defaultColumnVisibility: { team: false },
		})
		try {
			const ids = (data: ExportData) => data.columns.map((column) => column.id)
			expect(ids(view.api.exportData())).toEqual(['price', 'name', 'units'])
			expect(ids(view.api.exportData({ columns: 'all' }))).toEqual([
				'price',
				'name',
				'units',
				'team',
			])
			expect(ids(view.api.exportData({ columns: ['team', 'name'] }))).toEqual(['team', 'name'])
			expect(() => view.api.exportData({ columns: ['nope'] })).toThrow(
				'No column "nope" to export. Columns: price, name, units, team.',
			)
			expect(() => view.api.exportData({ rows: 'some' as 'all' })).toThrow(
				'`rows` of an export is one of: filtered, page, all, selected.',
			)
		} finally {
			view.unmount()
		}
	})

	test('a column can stay out, and can give another value to the file', () => {
		const { view } = setup({
			columns: [
				{ id: 'name', header: 'Name', exportValue: (row) => row.name.toUpperCase() },
				{ id: 'actions', header: 'Actions', exportable: false },
				{ id: 'units', header: 'Units', format: 'integer' },
			],
		})
		try {
			const data = view.api.exportData({ columns: 'all' })
			expect(data.columns.map((column) => column.id)).toEqual(['name', 'units'])
			expect(data.rows[0]?.cells[0]).toEqual({ value: 'AINO', text: 'AINO' })
		} finally {
			view.unmount()
		}
	})

	test('group rows and a totals row, when asked for', () => {
		const { view } = setup({ defaultGroupBy: ['team'] })
		try {
			// Without the option: the rows in the order of their groups, also of the closed ones.
			expect(names(view.api.exportData())).toEqual(['Aino', 'Helmi', 'Eero', 'Onni'])
			const data = view.api.exportData({ groups: true, totals: true })
			expect(data.rows.map((row) => [row.kind, row.level, ...row.cells.map((cell) => cell.text)]))
				// prettier-ignore
				.toEqual([
					['group', 0, 'Design (2)', '', '1,512', '1,234.50'],
					['row', 1, 'Aino', 'Design', '12', '1,234.50'],
					['row', 1, 'Helmi', 'Design', '1,500', '0.00'],
					['group', 0, 'Platform (2)', '', '-3', '-100.00'],
					['row', 1, 'Eero', 'Platform', '-3', '-100.00'],
					['row', 1, 'Onni', 'Platform', '', ''],
					['total', 0, '', '', '1,509', '1,134.50'],
				])
		} finally {
			view.unmount()
		}
	})

	test('child rows come with their row, open or not; pinned rows are at their edge', () => {
		const rows = sales()
		const [first, second, third, fourth] = rows
		if (!first || !second || !third || !fourth) throw new Error('four rows')
		first.children = [second]
		const view = mount(
			table,
			{
				rows: [first, third, fourth],
				columns,
				getChildren: (row: Sale) => row.children,
				defaultRowPinning: { bottom: ['c'] },
			} as TableOptions,
			'<root aria-label="Sales"></root>',
		)
		try {
			const data = view.api.exportData()
			expect(data.rows.map((row) => [row.cells[0]?.text, row.level])).toEqual([
				['Aino', 0],
				['Eero', 1],
				['Onni', 0],
				['Helmi', 0],
			])
			expect(names(view.api.exportData({ children: false }))).toEqual(['Aino', 'Onni', 'Helmi'])
		} finally {
			view.unmount()
		}
	})
})

describe('CSV', () => {
	const data = (rows: [unknown, string][][], headers = ['A', 'B']): ExportData => ({
		columns: headers.map((header) => ({ id: header, header, column: { id: header } })),
		rows: rows.map((cells) => ({
			kind: 'row',
			level: 0,
			cells: cells.map(([value, text]) => ({ value, text })),
		})),
		locale: undefined,
	})

	test('holds the text of the screen, with quotes where a reader needs them', () => {
		const { view } = setup()
		try {
			expect(toCsv(view.api.exportData(), { bom: false })).toBe(
				[
					'Name,Team,Units,Price',
					'Aino,Design,12,"1,234.50"',
					'Eero,Platform,-3,-100.00',
					'Helmi,Design,"1,500",0.00',
					'Onni,Platform,,',
					'',
				].join('\r\n'),
			)
		} finally {
			view.unmount()
		}
	})

	test('quotes, line breaks, the separator and spaces at the ends', () => {
		const csv = toCsv(
			data([
				[
					['', 'He said "no"'],
					['', 'two\nlines'],
				],
				[
					['', ' padded '],
					['', 'a;b'],
				],
			]),
			{ bom: false, separator: ';', lineEnd: '\n' },
		)
		expect(csv).toBe('A;B\n"He said ""no""";"two\nlines"\n" padded ";"a;b"\n')
	})

	test('starts with a byte order mark, unless told otherwise, and can leave the header out', () => {
		const one = data([[['x', 'x']]], ['A'])
		expect(toCsv(one)).toBe('\uFEFFA\r\nx\r\n')
		expect(toCsv(one, { bom: false, header: false })).toBe('x\r\n')
	})

	test('a text that reads as a formula gets a quote before it; a number does not', () => {
		const csv = toCsv(
			data([
				[
					['=SUM(A1)', '=SUM(A1)'],
					['@cmd', '@cmd'],
				],
				[
					[-5, '-5'],
					['-5.50', '-5.50'],
				],
				[
					['+358 40 123', '+358 40 123'],
					['-x', '-x'],
				],
			]),
			{ bom: false },
		)
		expect(csv).toBe("A,B\r\n'=SUM(A1),'@cmd\r\n-5,-5.50\r\n+358 40 123,'-x\r\n")
		expect(toCsv(data([[['=1+1', '=1+1']]], ['A']), { bom: false, escapeFormulas: false })).toBe(
			'A\r\n=1+1\r\n',
		)
	})

	test('a no-break space of a number format becomes a plain space', () => {
		const csv = toCsv(data([[[1234.5, '1\u202F234,50\u00A0€']]], ['A']), { bom: false })
		expect(csv).toBe('A\r\n"1 234,50 €"\r\n')
	})
})

/** The files of an archive whose files are stored as they are. */
function unzip(bytes: Uint8Array): Map<string, string> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const decoder = new TextDecoder()
	const files = new Map<string, string>()
	const end = bytes.length - 22
	expect(view.getUint32(end, true)).toBe(0x06054b50)
	let at = view.getUint32(end + 16, true)
	for (let index = 0; index < view.getUint16(end + 10, true); index++) {
		expect(view.getUint32(at, true)).toBe(0x02014b50)
		expect(view.getUint16(at + 10, true)).toBe(0)
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

type SheetCell = { type: string; value: string; pattern: string; bold: boolean }

/** The cells of the sheet by their place, with the pattern and the weight of their style. */
async function readSheet(data: ExportData): Promise<Map<string, SheetCell>> {
	const files = unzip(await toXlsx(data, { compress: false }))
	const styles = files.get('xl/styles.xml') ?? ''
	const patterns = new Map<string, string>()
	for (const match of styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"\/>/g)) {
		const unescaped = (match[2] ?? '')
			.replace(/&quot;/g, '"')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&')
		patterns.set(match[1] ?? '', unescaped)
	}
	const xfs = [
		...(/<cellXfs[^>]*>(.*)<\/cellXfs>/.exec(styles)?.[1] ?? '').matchAll(
			/<xf numFmtId="(\d+)" fontId="(\d+)"/g,
		),
	].map((match) => ({ pattern: patterns.get(match[1] ?? '') ?? '', bold: match[2] === '1' }))
	const cells = new Map<string, SheetCell>()
	const sheet = files.get('xl/worksheets/sheet1.xml') ?? ''
	for (const match of sheet.matchAll(
		/<c r="([A-Z]+\d+)"(?: s="(\d+)")?(?: t="(\w+)")?>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>/g,
	)) {
		const style = xfs[Number(match[2] ?? 0)]
		cells.set(match[1] ?? '', {
			type: match[3] ?? 'n',
			value: match[4] ?? match[5] ?? '',
			pattern: style?.pattern ?? '',
			bold: style?.bold ?? false,
		})
	}
	return cells
}

// A reader shows a no-break space as a space and writes the minus sign of the keyboard.
const plain = (text: string) =>
	text
		.replace(/[\u00A0\u202F]/g, ' ')
		.replace(/\u2212/g, '-')
		.trim()

// A spreadsheet writes the group and decimal signs of its own language. The
// reader of this test writes English, so the two signs are put into the
// language of the column before the texts are compared.
function inLanguage(text: string, locale: string | undefined): string {
	if (!locale) return text
	const parts = new Intl.NumberFormat(locale).formatToParts(1234.5)
	const sign = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
	return text.replace(/[.,]/g, (char) => (char === ',' ? sign('group') : sign('decimal')))
}

describe('Excel', () => {
	test('the file is an archive with the parts of a workbook', async () => {
		const { view } = setup()
		try {
			const files = unzip(
				await toXlsx(view.api.exportData(), { compress: false, sheetName: 'A/B' }),
			)
			expect([...files.keys()]).toEqual([
				'[Content_Types].xml',
				'_rels/.rels',
				'xl/workbook.xml',
				'xl/_rels/workbook.xml.rels',
				'xl/styles.xml',
				'xl/worksheets/sheet1.xml',
			])
			// A character that a sheet name cannot hold is taken out.
			expect(files.get('xl/workbook.xml')).toContain('<sheet name="A B" sheetId="1" r:id="rId1"/>')
			expect(files.get('xl/worksheets/sheet1.xml')).toContain('state="frozen"')
		} finally {
			view.unmount()
		}
	})

	test('numbers are numbers, texts are texts, the header is bold, an empty cell is left out', async () => {
		const { view } = setup()
		try {
			const cells = await readSheet(view.api.exportData({ totals: true }))
			expect(cells.get('A1')).toEqual({ type: 'inlineStr', value: 'Name', pattern: '', bold: true })
			expect(cells.get('A2')).toEqual({
				type: 'inlineStr',
				value: 'Aino',
				pattern: '',
				bold: false,
			})
			expect(cells.get('C2')).toEqual({ type: 'n', value: '12', pattern: '#,##0', bold: false })
			expect(cells.get('D3')).toEqual({
				type: 'n',
				value: '-99.999',
				pattern: '#,##0.00',
				bold: false,
			})
			// Row 5 is the row without numbers.
			expect(cells.has('C5')).toBe(false)
			expect(cells.get('C6')).toEqual({ type: 'n', value: '1509', pattern: '#,##0', bold: true })
		} finally {
			view.unmount()
		}
	})

	test('a text keeps the characters of markup and loses the ones a file cannot hold', async () => {
		const { view } = setup({
			rows: [{ ...sales()[0], id: 'x', name: 'A & <B> "c" \u0001=1+1' } as Sale],
		})
		try {
			const files = unzip(await toXlsx(view.api.exportData(), { compress: false }))
			expect(files.get('xl/worksheets/sheet1.xml')).toContain(
				'<t xml:space="preserve">A &amp; &lt;B&gt; &quot;c&quot; =1+1</t>',
			)
		} finally {
			view.unmount()
		}
	})

	// Each case is a column. A spreadsheet must show its cells as the screen does.
	const cases: ColumnDef<Sale>[] = [
		{ id: 'units', format: 'integer' },
		{ id: 'units-plain', key: 'units', format: 'integer', formatOptions: { useGrouping: false } },
		{ id: 'price', format: 'decimal' },
		{
			id: 'price-digits',
			key: 'price',
			format: 'decimal',
			formatOptions: { minimumFractionDigits: 1, maximumFractionDigits: 3, suffix: ' kWh' },
		},
		{
			id: 'price-floor',
			key: 'price',
			format: 'decimal',
			formatOptions: { maximumFractionDigits: 1, roundingMode: 'floor' },
		},
		{
			id: 'price-times',
			key: 'price',
			format: 'integer',
			formatOptions: { multiplier: 0.001, roundingMode: 'ceil', prefix: '~' },
		},
		{ id: 'eur', key: 'price', format: 'currency', formatOptions: { showUnit: true } },
		{
			id: 'eur-fi',
			key: 'price',
			format: 'currency',
			formatOptions: { showUnit: true, locale: 'fi-FI' },
		},
		{
			id: 'usd-accounting',
			key: 'price',
			format: 'currency',
			formatOptions: { showUnit: true, currency: 'USD', currencySign: 'accounting' },
		},
		{
			id: 'sek-code',
			key: 'price',
			format: 'currency',
			formatOptions: { showUnit: true, currency: 'SEK', currencyDisplay: 'code' },
		},
		{ id: 'amount', key: 'price', format: 'currency' },
		{ id: 'share', format: 'percentage', formatOptions: { showUnit: true } },
		{
			id: 'share-digits',
			key: 'share',
			format: 'percentage',
			formatOptions: { showUnit: true, maximumFractionDigits: 1 },
		},
		{ id: 'share-number', key: 'share', format: 'percentage' },
		{
			id: 'units-percent',
			key: 'units',
			format: 'percentage',
			formatOptions: { showUnit: true, scale: 'percent' },
		},
		{ id: 'day', format: 'date' },
		{ id: 'day-short', key: 'day', format: 'date', formatOptions: { dateStyle: 'short' } },
		{ id: 'day-full', key: 'day', format: 'date', formatOptions: { dateStyle: 'full' } },
		{
			id: 'day-fields',
			key: 'day',
			format: 'date',
			formatOptions: { year: '2-digit', month: '2-digit', day: '2-digit' },
		},
		{ id: 'day-fi', key: 'day', format: 'date', formatOptions: { locale: 'fi-FI' } },
		{ id: 'seen-utc', key: 'seen', format: 'datetime', formatOptions: { timeZone: 'UTC' } },
		{
			id: 'seen-helsinki',
			key: 'seen',
			format: 'datetime',
			formatOptions: { timeZone: 'Europe/Helsinki' },
		},
		{
			id: 'seen-fi',
			key: 'seen',
			format: 'datetime',
			formatOptions: { timeZone: 'Europe/Helsinki', locale: 'fi-FI' },
		},
		{
			id: 'seen-24',
			key: 'seen',
			format: 'datetime',
			formatOptions: { timeZone: 'America/New_York', hour12: false, dateStyle: 'short' },
		},
		{
			id: 'seen-time',
			key: 'seen',
			format: 'time',
			formatOptions: { timeZone: 'Asia/Tokyo', timeStyle: 'medium' },
		},
	]

	test('a number, an amount, a percentage and a date read in a spreadsheet as on the screen', async () => {
		const { view } = setup({ columns: cases })
		try {
			const data = view.api.exportData()
			const cells = await readSheet(data)
			// For each cell: what a spreadsheet shows, next to what the screen shows.
			const seen: string[] = []
			const screen: string[] = []
			data.rows.forEach((row, rowIndex) => {
				row.cells.forEach((cell, index) => {
					const column = data.columns[index]?.column
					const ref = `${String.fromCharCode(65 + index)}${rowIndex + 2}`
					const written = cells.get(ref)
					const numeric = !!column?.format && isNumericFormat(column.format)
					// Every cell with a value has a type and a pattern. None falls back to text.
					const shown =
						written?.type === 'n'
							? SSF.format(written.pattern, Number(written.value))
							: `${written?.type}:${written?.value}`
					screen.push(`${column?.id} ${ref}: ${cell.text === '' ? 'no cell' : plain(cell.text)}`)
					seen.push(
						`${column?.id} ${ref}: ${
							written
								? plain(numeric ? inLanguage(shown, column?.formatOptions?.locale) : shown)
								: 'no cell'
						}`,
					)
				})
			})
			expect(seen).toEqual(screen)
			// Three rows have values, and the fourth has none.
			expect(screen.filter((line) => !line.endsWith('no cell'))).toHaveLength(cases.length * 3)
			expect(screen.filter((line) => line.endsWith('no cell'))).toHaveLength(cases.length)
		} finally {
			view.unmount()
		}
	})

	test('a unit keeps its side of the number, with the space of the language', async () => {
		const { view } = setup({
			columns: [
				{
					id: 'share-de',
					key: 'share',
					format: 'percentage',
					formatOptions: { showUnit: true, locale: 'de-DE', minimumFractionDigits: 1 },
				},
				{
					id: 'eur-de',
					key: 'price',
					format: 'currency',
					formatOptions: { showUnit: true, locale: 'de-DE' },
				},
				{
					id: 'eur-quote',
					key: 'price',
					format: 'decimal',
					formatOptions: { suffix: ' "net"' },
				},
			],
		})
		try {
			const data = view.api.exportData()
			const cells = await readSheet(data)
			expect(plain(data.rows[0]?.cells[0]?.text ?? '')).toBe('28,1 %')
			expect(cells.get('A2')).toEqual({
				type: 'n',
				value: '0.2812',
				pattern: '#,##0.0 %',
				bold: false,
			})
			expect(cells.get('B2')?.pattern).toBe('#,##0.00"\u00a0€"')
			// A quote cannot be inside a quoted text, so each character is escaped.
			expect(cells.get('C2')?.pattern).toBe('#,##0.00\\ \\"\\n\\e\\t\\"')
		} finally {
			view.unmount()
		}
	})

	test('a value that no pattern can show is the text of the screen', async () => {
		const { view } = setup({
			columns: [
				{ id: 'compact', key: 'price', format: 'decimal', formatOptions: { notation: 'compact' } },
				{
					id: 'zone',
					key: 'seen',
					format: 'datetime',
					formatOptions: {
						timeZone: 'UTC',
						timeZoneName: 'short',
						year: 'numeric',
						month: 'short',
						day: 'numeric',
						hour: 'numeric',
						minute: '2-digit',
					},
				},
				{ id: 'active', format: 'boolean' },
				{
					id: 'ago',
					key: 'seen',
					format: 'relativeTime',
					formatOptions: { now: Date.UTC(2026, 10, 22, 0, 30), unit: 'hour' },
				},
				{ id: 'units', format: 'integer', formatOptions: { nullValue: 'n/a' } },
				{ id: 'name', format: 'integer', formatOptions: { invalidValue: 'bad' } },
			],
		})
		try {
			const data = view.api.exportData()
			const cells = await readSheet(data)
			const row = (number: number) =>
				['A', 'B', 'C', 'D', 'E', 'F'].map((letter) => {
					const cell = cells.get(`${letter}${number}`)
					return cell ? `${cell.type}:${cell.value}` : undefined
				})
			const screen = (index: number) =>
				data.rows[index]?.cells.map((cell) => (cell.text ? `inlineStr:${cell.text}` : undefined))
			expect(texts(data)[0]?.map(plain)).toEqual([
				'1.23K',
				'Nov 21, 2026, 10:30 PM UTC',
				'Yes',
				'2 hours ago',
				'12',
				'bad',
			])
			expect(row(2)).toEqual([...(screen(0) ?? []).slice(0, 4), 'n:12', 'inlineStr:bad'])
			// The row without values: the texts for a missing value, and no cell where there is none.
			expect(row(5)).toEqual([
				undefined,
				undefined,
				undefined,
				undefined,
				'inlineStr:n/a',
				'inlineStr:bad',
			])
		} finally {
			view.unmount()
		}
	})

	test('a column without a format keeps the type of each value', async () => {
		const { view } = setup({
			columns: [
				{ id: 'units' },
				{ id: 'active' },
				{ id: 'seen' },
				{ id: 'big', exportValue: (row) => (row.units ?? 0) * 1000 },
			],
		})
		try {
			const cells = await readSheet(view.api.exportData())
			expect(cells.get('A2')).toEqual({ type: 'n', value: '12', pattern: '', bold: false })
			expect(cells.get('B2')).toEqual({ type: 'b', value: '1', pattern: '', bold: false })
			expect(cells.get('B3')).toEqual({ type: 'b', value: '0', pattern: '', bold: false })
			// A text stays a text, and a date object is a date in UTC, as its text on the screen.
			expect(cells.get('C2')?.type).toBe('inlineStr')
			const date = cells.get('C3')
			expect(date?.pattern).toBe('yyyy-mm-dd hh:mm:ss')
			expect(SSF.format(date?.pattern ?? '', Number(date?.value))).toBe('2026-06-01 00:00:00')
			expect(cells.get('D2')).toEqual({ type: 'n', value: '12000', pattern: '', bold: false })
		} finally {
			view.unmount()
		}
	})
})

describe('the archive', () => {
	test('each file has its length and its check sum', async () => {
		const encoder = new TextEncoder()
		const bytes = await zip([{ name: 'a.txt', data: encoder.encode('123456789') }], false)
		const view = new DataView(bytes.buffer)
		// The check sum of "123456789" is the test value of CRC-32.
		expect(view.getUint32(14, true)).toBe(0xcbf43926)
		expect(view.getUint32(18, true)).toBe(9)
		expect(unzip(bytes).get('a.txt')).toBe('123456789')
	})
})

describe('edges of an export', () => {
	test('a group row keeps its name when the first column has a total', () => {
		const first = setup({
			columns: [columns[2], columns[0], columns[1]].filter((column) => !!column),
			defaultGroupBy: ['team'],
		})
		try {
			const data = first.view.api.exportData({ groups: true })
			const groups = data.rows.filter((row) => row.kind === 'group')
			expect(groups.map((row) => row.cells.map((cell) => cell.text))).toEqual([
				['1,512', 'Design (2)', ''],
				['-3', 'Platform (2)', ''],
			])
			expect(groups.map((row) => row.label)).toEqual(['Design (2)', 'Platform (2)'])
		} finally {
			first.view.unmount()
		}
		// Every column has a total: the name shares the first cell with the total.
		const full = setup({
			columns: [columns[2], columns[3], columns[1]].filter((column) => !!column),
			defaultColumnVisibility: { team: false },
			defaultGroupBy: ['team'],
		})
		try {
			const data = full.view.api.exportData({ groups: true })
			expect(data.rows[0]?.cells.map((cell) => cell.text)).toEqual([
				'Design (2): 1,512',
				'1,234.50',
			])
		} finally {
			full.view.unmount()
		}
	})

	test('the totals row is of the rows in the file for the selected rows and for all rows', () => {
		const { view } = setup({
			selection: 'multiple',
			defaultSelected: ['a', 'b'],
			defaultFilter: { search: 'Design' },
		})
		try {
			const last = (data: ExportData) => data.rows.at(-1)?.cells.map((cell) => cell.text)
			// The footer on the screen: the rows that pass the filter.
			expect(last(view.api.exportData({ totals: true }))).toEqual(['', '', '1,512', '1,234.50'])
			expect(last(view.api.exportData({ rows: 'page', totals: true }))).toEqual([
				'',
				'',
				'1,512',
				'1,234.50',
			])
			expect(last(view.api.exportData({ rows: 'selected', totals: true }))).toEqual([
				'',
				'',
				'9',
				'1,134.50',
			])
			expect(last(view.api.exportData({ rows: 'all', totals: true }))).toEqual([
				'',
				'',
				'1,509',
				'1,134.50',
			])
		} finally {
			view.unmount()
		}
	})

	test('a column with `exportValue` has totals of those values, in group rows too', async () => {
		const { view } = setup({
			columns: [
				{ id: 'name', header: 'Name' },
				{ id: 'team', header: 'Team' },
				{
					id: 'cents',
					key: 'price',
					header: 'Cents',
					format: 'decimal',
					aggregate: 'mean',
					exportValue: (row) => (row.price === null ? null : Math.round(row.price * 100)),
				},
			],
			defaultGroupBy: ['team'],
		})
		try {
			const data = view.api.exportData({ groups: true, totals: true })
			expect(data.rows.map((row) => row.cells[2]?.value)).toEqual([
				61725,
				123450,
				0,
				-10000,
				-10000,
				null,
				37816.666666666664,
			])
			const cells = await readSheet(data)
			expect(cells.get('C2')).toEqual({ type: 'n', value: '61725', pattern: '', bold: true })
		} finally {
			view.unmount()
		}
	})

	test('child rows come with their row, open or not', () => {
		const rows = sales()
		const [first, second, third] = rows
		if (!first || !second || !third) throw new Error('three rows')
		first.children = [second]
		for (const expanded of [[], ['a']]) {
			const view = mount(
				table,
				{
					rows: [first, third],
					columns,
					getChildren: (row: Sale) => row.children,
					defaultExpanded: expanded,
				} as TableOptions,
				'<root aria-label="Sales"></root>',
			)
			try {
				expect(view.api.rows()).toHaveLength(expanded.length ? 3 : 2)
				expect(names(view.api.exportData())).toEqual(['Aino', 'Eero', 'Helmi'])
			} finally {
				view.unmount()
			}
		}
	})

	test('`exportData` says what its options are when it gets another thing', () => {
		const { view } = setup()
		try {
			const call = view.api.exportData as (options: unknown) => ExportData
			expect(() => call(null)).toThrow(
				'`exportData` takes an object with the options rows, columns, children, groups, totals.',
			)
			expect(() => call('csv')).toThrow('`exportData` takes an object with the options')
			expect(() => call({ format: 'csv' })).toThrow(
				'An export has no option "format". Its options: rows, columns, children, groups, totals.',
			)
		} finally {
			view.unmount()
		}
	})
})

describe('edges of CSV', () => {
	test('a negative amount that is a text of digits in the data gets no quote before it', () => {
		const { view } = setup({
			rows: [{ ...sales()[0], id: 'x', price: '-5.5' as unknown as number, name: '-5.5' } as Sale],
			columns: [
				{ id: 'eur', key: 'price', format: 'currency', formatOptions: { showUnit: true } },
				{ id: 'kg', key: 'price', format: 'decimal', formatOptions: { suffix: ' kg' } },
				{ id: 'name' },
				{ id: 'calc', exportValue: () => '-5.5+cmd' },
			],
		})
		try {
			const lines = toCsv(view.api.exportData(), { bom: false, header: false }).split('\r\n')
			expect(lines[0]).toBe("-€5.50,-5.50 kg,-5.5,'-5.5+cmd")
		} finally {
			view.unmount()
		}
	})

	test('a no-break space that a person typed stays; the one of a format becomes a space', () => {
		const { view } = setup({
			rows: [{ ...sales()[0], id: 'x', name: 'Anna\u00a0Aalto' } as Sale],
			columns: [
				{ id: 'name' },
				{ id: 'price', format: 'decimal', formatOptions: { locale: 'fi-FI' } },
			],
		})
		try {
			expect(toCsv(view.api.exportData(), { bom: false, header: false })).toBe(
				'Anna\u00a0Aalto,"1 234,50"\r\n',
			)
		} finally {
			view.unmount()
		}
	})
})

describe('edges of Excel', () => {
	/** What a spreadsheet shows for the first cell of each column, next to the screen. */
	async function firstRow(cases: ColumnDef<Sale>[], row: Partial<Sale> = {}) {
		const { view } = setup({ columns: cases, rows: [{ ...sales()[0], ...row } as Sale] })
		try {
			const data = view.api.exportData()
			const cells = await readSheet(data)
			return cases.map((column, index) => {
				const cell = cells.get(`${String.fromCharCode(65 + index)}2`)
				return {
					id: column.id,
					screen: plain(data.rows[0]?.cells[index]?.text ?? ''),
					file:
						cell?.type === 'n'
							? plain(SSF.format(cell.pattern, Number(cell.value)))
							: `text: ${plain(cell?.value ?? '')}`,
					type: cell?.type,
				}
			})
		} finally {
			view.unmount()
		}
	}

	test('the digits after the point are the digits of the screen, not the noise of binary numbers', async () => {
		const seen = await firstRow(
			[
				{ id: 'price', format: 'decimal', formatOptions: { maximumFractionDigits: 8 } },
				{
					id: 'units',
					format: 'decimal',
					formatOptions: { maximumFractionDigits: 15 },
				},
			],
			{ price: 1000000000.1, units: 1234.567 },
		)
		expect(seen.map((cell) => [cell.screen, cell.file])).toEqual([
			['1,000,000,000.10', '1,000,000,000.10'],
			['1,234.567', '1,234.567'],
		])
	})

	test('a cell whose words or digits a pattern would show in another way is the text of the screen', async () => {
		const seen = await firstRow(
			[
				// The name of a currency has a plural, and a pattern holds one text.
				{
					id: 'dollars',
					key: 'units',
					format: 'currency',
					formatOptions: {
						showUnit: true,
						currency: 'USD',
						currencyDisplay: 'name',
						maximumFractionDigits: 0,
					},
				},
				// A calendar with other years.
				{ id: 'thai', key: 'day', format: 'date', formatOptions: { locale: 'th-TH' } },
				// The names of months and days are in the language of the spreadsheet program.
				{
					id: 'finnish',
					key: 'day',
					format: 'date',
					formatOptions: { locale: 'fi-FI', dateStyle: 'long' },
				},
				{ id: 'june', key: 'seen', format: 'date', formatOptions: { locale: 'en-AU' } },
				{
					id: 'pm',
					key: 'seen',
					format: 'time',
					formatOptions: { locale: 'en-GB', hour12: true, timeZone: 'UTC' },
				},
				{
					id: 'japan',
					key: 'seen',
					format: 'time',
					formatOptions: { locale: 'ja-JP', hour12: true, timeZone: 'UTC' },
				},
				{
					id: 'narrow',
					key: 'day',
					format: 'date',
					formatOptions: { weekday: 'narrow', month: 'narrow', day: 'numeric' },
				},
				// Digits and groups that a pattern cannot say.
				{ id: 'arabic', key: 'price', format: 'decimal', formatOptions: { locale: 'ar-EG' } },
				{ id: 'lakh', key: 'price', format: 'decimal', formatOptions: { locale: 'en-IN' } },
			],
			{ units: 5, seen: '2026-06-01T12:30:00Z', price: 12345678.5 },
		)
		expect(seen.map((cell) => cell.type)).toEqual(seen.map(() => 'inlineStr'))
		for (const cell of seen) expect(cell.file).toBe(`text: ${cell.screen}`)
		expect(seen.map((cell) => cell.screen)).toEqual([
			'5 US dollars',
			'21 พ.ย. 2569',
			'21. marraskuuta 2026',
			'1 June 2026',
			'12:30 pm',
			'午後0:30',
			'S, N 21',
			'١٢٬٣٤٥٬٦٧٨٫٥٠',
			'1,23,45,678.50',
		])
	})

	test('English names of months and days, and AM and PM, are still a date in the file', async () => {
		const seen = await firstRow(
			[
				{ id: 'full', key: 'day', format: 'date', formatOptions: { dateStyle: 'full' } },
				{ id: 'short', key: 'day', format: 'date' },
				{ id: 'time', key: 'seen', format: 'datetime', formatOptions: { timeZone: 'UTC' } },
			],
			{ seen: '2026-06-01T22:30:59.789Z' },
		)
		expect(seen.map((cell) => [cell.type, cell.file])).toEqual([
			['n', 'Saturday, November 21, 2026'],
			['n', 'Nov 21, 2026'],
			// The seconds are cut off as on the screen, and not rounded up to 10:31.
			['n', 'Jun 1, 2026, 10:30 PM'],
		])
		for (const cell of seen) expect(cell.file).toBe(cell.screen)
	})

	test('a date after the year 9999 is text, and a text that reads as an escape stays as it is', async () => {
		const { view } = setup({
			rows: [{ ...sales()[0], id: 'x', name: 'a_x000D_b', day: '+010000-01-01T00:00:00Z' } as Sale],
			columns: [{ id: 'name' }, { id: 'day', format: 'date' }],
		})
		try {
			const data = view.api.exportData()
			const files = unzip(await toXlsx(data, { compress: false, sheetName: "'May's'" }))
			const sheet = files.get('xl/worksheets/sheet1.xml') ?? ''
			expect(sheet).toContain('>a_x005F_x000D_b</t>')
			expect((await readSheet(data)).get('B2')?.type).toBe('inlineStr')
			// A spreadsheet refuses a sheet name with a quote at its start or end.
			expect(files.get('xl/workbook.xml')).toContain(`<sheet name="May's"`)
		} finally {
			view.unmount()
		}
	})
})
