import { describe, expect, test } from 'vite-plus/test'
import { formatValue } from '../format'
import type { ColumnDef } from '../rows'
import {
	byCellFormat,
	CLEAR_FORMAT,
	decidesText,
	formatNames,
	ownFormat,
	pruneFormats,
	resolveFormat,
	revertFormats,
	sameFormat,
	setFormats,
	type CellFormats,
} from './formats'

const NONE: CellFormats = {}

describe('setFormats', () => {
	test('cells of one call that had no format share one object, and one record holds them', () => {
		const rows = Array.from({ length: 1_000 }, (_, index) => `r${index}`)
		const next = setFormats(NONE, { rows, columns: ['price'] }, { bold: true })
		expect(next.columns).toBeUndefined()
		expect(Object.keys(next.cells ?? {})).toHaveLength(1_000)
		const inner = new Set(Object.values(next.cells ?? {}))
		const formats = new Set([...inner].map((row) => row.price))
		// One record for a row and one format, however many rows there are.
		expect(inner.size).toBe(1)
		expect(formats.size).toBe(1)
		expect(next.cells?.r7).toEqual({ price: { bold: true } })
	})

	test('a row that the patch does not name keeps its object, and so does a row that has the format already', () => {
		const first = setFormats(NONE, { rows: ['a', 'b'], columns: ['price'] }, { bold: true })
		const second = setFormats(first, { rows: ['b', 'c'], columns: ['stock'] }, { italic: true })
		expect(second.cells?.a).toBe(first.cells?.a)
		expect(second.cells?.b).toEqual({ price: { bold: true }, stock: { italic: true } })
		expect(second.cells?.c).toEqual({ stock: { italic: true } })
		// Nothing in place: the first value is as it was.
		expect(first.cells?.b).toEqual({ price: { bold: true } })

		const again = setFormats(second, { rows: ['b', 'c'], columns: ['stock'] }, { italic: true })
		expect(again).toBe(second)
	})

	test('a patch changes only the properties that it names, and `null` takes one away', () => {
		const first = setFormats(
			NONE,
			{ rows: ['a'], columns: ['price'] },
			{ bold: true, decimals: 2, fill: 'amber' },
		)
		const second = setFormats(
			first,
			{ rows: ['a'], columns: ['price'] },
			{ bold: null, decimals: 0 },
		)
		expect(second.cells?.a?.price).toEqual({ decimals: 0, fill: 'amber' })
		// `undefined` in a patch is no word about the property.
		const third = setFormats(second, { rows: ['a'], columns: ['price'] }, { fill: undefined })
		expect(third).toBe(second)
		// The last property that goes takes the cell, the row and the layer with it.
		const empty = setFormats(second, { rows: ['a'], columns: ['price'] }, CLEAR_FORMAT)
		expect(empty).toEqual({})
		// A `null` for a property that is not there changes nothing.
		expect(setFormats(NONE, { rows: ['a'], columns: ['price'] }, { bold: null })).toBe(NONE)
	})

	test('a patch for whole columns goes to the column layer and takes its properties out of the cells of those columns', () => {
		const cells = setFormats(
			setFormats(NONE, { rows: ['a'], columns: ['price'] }, { decimals: 3, bold: true }),
			{ rows: ['b'], columns: ['price', 'stock'] },
			{ decimals: 1 },
		)
		const next = setFormats(cells, { columns: ['price'] }, { decimals: 2 })
		expect(next.columns).toEqual({ price: { decimals: 2 } })
		// The cell keeps what the column did not say, and the other column is as it was.
		expect(next.cells).toEqual({ a: { price: { bold: true } }, b: { stock: { decimals: 1 } } })
		expect(ownFormat(next, 'a', 'price')).toEqual({ decimals: 2, bold: true })
		expect(ownFormat(next, 'z', 'price')).toEqual({ decimals: 2 })

		// Taking a property away from a column also takes it out of the cells.
		const cleared = setFormats(next, { columns: ['price'] }, { decimals: null, bold: null })
		expect(cleared).toEqual({ cells: { b: { stock: { decimals: 1 } } } })
	})

	test('no column is no change', () => {
		expect(setFormats(NONE, { rows: ['a'], columns: [] }, { bold: true })).toBe(NONE)
		expect(setFormats(NONE, { columns: [] }, { bold: true })).toBe(NONE)
	})
})

describe('ownFormat', () => {
	test('a property of the cell wins over the same property of its column, and the pair is one object', () => {
		const formats = setFormats(
			setFormats(NONE, { columns: ['price'] }, { decimals: 2, align: 'end' }),
			{ rows: ['a', 'b'], columns: ['price'] },
			{ decimals: 0 },
		)
		// The column patch came first here, so the cells keep their own decimals.
		const a = ownFormat(formats, 'a', 'price')
		expect(a).toEqual({ decimals: 0, align: 'end' })
		expect(ownFormat(formats, 'b', 'price')).toBe(a)
		expect(ownFormat(formats, 'c', 'price')).toBe(formats.columns?.price)
		expect(ownFormat(formats, undefined, 'price')).toBe(formats.columns?.price)
		expect(ownFormat(formats, 'a', 'stock')).toBeUndefined()
		expect(ownFormat(NONE, 'a', 'price')).toBeUndefined()
	})
})

describe('revertFormats', () => {
	const before = setFormats(NONE, { rows: ['a'], columns: ['price'] }, { italic: true })
	const after = setFormats(before, { rows: ['a', 'b'], columns: ['price'] }, { bold: true })

	test('with no change since, the old value comes back as it was, with its objects', () => {
		expect(revertFormats(after, after, before)).toBe(before)
		expect(revertFormats(before, before, after)).toBe(after)
	})

	test('a change that the owner made beside the step stays', () => {
		// The owner gave another cell and another column a format after the step.
		const beside = setFormats(
			setFormats(after, { rows: ['c'], columns: ['stock'] }, { fill: 'green' }),
			{ columns: ['name'] },
			{ align: 'center' },
		)
		const undone = revertFormats(beside, after, before)
		expect(undone).toEqual({
			columns: { name: { align: 'center' } },
			cells: { a: { price: { italic: true } }, c: { stock: { fill: 'green' } } },
		})
		// And the step goes on again over it.
		expect(revertFormats(undone, before, after)).toEqual(beside)
	})

	test('a change in another column of a row of the step stays too', () => {
		const beside = setFormats(after, { rows: ['b'], columns: ['stock'] }, { bold: true })
		expect(revertFormats(beside, after, before)).toEqual({
			cells: { a: { price: { italic: true } }, b: { stock: { bold: true } } },
		})
	})

	test('another property of a cell of the step stays: the undo turns back only what the step turned', () => {
		// The owner gave a cell of the step two decimals, and took the italic of the first cell away.
		const beside = setFormats(
			setFormats(after, { rows: ['b'], columns: ['price'] }, { decimals: 2 }),
			{ rows: ['a'], columns: ['price'] },
			{ italic: null },
		)
		const undone = revertFormats(beside, after, before)
		// Bold goes, as the step brought it. The decimals stay, and so does the choice against italic.
		expect(undone).toEqual({ cells: { b: { price: { decimals: 2 } } } })
		expect(revertFormats(undone, before, after)).toEqual({
			cells: { a: { price: { bold: true } }, b: { price: { bold: true, decimals: 2 } } },
		})
	})

	test('a step of a whole column goes back with the cell entries that it took out', () => {
		const cells = setFormats(NONE, { rows: ['a'], columns: ['price'] }, { decimals: 3 })
		const column = setFormats(cells, { columns: ['price'] }, { decimals: 1 })
		expect(column.cells).toBeUndefined()
		const beside = setFormats(column, { columns: ['stock'] }, { bold: true })
		expect(revertFormats(beside, column, cells)).toEqual({
			columns: { stock: { bold: true } },
			cells: { a: { price: { decimals: 3 } } },
		})
	})

	test('nothing differs: the value of now comes back itself', () => {
		const other = setFormats(NONE, { columns: ['name'] }, { bold: true })
		expect(revertFormats(other, before, before)).toBe(other)
		// The owner already put the old formats back by itself.
		expect(revertFormats(before, after, before)).toBe(before)
	})
})

describe('pruneFormats', () => {
	test('the entries of rows and columns that are gone go, and the others keep their objects', () => {
		const formats = setFormats(
			setFormats(NONE, { columns: ['price', 'old'] }, { bold: true }),
			{ rows: ['a', 'b', 'gone'], columns: ['price', 'old'] },
			{ italic: true },
		)
		const pruned = pruneFormats(formats, ['a', 'b'], new Set(['price', 'name']))
		expect(pruned).toEqual({
			columns: { price: { bold: true } },
			cells: { a: { price: { italic: true } }, b: { price: { italic: true } } },
		})
		expect(pruned.cells?.a).toBe(pruned.cells?.b)
		expect(pruneFormats(pruned, ['a', 'b'], ['price'])).toBe(pruned)
		expect(pruneFormats(formats, [], [])).toEqual({})
	})
})

describe('resolveFormat', () => {
	const price: ColumnDef = { id: 'price', format: 'decimal', formatOptions: { locale: 'en-US' } }
	const day: ColumnDef = { id: 'day', format: 'date', formatOptions: { locale: 'en-US' } }
	const plain: ColumnDef = { id: 'plain' }
	const show = (column: ColumnDef, formats: CellFormats, value: unknown, rowId?: string) => {
		const shown = resolveFormat(column, formats, rowId)
		return shown.format
			? formatValue(value, shown.format, shown.options, { locale: 'en-US' })
			: String(value)
	}

	test('without a format of its own, a cell shows by its column, with the options object of the column', () => {
		const shown = resolveFormat(price, NONE, 'a')
		expect(shown).toEqual({
			name: 'decimal',
			format: 'decimal',
			options: price.formatOptions,
			own: false,
		})
		expect(shown.options).toBe(price.formatOptions)
		// Looks alone do not change the text or the options either.
		const looks = setFormats(NONE, { rows: ['a'], columns: ['price'] }, { bold: true, fill: 'x' })
		expect(resolveFormat(price, looks, 'a').options).toBe(price.formatOptions)
		expect(resolveFormat(price, looks, 'a').own).toBe(false)
	})

	test('50,000 cells with one format get one answer, so `formatValue` prepares one formatter', () => {
		const rows = Array.from({ length: 50 }, (_, index) => `r${index}`)
		const formats = setFormats(NONE, { rows, columns: ['price'] }, { decimals: 3 })
		const first = resolveFormat(price, formats, 'r0')
		for (const id of rows) expect(resolveFormat(price, formats, id)).toBe(first)
		expect(first.own).toBe(true)
		// Another column with the same format object has its own answer.
		const other: ColumnDef = { id: 'price', format: 'currency' }
		expect(resolveFormat(other, formats, 'r0')).not.toBe(first)
	})

	test('each property reaches the text', () => {
		const at = (patch: Parameters<typeof setFormats>[2], column = price) =>
			setFormats(NONE, { rows: ['a'], columns: [column.id] }, patch)
		expect(show(price, NONE, 1234.5, 'a')).toBe('1,234.50')
		expect(show(price, at({ decimals: 0 }), 1234.5, 'a')).toBe('1,235')
		expect(show(price, at({ decimals: 3 }), 1234.5, 'a')).toBe('1,234.500')
		expect(show(price, at({ format: 'integer' }), 1234.5, 'a')).toBe('1,235')
		expect(show(price, at({ format: 'currency' }), 1234.5, 'a')).toBe('€1,234.50')
		expect(show(price, at({ format: 'currency', currency: 'USD' }), 1234.5, 'a')).toBe('$1,234.50')
		expect(show(price, at({ format: 'currency', currency: 'JPY', decimals: 0 }), 1234.5, 'a')).toBe(
			'¥1,235',
		)
		expect(show(price, at({ format: 'percentage' }), 0.25, 'a')).toBe('25%')
		expect(show(price, at({ format: 'percentage', decimals: 1 }), 0.256, 'a')).toBe('25.6%')
		expect(show(price, at({ format: 'text' }), 1234.5, 'a')).toBe('1234.5')
		// Another row of the column is as before.
		expect(show(price, at({ decimals: 0 }), 1234.5, 'b')).toBe('1,234.50')

		const date = new Date(2024, 1, 29)
		expect(show(day, at({ dateStyle: 'long' }, day), date, 'a')).toBe('February 29, 2024')
		expect(show(day, at({ dateStyle: 'short' }, day), date, 'a')).toBe('2/29/24')
		expect(show(plain, at({ format: 'date', dateStyle: 'medium' }, plain), date, 'a')).toBe(
			'Feb 29, 2024',
		)
	})

	test('decimals on a column without a format, and on a whole number, make a decimal', () => {
		const formats = setFormats(NONE, { columns: ['plain'] }, { decimals: 2 })
		expect(resolveFormat(plain, formats)).toMatchObject({ name: 'decimal', format: 'decimal' })
		expect(show(plain, formats, 3, 'a')).toBe('3.00')
		const whole: ColumnDef = { id: 'whole', format: 'integer' }
		const more = setFormats(NONE, { columns: ['whole'] }, { decimals: 1 })
		expect(show(whole, more, 3, 'a')).toBe('3.0')
	})

	test('the name is the format of the cell, else of its column, and `text` shows the value as it is', () => {
		const formats = setFormats(NONE, { rows: ['a'], columns: ['price'] }, { format: 'text' })
		expect(resolveFormat(price, formats, 'a')).toEqual({
			name: 'text',
			format: undefined,
			options: undefined,
			own: true,
		})
		expect(resolveFormat(price, formats, 'b').name).toBe('decimal')
		// A footer cell has no row: the layer of the column alone.
		const column = setFormats(formats, { columns: ['price'] }, { format: 'currency' })
		expect(resolveFormat(price, column).name).toBe('currency')
	})

	test('a currency that a column already shows keeps its own rule for the sign', () => {
		const money: ColumnDef = {
			id: 'money',
			format: 'currency',
			formatOptions: { locale: 'en-US', currency: 'USD', showUnit: false },
		}
		const formats = setFormats(NONE, { columns: ['money'] }, { decimals: 0 })
		expect(show(money, formats, 12.6, 'a')).toBe('13')
	})
})

test('decidesText: a format that only looks does not decide the text', () => {
	expect(decidesText(undefined)).toBe(false)
	expect(decidesText({ bold: true, align: 'end', color: 'red', fill: 'red', italic: true })).toBe(
		false,
	)
	for (const format of [
		{ format: 'text' },
		{ decimals: 0 },
		{ currency: 'EUR' },
		{ dateStyle: 'short' },
	] as const) {
		expect(decidesText(format)).toBe(true)
	}
})

test('sameFormat compares by what the formats say', () => {
	expect(sameFormat(undefined, {})).toBe(true)
	expect(sameFormat({ bold: true }, { bold: true })).toBe(true)
	expect(sameFormat({ bold: true }, { bold: false })).toBe(false)
	expect(sameFormat({ bold: true }, undefined)).toBe(false)
})

test('the reader names the rows and the columns whose formats changed, and no other', () => {
	const names = (previous: CellFormats, next: CellFormats) => {
		const found: string[] = []
		byCellFormat.moved(previous, next, (name) => found.push(name))
		return found.toSorted()
	}
	const first = setFormats(NONE, { rows: ['a', 'b'], columns: ['price'] }, { bold: true })
	expect(names(NONE, first)).toEqual(['r:a', 'r:b'])
	const second = setFormats(first, { rows: ['b'], columns: ['stock'] }, { bold: true })
	expect(names(first, second)).toEqual(['r:b'])
	const third = setFormats(second, { columns: ['price'] }, { bold: true })
	// The column got the format, and the two cells lost theirs.
	expect(names(second, third)).toEqual(['c:price', 'r:a', 'r:b'])
	expect(names(third, third)).toEqual([])
	expect(names(third, NONE)).toEqual(['c:price', 'r:b'])
	expect(formatNames('a', 'price')).toEqual(['r:a', 'c:price'])
	expect(formatNames(undefined, 'price')).toEqual(['c:price'])
})
