import { describe, expect, test } from 'vite-plus/test'
import { editText } from './edit'
import type { CellFormats } from './sheet'
import { sheetTable } from './sheet/harness'
import type { TableChangeDetails } from './table'

// Grid row 0 is the header row; the rows a, b, c, d are rows 1 to 4. The
// columns are name, kind (never edited), price, stock. No column has a
// `format`, so a number shows as code writes it until a format says otherwise.

const ref = (rowId: string, columnId: string) => ({ rowId, columnId })
const COLORS = ['red', 'amber', 'green']
const LOOKS = ['data-align', 'data-bold', 'data-italic', 'data-color', 'data-fill', 'data-format']

function looks(cell: HTMLElement): Record<string, string> {
	const found: Record<string, string> = {}
	for (const name of LOOKS) {
		const value = cell.getAttribute(name)
		if (value !== null) found[name] = value
	}
	return found
}

describe('the text of a cell', () => {
	test('follows the format of the cell, and a cell without one reads as before', () => {
		const { view, rows } = sheetTable({ sheet: true, locale: 'en-US' })
		try {
			const [a, b] = rows
			const price = view.api.getView().columns.find((column) => column.id === 'price')
			if (!a || !b || !price) throw new Error('The table of the test lost a row or a column.')
			expect(view.api.text(a, price, 'a')).toBe('2.5')

			view.api.formatCells({ decimals: 2 }, { from: ref('a', 'price') })
			expect(view.api.text(a, price, 'a')).toBe('2.50')
			expect(view.api.text(b, price, 'b')).toBe('0.5')
			// Without the id of the row, the column alone decides.
			expect(view.api.text(a, price)).toBe('2.5')

			view.api.formatCells({ format: 'currency', currency: 'usd' }, { columns: ['price'] })
			expect(view.api.text(b, price, 'b')).toBe('$0.50')
			// The cell said two decimals already, and the column says the kind.
			expect(view.api.text(a, price, 'a')).toBe('$2.50')
			expect(view.api.getCellFormat('a', 'price')).toEqual({
				format: 'currency',
				currency: 'USD',
				decimals: 2,
			})
			expect(view.api.getCellFormat('b', 'name')).toEqual({})
		} finally {
			view.unmount()
		}
	})

	test('a total shows as its column does, and a search does not follow a format', () => {
		const { view } = sheetTable({ sheet: true, locale: 'en-US' })
		try {
			view.api.setColumnAggregate('price', 'sum')
			expect(view.api.getTotals().price?.text).toBe('4.7')
			view.api.formatCells({ format: 'currency', currency: 'EUR' }, { columns: ['price'] })
			expect(view.api.getTotals().price?.text).toBe('€4.70')
			// A count is a plain number, whatever the format of its column.
			view.api.setColumnAggregate('price', 'count')
			expect(view.api.getTotals().price?.text).toBe('4')

			// The search reads the text of the column definition: `€` finds nothing.
			view.api.setSearch('€')
			expect(view.api.getView().rowCount).toBe(0)
			view.api.setSearch('2.5')
			expect(view.api.getView().rowCount).toBe(1)
		} finally {
			view.unmount()
		}
	})
})

describe('the attributes of a cell', () => {
	test('each look of a format is a data attribute, and the format name follows the cell', async () => {
		const { view, cell } = sheetTable({ sheet: true, formatColors: COLORS })
		try {
			await view.settle()
			expect(looks(cell('a', 'price'))).toEqual({})
			view.api.formatCells(
				{
					align: 'end',
					bold: true,
					italic: true,
					color: 'red',
					fill: 'amber',
					format: 'percentage',
				},
				{ from: ref('a', 'price'), to: ref('b', 'price') },
			)
			await view.settle()
			const all = {
				'data-align': 'end',
				'data-bold': '',
				'data-italic': '',
				'data-color': 'red',
				'data-fill': 'amber',
				'data-format': 'percentage',
			}
			expect(looks(cell('a', 'price'))).toEqual(all)
			expect(looks(cell('b', 'price'))).toEqual(all)
			expect(looks(cell('c', 'price'))).toEqual({})
			expect(looks(cell('a', 'stock'))).toEqual({})
			// The header of the column has no format of a cell.
			expect(looks(cell('h', 'price'))).toEqual({})

			view.api.formatCells({ bold: false, italic: null, fill: null }, { from: ref('a', 'price') })
			await view.settle()
			expect(looks(cell('a', 'price'))).toEqual({
				'data-align': 'end',
				'data-color': 'red',
				'data-format': 'percentage',
			})

			view.api.clearCellFormats({ from: ref('a', 'price'), to: ref('b', 'price') })
			await view.settle()
			expect(looks(cell('a', 'price'))).toEqual({})
			expect(view.state.cellFormats).toEqual({})
		} finally {
			view.unmount()
		}
	})

	test('a format of a column reaches its header as the format name, and decimals alone make it a decimal', async () => {
		const { view, cell } = sheetTable({ sheet: true })
		try {
			view.api.formatCells({ decimals: 1 }, { columns: ['stock'] })
			await view.settle()
			expect(cell('h', 'stock').getAttribute('data-format')).toBe('decimal')
			expect(cell('d', 'stock').getAttribute('data-format')).toBe('decimal')
			expect(cell('h', 'price').getAttribute('data-format')).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('a format follows its row through a sort and a filter', async () => {
		const { view, cell } = sheetTable({ sheet: true })
		try {
			view.api.formatCells({ bold: true }, { from: ref('c', 'stock') })
			await view.settle()
			// The markup of the test names its cells by place: row c is the third row.
			expect(cell('c', 'stock').hasAttribute('data-bold')).toBe(true)

			// Stock 15 is the smallest: row c is first now, and the element at the first place shows it.
			view.api.sortBy('stock', 'asc')
			await view.settle()
			expect(cell('a', 'stock').hasAttribute('data-bold')).toBe(true)
			expect(cell('c', 'stock').hasAttribute('data-bold')).toBe(false)
			expect(view.api.getCellFormat('c', 'stock')).toEqual({ bold: true })

			view.api.sortBy('stock', null)
			view.api.setSearch('Washer')
			await view.settle()
			expect(cell('a', 'stock').hasAttribute('data-bold')).toBe(true)
			view.api.setSearch('Bolt')
			await view.settle()
			expect(cell('a', 'stock').hasAttribute('data-bold')).toBe(false)
			// The row is hidden, and its format waits for it.
			expect(view.api.getCellFormat('c', 'stock')).toEqual({ bold: true })
		} finally {
			view.unmount()
		}
	})

	test('a change wakes the cells of its rows and of its columns, and no other cell', async () => {
		const { view } = sheetTable({ sheet: true })
		try {
			await view.settle()
			const woken: string[] = []
			// Each cell with a column asks for the name of its format when its attributes are made.
			const formatNameOf = view.api.formatNameOf
			view.api.formatNameOf = (state, column, rowId) => {
				woken.push(`${rowId ?? 'head'}:${column.id}`)
				return formatNameOf(state, column, rowId)
			}
			const seen = () => [...new Set(woken.splice(0))].toSorted()

			view.api.formatCells({ bold: true }, { from: ref('b', 'price') })
			await view.settle()
			// The four cells of row b.
			expect(seen()).toEqual(['b:kind', 'b:name', 'b:price', 'b:stock'])

			view.api.formatCells({ italic: true }, { columns: ['stock'] })
			await view.settle()
			// The cells of the column, with its header.
			expect(seen()).toEqual(['a:stock', 'b:stock', 'c:stock', 'd:stock', 'head:stock'])

			// The same format again is no change, and wakes no cell.
			const before = view.state.cellFormats
			view.api.formatCells({ bold: true }, { from: ref('b', 'price') })
			await view.settle()
			expect(view.state.cellFormats).toBe(before)
			expect(seen()).toEqual([])
		} finally {
			view.unmount()
		}
	})
})

describe('formatCells', () => {
	test('without a target, the selected cells get the format, as one change with one object for them all', () => {
		const told: [CellFormats, TableChangeDetails][] = []
		const { view } = sheetTable({
			sheet: true,
			onCellFormatsChange: (value, details) => told.push([value, details]),
		})
		try {
			view.api.selectCells(ref('a', 'price'), ref('c', 'stock'))
			view.api.formatCells({ decimals: 2 })
			expect(told).toHaveLength(1)
			expect(told[0]?.[1]).toMatchObject({ reason: 'imperative', source: 'programmatic' })
			const cells = view.state.cellFormats.cells
			expect(Object.keys(cells ?? {})).toEqual(['a', 'b', 'c'])
			expect(cells?.a).toEqual({ price: { decimals: 2 }, stock: { decimals: 2 } })
			expect(cells?.a).toBe(cells?.c)
			expect(cells?.a?.price).toBe(cells?.a?.stock)
			expect(view.state.cellFormats.columns).toBeUndefined()
			expect(view.announced.at(-1)).toContain('6 cells formatted.')
			expect(view.api.getView().cellFormats).toBe(view.state.cellFormats)

			// The same format again is no change and no report.
			view.api.formatCells({ decimals: 2 })
			expect(told).toHaveLength(1)
		} finally {
			view.unmount()
		}
	})

	test('cells that are every row of the table go to the column layer, and a filter stops that', () => {
		const { view } = sheetTable({ sheet: true })
		try {
			view.api.selectCellColumns('price')
			view.api.formatCells({ bold: true })
			expect(view.state.cellFormats).toEqual({ columns: { price: { bold: true } } })
			// A row that comes later has the format too: it is found by the column.
			expect(view.api.getCellFormat('d', 'price')).toEqual({ bold: true })

			view.api.setSearch('Steel')
			view.api.selectCellColumns('stock')
			view.api.formatCells({ italic: true })
			// Two rows pass the filter, so the two cells get it and the column does not.
			expect(view.state.cellFormats).toEqual({
				columns: { price: { bold: true } },
				cells: { a: { stock: { italic: true } }, b: { stock: { italic: true } } },
			})
		} finally {
			view.unmount()
		}
	})

	test('with pages from a server the table never has every row, so a whole column of the page is cells', () => {
		const { view } = sheetTable({ sheet: true, manualPage: true, rowCount: 400 })
		try {
			view.api.selectCellColumns('price')
			view.api.formatCells({ bold: true })
			expect(view.state.cellFormats.columns).toBeUndefined()
			expect(Object.keys(view.state.cellFormats.cells ?? {})).toEqual(['a', 'b', 'c', 'd'])
			// The owner can still name the columns.
			view.api.formatCells({ italic: true }, { columns: ['price'] })
			expect(view.state.cellFormats.columns).toEqual({ price: { italic: true } })
		} finally {
			view.unmount()
		}
	})

	test('the column of row numbers has no format, and a range that starts on it leaves it out', () => {
		const { view } = sheetTable({ sheet: true }, { numbers: true })
		try {
			const numbers = view.api.getView().columns.find((column) => column.rowHeader)
			if (!numbers) throw new Error('The table of the test has no column of row numbers.')
			view.api.selectCellRows('a')
			view.api.formatCells({ bold: true })
			expect(Object.keys(view.state.cellFormats.cells?.a ?? {})).toEqual([
				'name',
				'kind',
				'price',
				'stock',
			])
			expect(() => view.api.formatCells({ bold: true }, { columns: [numbers.id] })).toThrow(
				/holds the numbers of the rows.*Columns: name, kind, price, stock/,
			)
			// A read is no error: the number of a row can be the active cell, and a toolbar asks for its format.
			expect(view.api.getCellFormat('a', numbers.id)).toEqual({})
			expect(() => view.api.getCellFormat('a', 'nope')).toThrow(/No column "nope"/)
		} finally {
			view.unmount()
		}
	})

	test('a wrong property, name, colour, number or target throws with the valid values, and changes nothing', () => {
		const { view } = sheetTable({ sheet: true, formatColors: COLORS })
		try {
			view.api.selectCells(ref('a', 'price'))
			const bad = (patch: unknown, target?: unknown) => () =>
				(view.api.formatCells as (patch: unknown, target?: unknown) => void)(patch, target)
			expect(bad({ colour: 'red' })).toThrow(
				'A format has no property "colour". Its properties: format, decimals, currency, dateStyle, align, bold, italic, color, fill.',
			)
			expect(bad('bold')).toThrow(/A format is an object with the properties format, decimals/)
			expect(bad({})).toThrow(/names one property at least/)
			expect(bad({ format: 'money' })).toThrow(
				'No format "money". `format` of a format is one of: text, integer, decimal, currency, percentage, date, datetime; or null to take it away.',
			)
			expect(bad({ color: 'pink' })).toThrow(
				'No colour "pink". `color` of a format is one of: red, amber, green; or null to take it away.',
			)
			expect(bad({ fill: '#ffcc00' })).toThrow(/No colour "#ffcc00".*red, amber, green/)
			expect(bad({ align: 'left' })).toThrow(/No side "left".*start, center, end/)
			expect(bad({ dateStyle: 'tiny' })).toThrow(/short, medium, long, full/)
			expect(bad({ decimals: 11 })).toThrow(/whole number from 0 to 10/)
			expect(bad({ decimals: 1.5 })).toThrow(/whole number from 0 to 10/)
			expect(bad({ currency: 'euro' })).toThrow(/ISO 4217 code of three letters/)
			expect(bad({ bold: 'yes' })).toThrow(/`bold` of a format is true or false/)
			expect(bad({ bold: true }, { columns: ['cost'] })).toThrow(
				/No column "cost".*name, kind, price, stock/,
			)
			expect(bad({ bold: true }, { columns: [] })).toThrow(/list of column ids. Columns: name/)
			expect(bad({ bold: true }, { from: ref('z', 'price') })).toThrow(/No row "z".*a, b, c, d/)
			expect(bad({ bold: true }, 'price')).toThrow(/`\{ from, to \}`.*`\{ columns \}`/)
			expect(() => view.api.getCellFormat('z', 'price')).toThrow(/No row "z"/)
			expect(view.state.cellFormats).toEqual({})
			expect(view.state.history).toEqual({ undo: 0, redo: 0 })
		} finally {
			view.unmount()
		}
	})

	test('a table without `formatColors` refuses a colour and says which option to set, and without a selection it asks for a target', () => {
		const { view } = sheetTable({ editable: true })
		try {
			expect(() => view.api.formatCells({ fill: 'red' }, { columns: ['price'] })).toThrow(
				/no colours for a format. Set its `formatColors` option/,
			)
			// Taking a colour away needs no list.
			view.api.formatCells({ fill: null, bold: true }, { columns: ['price'] })
			expect(view.state.cellFormats).toEqual({ columns: { price: { bold: true } } })
			expect(() => view.api.formatCells({ bold: true })).toThrow(
				/No cell is selected.*pass a target/,
			)
		} finally {
			view.unmount()
		}
	})

	test('formats that the owner holds change only when the owner passes them back, and a listener can refuse', () => {
		const held: CellFormats = { columns: { price: { bold: true } } }
		const told: CellFormats[] = []
		const owned = sheetTable({
			sheet: true,
			cellFormats: held,
			onCellFormatsChange: (value) => told.push(value),
		})
		try {
			owned.view.api.formatCells({ italic: true }, { columns: ['price'] })
			expect(told).toEqual([{ columns: { price: { bold: true, italic: true } } }])
			// `mount` never passes new options: the owner of this test did not answer.
			expect(owned.view.state.cellFormats).toBe(held)
			// The report went through, so it is a step.
			expect(owned.view.state.history).toEqual({ undo: 1, redo: 0 })
		} finally {
			owned.view.unmount()
		}

		const free = sheetTable({
			sheet: true,
			defaultCellFormats: held,
			onCellFormatsChange: (_value, details) => details.cancel(),
		})
		try {
			free.view.api.formatCells({ italic: true }, { columns: ['price'] })
			expect(free.view.state.cellFormats).toBe(held)
			expect(free.view.state.history).toEqual({ undo: 0, redo: 0 })
			expect(free.view.announced.join(' ')).not.toContain('formatted')
		} finally {
			free.view.unmount()
		}
	})
})

describe('formats and the history', () => {
	test('a change of formats is one step, and an undo puts the formats back exactly', () => {
		const { view } = sheetTable({ sheet: true })
		try {
			view.api.formatCells({ decimals: 1 }, { from: ref('a', 'price') })
			const first = view.state.cellFormats
			view.api.selectCells(ref('a', 'price'), ref('d', 'stock'))
			view.api.formatCells({ bold: true })
			const second = view.state.cellFormats
			expect(view.api.getHistory()).toEqual({
				entries: [
					{ id: 1, reason: 'imperative', source: 'programmatic', cells: 0, formats: true },
					{ id: 2, reason: 'imperative', source: 'programmatic', cells: 0, formats: true },
				],
				position: 2,
			})

			view.api.undo()
			expect(view.state.cellFormats).toBe(first)
			expect(view.changes.at(-1)).toMatchObject({ key: 'cellFormats', reason: 'undo' })
			expect(view.announced.at(-1)).toContain('8 cells changed back.')
			view.api.undo()
			expect(view.state.cellFormats).toEqual({})
			view.api.redo()
			view.api.redo()
			expect(view.state.cellFormats).toBe(second)
			expect(view.changes.at(-1)).toMatchObject({ key: 'cellFormats', reason: 'redo' })
			expect(view.state.history).toEqual({ undo: 2, redo: 0 })
		} finally {
			view.unmount()
		}
	})

	test('a format step and a value step go back in their order, each as its own kind of report', () => {
		const formats: string[] = []
		const { view, values, reports } = sheetTable({
			sheet: true,
			onCellFormatsChange: (_value, details) => formats.push(details.reason),
		})
		try {
			void view.api.editCell('a', 'stock', 41)
			view.api.formatCells({ bold: true }, { from: ref('a', 'stock') })
			void view.api.editCell('a', 'stock', 42)
			expect(view.api.getHistory().entries.map((entry) => entry.formats)).toEqual([
				false,
				true,
				false,
			])

			view.api.undo()
			expect(values.a?.stock).toBe(41)
			expect(view.api.getCellFormat('a', 'stock')).toEqual({ bold: true })
			view.api.undo()
			expect(values.a?.stock).toBe(41)
			expect(view.api.getCellFormat('a', 'stock')).toEqual({})
			view.api.undo()
			expect(values.a?.stock).toBe(40)
			expect(formats).toEqual(['imperative', 'undo'])
			expect(reports.map((report) => report.details.reason)).toEqual([
				'imperative',
				'imperative',
				'undo',
				'undo',
			])
		} finally {
			view.unmount()
		}
	})

	test('the steps go back to the formats that were there before them, and no further', () => {
		const { view } = sheetTable({ sheet: true })
		try {
			view.api.formatCells({ bold: true }, { from: ref('a', 'price') })
			view.api.formatCells({ fill: null, italic: true }, { from: ref('b', 'stock') })
			// The formats of now are the ground: no step is under them.
			view.api.clearHistory()
			view.api.formatCells({ decimals: 2 }, { from: ref('a', 'price'), to: ref('a', 'stock') })
			view.api.formatCells({ align: 'end' }, { from: ref('c', 'name') })
			expect(view.state.history.undo).toBe(2)
			view.api.undo()
			view.api.undo()
			expect(view.state.cellFormats).toEqual({
				cells: { a: { price: { bold: true } }, b: { stock: { italic: true } } },
			})
		} finally {
			view.unmount()
		}
	})

	test('an undo that a listener refuses keeps the step, and the formats', () => {
		let refuse = false
		const { view } = sheetTable({
			sheet: true,
			onCellFormatsChange: (_value, details) => {
				if (refuse) details.cancel()
			},
		})
		try {
			view.api.formatCells({ bold: true }, { from: ref('a', 'price') })
			refuse = true
			expect(() => view.api.undo()).toThrow('The change was not taken back.')
			expect(view.api.getCellFormat('a', 'price')).toEqual({ bold: true })
			expect(view.state.history).toEqual({ undo: 1, redo: 0 })
			refuse = false
			view.api.undo()
			expect(view.state.cellFormats).toEqual({})
		} finally {
			view.unmount()
		}
	})

	test('without the history, a change of formats is no step', () => {
		const { view } = sheetTable({ editable: true, cellSelection: true })
		try {
			view.api.formatCells({ bold: true }, { from: ref('a', 'price') })
			expect(view.state.history).toEqual({ undo: 0, redo: 0 })
			expect(view.api.getHistory().entries).toEqual([])
		} finally {
			view.unmount()
		}
	})
})

describe('the format keys of a sheet', () => {
	const MOD = { ctrlKey: true }

	test('mod+b makes the selected cells bold unless every one is, and then takes it away: one step each', async () => {
		const told: TableChangeDetails[] = []
		const { view, cell, press } = sheetTable({
			sheet: true,
			onCellFormatsChange: (_value, details) => told.push(details),
		})
		try {
			view.api.formatCells({ bold: true }, { from: ref('a', 'price') })
			view.api.selectCells(ref('a', 'price'), ref('b', 'stock'))
			cell('a', 'price').focus()
			await view.settle()

			// One of four is bold: the key turns it on for all.
			const event = press(cell('a', 'price'), 'b', MOD)
			expect(event.defaultPrevented).toBe(true)
			const bold = (rowId: string, columnId: string) => view.api.getCellFormat(rowId, columnId).bold
			expect([
				bold('a', 'price'),
				bold('a', 'stock'),
				bold('b', 'price'),
				bold('b', 'stock'),
			]).toEqual([true, true, true, true])
			expect(told.at(-1)).toMatchObject({ reason: 'shortcut' })
			expect(view.announced.at(-1)).toContain('4 cells formatted.')

			// Every one is bold: the key takes it away, and nothing is left of it.
			press(cell('a', 'price'), 'b', MOD)
			expect(view.state.cellFormats).toEqual({})
			expect(view.api.getHistory().entries.map((entry) => entry.reason)).toEqual([
				'imperative',
				'shortcut',
				'shortcut',
			])

			press(cell('a', 'price'), 'i', MOD)
			expect(view.api.getCellFormat('b', 'stock')).toEqual({ italic: true })
			press(cell('a', 'price'), 'z', MOD)
			expect(view.state.cellFormats).toEqual({})
		} finally {
			view.unmount()
		}
	})

	test('cells that are bold by their column say no to it, because taking nothing away would change nothing', async () => {
		const { view, cell, press } = sheetTable({ sheet: true })
		try {
			view.api.formatCells({ bold: true }, { columns: ['price'] })
			view.api.selectCells(ref('a', 'price'), ref('b', 'price'))
			cell('a', 'price').focus()
			await view.settle()
			press(cell('a', 'price'), 'b', MOD)
			expect(view.api.getCellFormat('a', 'price')).toEqual({ bold: false })
			expect(view.api.getCellFormat('c', 'price')).toEqual({ bold: true })
			expect(cell('a', 'price').hasAttribute('data-bold')).toBe(false)
			// And on again: the cells say yes by themselves.
			press(cell('a', 'price'), 'b', MOD)
			expect(view.api.getCellFormat('a', 'price')).toEqual({ bold: true })
		} finally {
			view.unmount()
		}
	})

	test('`toggleCellFormat` follows the same rule from code, for a button of a toolbar', () => {
		const { view } = sheetTable({ sheet: true })
		try {
			expect(() => view.api.toggleCellFormat('bold')).toThrow(/No cell is selected/)
			view.api.formatCells({ italic: true }, { from: ref('a', 'price') })
			view.api.selectCells(ref('a', 'price'), ref('b', 'price'))
			view.api.toggleCellFormat('italic')
			expect(view.api.getCellFormat('b', 'price')).toEqual({ italic: true })
			expect(view.changes.at(-1)).toMatchObject({ key: 'cellFormats', reason: 'imperative' })
			view.api.toggleCellFormat('italic')
			expect(view.state.cellFormats).toEqual({})
			// A whole column: the look is on the column, and it goes from there.
			view.api.selectCellColumns('stock')
			view.api.toggleCellFormat('bold')
			expect(view.state.cellFormats).toEqual({ columns: { stock: { bold: true } } })
			view.api.toggleCellFormat('bold')
			expect(view.state.cellFormats).toEqual({})
			expect(() => (view.api.toggleCellFormat as (property: string) => void)('underline')).toThrow(
				/for "bold" or "italic", not for "underline"/,
			)
		} finally {
			view.unmount()
		}
	})

	test('a refusal of the owner is said and is no step', async () => {
		const { view, cell, press } = sheetTable({
			sheet: true,
			onCellFormatsChange: (_value, details) => details.cancel(),
		})
		try {
			cell('a', 'price').focus()
			await view.settle()
			expect(press(cell('a', 'price'), 'b', MOD).defaultPrevented).toBe(true)
			expect(view.state.cellFormats).toEqual({})
			expect(view.state.history).toEqual({ undo: 0, redo: 0 })
		} finally {
			view.unmount()
		}
	})
})

describe('formats and values', () => {
	test('the editor shows the plain value of a cell with a format, as a column with a format does', async () => {
		const { view, values, cell, field, press } = sheetTable({ sheet: true, locale: 'en-US' })
		try {
			if (values.a) values.a.price = 0.25
			view.api.formatCells({ format: 'percentage' }, { from: ref('a', 'price') })
			const [a] = view.api.getView().columns.filter((column) => column.id === 'price')
			if (!a) throw new Error('The table of the test has no price column.')
			expect(view.api.text({ id: 'a' }, a, 'a')).toBe('25%')
			// The value as code writes it: a person who types 0.3 gets 30 %.
			expect(editText({ id: 'a' }, a)).toBe('0.25')
			cell('a', 'price').focus()
			await view.settle()
			press(cell('a', 'price'), 'F2')
			const input = field()
			input.value = '0.3'
			press(input, 'Enter')
			expect(values.a?.price).toBe(0.3)
		} finally {
			view.unmount()
		}
	})

	test('an empty cell with a number format of its own reads a number, and without one a text', () => {
		const { view, values } = sheetTable({ sheet: true })
		try {
			const empty = values as Record<string, Record<string, unknown>>
			if (empty.a) empty.a.price = null
			if (empty.b) empty.b.price = null
			view.api.formatCells({ format: 'decimal' }, { from: ref('a', 'price') })
			void view.api.editCell('a', 'price', '12.5')
			void view.api.editCell('b', 'price', '12.5')
			expect(empty.a?.price).toBe(12.5)
			expect(empty.b?.price).toBe('12.5')
			// A text that is no number is refused, as in a column with a number format.
			expect(() => view.api.editCell('a', 'price', 'many')).toThrow(/"many" is not a number/)
		} finally {
			view.unmount()
		}
	})

	test('a copy and a fill carry values, and no format', () => {
		const { view, values } = sheetTable({ sheet: true, locale: 'en-US' })
		try {
			view.api.formatCells(
				{ format: 'currency', bold: true },
				{ from: ref('a', 'price'), to: ref('b', 'price') },
			)
			view.api.selectCells(ref('a', 'price'), ref('c', 'price'))
			expect(view.api.copyCells()).toBe('2.5\n0.5\n0.2')
			void view.api.fillCells('down')
			expect(values.c?.price).toBe(2.5)
			expect(view.api.getCellFormat('c', 'price')).toEqual({})
		} finally {
			view.unmount()
		}
	})
})

describe('formats in an export', () => {
	test('the text of a cell is the text of the screen, and the cell carries its format', () => {
		const { view } = sheetTable({ sheet: true, locale: 'en-US', formatColors: COLORS })
		try {
			view.api.formatCells({ decimals: 2 }, { from: ref('a', 'price') })
			view.api.formatCells({ fill: 'green' }, { from: ref('b', 'price') })
			const data = view.api.exportData({ columns: ['name', 'price'] })
			expect(data.rows.map((row) => row.cells[1])).toEqual([
				{ value: 2.5, text: '2.50', format: { decimals: 2 } },
				{ value: 0.5, text: '0.5', format: { fill: 'green' } },
				{ value: 0.2, text: '0.2' },
				{ value: 1.5, text: '1.5' },
			])
		} finally {
			view.unmount()
		}
	})
})
