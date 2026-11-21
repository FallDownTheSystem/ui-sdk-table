import { mount } from '@ui-sdk/core/testing'
import { expect, test } from 'vite-plus/test'
import { toCsv } from '../export'
import type { ColumnDef } from '../rows'
import { table, type TableOptions } from '../table'

// P6 of the formula work: what the table does today with an error text, such
// as `#DIV/0!`, in a column of numbers. No formula code runs here: the text
// is in the row, as a formula would leave it. Each answer below is what the
// plan of the formulas builds on, and a change of one of them changes it.

type Line = { id: string; item: string; price: number | string }

const rows: Line[] = [
	{ id: 'a', item: 'Bolt', price: 2.5 },
	{ id: 'b', item: 'Nut', price: '#DIV/0!' },
	{ id: 'c', item: 'Washer', price: 0.25 },
	{ id: 'd', item: 'Screw', price: 10 },
]

const columns: ColumnDef<Line>[] = [
	{ id: 'item', header: 'Item' },
	{
		id: 'price',
		header: 'Price',
		format: 'currency',
		formatOptions: { currency: 'EUR', showUnit: true },
		aggregate: 'sum',
		filter: 'range',
		sortable: true,
	},
	{ id: 'kind', header: 'Kind', value: (row) => row.price, filter: 'select' },
]

function setup(options: Partial<TableOptions<Line>> = {}) {
	return mount(
		table,
		{ rows, columns, ...options } as TableOptions,
		'<root aria-label="Parts"></root>',
	)
}

const ids = (view: ReturnType<typeof setup>) => view.api.rows().map((flat) => flat.id)

test('P6: an error text shows its code in a column of numbers, where the format alone would show an empty cell', () => {
	const view = setup()
	const price = view.api.columns()[1] as ColumnDef
	expect(view.api.text(rows[0], price, 'a')).toBe('€2.50')
	// The format alone gives `invalidValue`, an empty text. The text of a cell tests for an error first.
	expect(view.api.text(rows[1], price, 'b')).toBe('#DIV/0!')
	view.unmount()
})

test('P6: a sum and a mean leave the error out, and a count counts it', () => {
	const view = setup()
	expect(view.api.getTotals().price?.value).toBe(12.75)
	view.api.setColumnAggregate('price', 'mean')
	expect(view.api.getTotals().price?.value).toBe(4.25)
	view.api.setColumnAggregate('price', 'count')
	expect(view.api.getTotals().price?.value).toBe(4)
	view.unmount()
})

test('P6: a sort puts the error before the numbers going up, and after them going down', () => {
	// A number and a text compare as texts, and `#` comes before the digits.
	const view = setup({ defaultSort: [{ id: 'price' }] })
	expect(ids(view)).toEqual(['b', 'c', 'a', 'd'])
	view.unmount()
	const down = setup({ defaultSort: [{ id: 'price', desc: true }] })
	expect(ids(down)).toEqual(['d', 'a', 'c', 'b'])
	down.unmount()
})

test('P6: a range filter leaves the error out, a search finds it, and a select facet lists it', () => {
	const view = setup({ defaultFilter: { columns: { price: { min: 0 } } } })
	expect(ids(view)).toEqual(['a', 'c', 'd'])
	view.api.clearFilters()
	view.api.setSearch('#DIV')
	expect(ids(view)).toEqual(['b'])
	view.api.clearFilters()
	const facets = view.api.getFacets('kind')
	expect(facets.values?.map((value) => value.text)).toContain('#DIV/0!')
	// The range of a number column counts the numbers only.
	expect(view.api.getFacets('price').range).toMatchObject({ min: 0.25, max: 10 })
	view.unmount()
})

test('P6: an export holds the code of the error, in a number column and in a plain column', () => {
	const view = setup()
	const csv = toCsv(view.api.exportData())
	const line = csv.split('\r\n').find((text) => text.startsWith('Nut'))
	// The export writes the text of the screen, so the same rule of `text()` fixes both.
	expect(line).toBe('Nut,#DIV/0!,#DIV/0!')
	view.unmount()
})
