import { describe, expect, test } from 'vite-plus/test'
import { priceSchema, sheetTable } from './sheet/harness'

// Grid row 0 is the header row; the rows a, b, c, d are rows 1 to 4. The
// columns are name, kind (never edited), price, stock.

const stock = (values: Record<string, { stock: number }>) =>
	['a', 'b', 'c', 'd'].map((id) => values[id]?.stock)
const price = (values: Record<string, { price: number }>) =>
	['a', 'b', 'c', 'd'].map((id) => values[id]?.price)
const ref = (rowId: string, columnId: string) => ({ rowId, columnId })

describe('fillCells', () => {
	test('one line repeats down the selected cells, as one report with the reason `fill` and one step', () => {
		const { view, values, reports, told } = sheetTable({ sheet: true })
		try {
			view.api.selectCells(ref('a', 'stock'), ref('d', 'stock'))
			void view.api.fillCells('down')
			expect(stock(values)).toEqual([40, 40, 40, 40])
			expect(reports).toHaveLength(1)
			expect(reports[0]?.details.reason).toBe('fill')
			expect(told()[0]).toEqual([
				['b', 'stock', 90, 40],
				['c', 'stock', 15, 40],
				['d', 'stock', 60, 40],
			])
			expect(view.announced.at(-1)).toContain('3 cells filled.')
			expect(view.state.history).toEqual({ undo: 1, redo: 0 })

			view.api.undo()
			expect(stock(values)).toEqual([40, 90, 15, 60])
			expect(reports[1]?.details.reason).toBe('undo')
			view.api.redo()
			expect(stock(values)).toEqual([40, 40, 40, 40])
		} finally {
			view.unmount()
		}
	})

	test('two lines with one step go on, down and up, also below zero', () => {
		const { view, values } = sheetTable({ sheet: true })
		try {
			view.api.selectCells(ref('a', 'stock'), ref('d', 'stock'))
			void view.api.fillCells('down', 2)
			// 40, 90: the step is 50.
			expect(stock(values)).toEqual([40, 90, 140, 190])
			view.api.undo()
			expect(stock(values)).toEqual([40, 90, 15, 60])
			// The undo selected the cells that it changed.
			expect(view.api.getView().cellSelection).toMatchObject({ from: ref('c', 'stock'), rows: 2 })
			view.api.selectCells(ref('a', 'stock'), ref('d', 'stock'))
			void view.api.fillCells('up', 2)
			// 15, 60 from the bottom: the step is 45, and the rows above go on backwards.
			expect(stock(values)).toEqual([-75, -30, 15, 60])
		} finally {
			view.unmount()
		}
	})

	test('a step with decimals has no noise of floats in the values that are reported', () => {
		const { view, values, told } = sheetTable({ sheet: true })
		try {
			if (values.a) values.a.price = 0.1
			if (values.b) values.b.price = 0.2
			view.api.selectCells(ref('a', 'price'), ref('d', 'price'))
			void view.api.fillCells('down', 2)
			expect(told()[0]).toEqual([
				['c', 'price', 0.2, 0.3],
				['d', 'price', 1.5, 0.4],
			])
		} finally {
			view.unmount()
		}
	})

	test('several columns fill each from its own line, and a cell that cannot be edited keeps its place in the line', () => {
		const { view, values, told } = sheetTable({ sheet: true }, { locked: ['c'] })
		try {
			view.api.selectCells(ref('a', 'name'), ref('d', 'stock'))
			void view.api.fillCells('down', 2)
			// Names repeat, the kind is never edited, prices and stocks go on.
			expect(told()[0]).toEqual([
				['c', 'name', 'Washer', 'Bolt'],
				['d', 'name', 'Screw', 'Nut'],
				['c', 'price', 0.2, -1.5],
				['d', 'price', 1.5, -3.5],
				// The stock of row c is locked: row d gets the fourth value of the series, not the third.
				['d', 'stock', 60, 190],
			])
			expect(values.c?.stock).toBe(15)
			// The range is the source and the target together.
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 0 }, end: { row: 4, col: 3 } })
		} finally {
			view.unmount()
		}
	})

	test('a fill forward and back takes the text of the source into the next columns, through their own check', () => {
		const { view, values, told } = sheetTable({ sheet: true })
		try {
			view.api.selectCells(ref('a', 'price'), ref('b', 'stock'))
			void view.api.fillCells('forward')
			expect(told()[0]).toEqual([
				['a', 'stock', 40, 2.5],
				['b', 'stock', 90, 0.5],
			])
			view.api.undo()
			view.api.selectCells(ref('a', 'price'), ref('b', 'stock'))
			void view.api.fillCells('back')
			expect(price(values)).toEqual([40, 90, 0.2, 1.5])
		} finally {
			view.unmount()
		}
	})

	test('a text for a number column refuses the whole fill, with the column and the text in the reason', () => {
		const { view, values, reports } = sheetTable({ sheet: true })
		try {
			const before = JSON.stringify(values)
			view.api.selectCells(ref('a', 'name'), ref('b', 'stock'))
			expect(() => view.api.fillCells('forward')).toThrow(
				'Nothing was filled. Price refuses "Bolt": "Bolt" is not a number.',
			)
			expect(reports).toEqual([])
			expect(JSON.stringify(values)).toBe(before)
			expect(view.state.history).toEqual({ undo: 0, redo: 0 })
		} finally {
			view.unmount()
		}
	})

	test('one value that a schema refuses stops the fill before any cell changes, in every column', async () => {
		const { view, values, reports } = sheetTable({ sheet: true }, { schema: priceSchema() })
		try {
			if (values.a) values.a.price = 2
			if (values.b) values.b.price = 1
			const before = JSON.stringify(values)
			view.api.selectCells(ref('a', 'price'), ref('d', 'stock'))
			// The prices go 2, 1, 0, -1: only the last one is refused. The stocks would all pass.
			expect(() => view.api.fillCells('down', 2)).toThrow(
				'Nothing was filled. Price refuses "-1": The price must be 0 or more.',
			)
			expect(reports).toEqual([])
			expect(JSON.stringify(values)).toBe(before)

			// With a check that answers later, the fill waits for it and is refused in the same way.
			const slow = sheetTable({ sheet: true }, { schema: priceSchema(true) })
			try {
				if (slow.values.a) slow.values.a.price = 2
				if (slow.values.b) slow.values.b.price = 1
				slow.view.api.selectCells(ref('a', 'price'), ref('d', 'stock'))
				const waiting = slow.view.api.fillCells('down', 2)
				expect(waiting).toBeInstanceOf(Promise)
				expect(() => slow.view.api.undo()).toThrow('A value is checked now.')
				await expect(waiting).rejects.toThrow('The price must be 0 or more.')
				expect(slow.reports).toEqual([])
				// A fill that passes is reported at the answer, as one step.
				slow.view.api.selectCells(ref('a', 'price'), ref('c', 'stock'))
				await slow.view.api.fillCells('down', 2)
				expect(price(slow.values)).toEqual([2, 1, 0, 1.5])
				expect(slow.reports).toHaveLength(1)
			} finally {
				slow.view.unmount()
			}
		} finally {
			view.unmount()
		}
	})

	test('a fill from a pinned row into the rows of the list is refused', () => {
		const { view, reports } = sheetTable({ sheet: true, defaultRowPinning: { top: ['a'] } })
		try {
			view.api.selectCells(ref('a', 'stock'), ref('c', 'stock'))
			expect(() => view.api.fillCells('down')).toThrow(
				'Nothing was filled. A fill cannot go from pinned rows to the rows of the list.',
			)
			expect(reports).toEqual([])
			// Inside the rows of the list it works as always.
			view.api.selectCells(ref('b', 'stock'), ref('c', 'stock'))
			void view.api.fillCells('down')
			expect(reports).toHaveLength(1)
		} finally {
			view.unmount()
		}
	})

	test('it says what is wrong with its arguments and with the selected cells', () => {
		const { view } = sheetTable({ sheet: true })
		try {
			view.api.selectCells(ref('a', 'stock'), ref('c', 'stock'))
			expect(() => view.api.fillCells('left' as 'back')).toThrow(
				'Cells are filled "down", "up", "forward" or "back", not "left".',
			)
			expect(() => view.api.fillCells('down', 0)).toThrow(
				'A fill starts from 1 or more lines of the selected cells, not from 0.',
			)
			expect(() => view.api.fillCells('forward')).toThrow(
				'The selected cells hold 1 column, so a fill forward from 1 of them has no cell to fill.',
			)
			expect(() => view.api.fillCells('down', 3)).toThrow(
				'The selected cells hold 3 rows, so a fill down from 3 of them has no cell to fill.',
			)
			// Only cells that cannot be edited under the fill.
			view.api.selectCells(ref('a', 'kind'), ref('c', 'kind'))
			expect(() => view.api.fillCells('down')).toThrow(
				'Nothing was filled. No cell here can be edited.',
			)
		} finally {
			view.unmount()
		}
		const plain = sheetTable({ editable: true })
		try {
			expect(() => plain.view.api.fillCells('down')).toThrow('This table has no cell selection.')
		} finally {
			plain.view.unmount()
		}
	})
})

describe('the fill handle and the fill keys', () => {
	test('the handle sits in the end corner of the selected cells and moves with them', () => {
		const { view } = sheetTable({ sheet: true })
		try {
			const at = () =>
				[1, 2, 3, 4].flatMap((row) =>
					[0, 1, 2, 3].flatMap((col) =>
						view.api.fillHandleAt({ row, col }) ? [`${row}:${col}`] : [],
					),
				)
			// No cell is active yet.
			expect(at()).toEqual([])
			view.api.selectCells(ref('b', 'price'))
			expect(at()).toEqual(['2:2'])
			view.api.selectCells(ref('b', 'price'), ref('c', 'stock'))
			expect(at()).toEqual(['3:3'])
			// The corner is the end of the cells, whichever way they were selected.
			view.api.selectCells(ref('c', 'stock'), ref('a', 'name'))
			expect(at()).toEqual(['3:3'])
		} finally {
			view.unmount()
		}
	})

	test('`fillHandle` follows `sheet`, can be set alone, and needs cells that can be edited and selected', () => {
		const corner = (options: Parameters<typeof sheetTable>[0]) => {
			const { view } = sheetTable(options)
			try {
				view.api.selectCells(ref('b', 'price'))
				return view.api.fillHandleAt({ row: 2, col: 2 })
			} finally {
				view.unmount()
			}
		}
		expect(corner({ sheet: true })).toBe(true)
		expect(corner({ sheet: true, fillHandle: false })).toBe(false)
		expect(corner({ sheet: true, fillHandle: 'vertical' })).toBe(true)
		expect(corner({ editable: true, cellSelection: true, fillHandle: true })).toBe(true)
		expect(corner({ editable: true, cellSelection: true })).toBe(false)
		expect(corner({ sheet: true, editable: false })).toBe(false)
	})

	test('Control+D fills the selected cells down from their first row, and Control+R forward from their first column', async () => {
		const { view, values, reports, cell, press } = sheetTable({ sheet: true })
		try {
			view.api.selectCells(ref('a', 'stock'), ref('c', 'stock'))
			cell('a', 'stock').focus()
			await view.settle()
			const down = press(cell('a', 'stock'), 'd', { ctrlKey: true })
			expect(down.defaultPrevented).toBe(true)
			expect(stock(values)).toEqual([40, 40, 40, 60])
			expect(reports[0]?.details.reason).toBe('fill')

			view.api.selectCells(ref('d', 'price'), ref('d', 'stock'))
			cell('d', 'price').focus()
			await view.settle()
			expect(press(cell('d', 'price'), 'r', { ctrlKey: true }).defaultPrevented).toBe(true)
			expect(values.d?.stock).toBe(1.5)
			expect(reports).toHaveLength(2)
		} finally {
			view.unmount()
		}
	})

	test("with nothing to fill, the keys stay the browser's: Control+R loads the page again", async () => {
		const { view, reports, cell, press } = sheetTable({ sheet: true })
		try {
			view.api.selectCells(ref('a', 'stock'))
			cell('a', 'stock').focus()
			await view.settle()
			expect(press(cell('a', 'stock'), 'r', { ctrlKey: true }).defaultPrevented).toBe(false)
			expect(press(cell('a', 'stock'), 'd', { ctrlKey: true }).defaultPrevented).toBe(false)
			// One row of cells has nothing under it to fill, and one column nothing beside it.
			view.api.selectCells(ref('a', 'price'), ref('a', 'stock'))
			expect(press(cell('a', 'price'), 'd', { ctrlKey: true }).defaultPrevented).toBe(false)
			view.api.selectCells(ref('a', 'stock'), ref('b', 'stock'))
			expect(press(cell('a', 'stock'), 'r', { ctrlKey: true }).defaultPrevented).toBe(false)
			expect(reports).toEqual([])
		} finally {
			view.unmount()
		}
	})

	test('a direction of the handle holds for the keys too, and a table without the handle has no fill keys', async () => {
		const vertical = sheetTable({ sheet: true, fillHandle: 'vertical' })
		try {
			vertical.view.api.selectCells(ref('a', 'price'), ref('b', 'stock'))
			vertical.cell('a', 'price').focus()
			await vertical.view.settle()
			const { press, cell } = vertical
			expect(press(cell('a', 'price'), 'r', { ctrlKey: true }).defaultPrevented).toBe(false)
			expect(press(cell('a', 'price'), 'd', { ctrlKey: true }).defaultPrevented).toBe(true)
			expect(vertical.reports).toHaveLength(1)
		} finally {
			vertical.view.unmount()
		}
		const off = sheetTable({ sheet: true, fillHandle: false })
		try {
			off.view.api.selectCells(ref('a', 'price'), ref('b', 'stock'))
			off.cell('a', 'price').focus()
			await off.view.settle()
			expect(off.press(off.cell('a', 'price'), 'd', { ctrlKey: true }).defaultPrevented).toBe(false)
			expect(off.reports).toEqual([])
			// Code can still fill: the option is about the tools of a person.
			void off.view.api.fillCells('down')
			expect(off.reports).toHaveLength(1)
		} finally {
			off.view.unmount()
		}
	})

	test('a refused fill by a key is said at once, and changes nothing', async () => {
		const { view, values, reports, cell, press } = sheetTable({ sheet: true })
		try {
			const before = JSON.stringify(values)
			view.api.selectCells(ref('a', 'name'), ref('a', 'stock'))
			cell('a', 'name').focus()
			await view.settle()
			press(cell('a', 'name'), 'r', { ctrlKey: true })
			expect(reports).toEqual([])
			expect(JSON.stringify(values)).toBe(before)
			expect(JSON.stringify(view.announced.at(-1))).toContain('Nothing was filled. Price refuses')
		} finally {
			view.unmount()
		}
	})
})

describe('a drag of the fill handle', () => {
	// jsdom has no layout: the cell under the pointer is said by the test.
	function drag(options: Parameters<typeof sheetTable>[0] = { sheet: true }) {
		const made = sheetTable(options)
		let under: Element | null = null
		const page = made.view.root.ownerDocument
		// An own property over the one of the document, which the end of the test takes away again.
		page.elementFromPoint = () => under
		const move = async (rowId: string, columnId: string) => {
			under = made.cell(rowId, columnId)
			page.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 50, bubbles: true }))
			await made.view.settle()
		}
		const start = () => {
			const event = new MouseEvent('pointerdown', {
				button: 0,
				clientX: 5,
				clientY: 5,
				bubbles: true,
				cancelable: true,
			})
			made.view.api.fillHandle.pointerdown(event as PointerEvent)
		}
		const marks = () =>
			['a', 'b', 'c', 'd'].flatMap((id) => {
				const cell = made.cell(id, 'stock')
				return cell.hasAttribute('data-fill-target')
					? [`${id}: ${cell.getAttribute('data-fill-edge')}`]
					: []
			})
		const done = () => {
			Reflect.deleteProperty(page, 'elementFromPoint')
			made.view.unmount()
		}
		return { ...made, move, start, marks, done, page }
	}

	test('the root says that a drag runs, the cells to fill are marked as the pointer moves, and the lift fills them once', async () => {
		const { view, values, reports, move, start, marks, done, page } = drag()
		try {
			view.api.selectCells(ref('a', 'stock'), ref('b', 'stock'))
			await view.settle()
			expect(view.root.hasAttribute('data-filling')).toBe(false)
			start()
			await view.settle()
			// Written to the element without a render: a part hears a live key only through its readers.
			expect(view.root.getAttribute('data-filling')).toBe('')
			expect(marks()).toEqual([])

			await move('c', 'stock')
			expect(view.state.fillDraft?.target).toEqual({ top: 3, bottom: 3, left: 3, right: 3 })
			expect(marks()).toEqual(['c: top bottom left right'])
			await move('d', 'stock')
			expect(marks()).toEqual(['c: top left right', 'd: bottom left right'])
			// Back into the source: nothing to fill.
			await move('b', 'stock')
			expect(marks()).toEqual([])
			await move('d', 'stock')
			expect(reports).toEqual([])

			page.dispatchEvent(new MouseEvent('pointerup', { clientX: 5, clientY: 50, bubbles: true }))
			await view.settle()
			// 40, 90: the step is 50.
			expect(stock(values)).toEqual([40, 90, 140, 190])
			expect(reports).toHaveLength(1)
			expect(reports[0]?.details.reason).toBe('fill')
			expect(view.state.fillDraft).toBeNull()
			expect(view.root.hasAttribute('data-filling')).toBe(false)
			expect(marks()).toEqual([])
			expect(view.state.history).toEqual({ undo: 1, redo: 0 })
		} finally {
			done()
		}
	})

	test('Escape during the drag changes nothing', async () => {
		const { view, values, reports, move, start, marks, done, page } = drag()
		try {
			view.api.selectCells(ref('a', 'stock'))
			await view.settle()
			start()
			await move('c', 'stock')
			expect(marks()).toEqual(['b: top left right', 'c: bottom left right'])
			page.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
			await view.settle()
			expect(marks()).toEqual([])
			expect(view.root.hasAttribute('data-filling')).toBe(false)
			page.dispatchEvent(new MouseEvent('pointerup', { clientX: 5, clientY: 50, bubbles: true }))
			await view.settle()
			expect(reports).toEqual([])
			expect(stock(values)).toEqual([40, 90, 15, 60])
		} finally {
			done()
		}
	})

	test('a handle that fills along the rows only ignores a pointer that goes sideways', async () => {
		const { view, move, start, done } = drag({ sheet: true, fillHandle: 'vertical' })
		try {
			view.api.selectCells(ref('b', 'price'))
			await view.settle()
			start()
			await move('b', 'stock')
			expect(view.state.fillDraft).toBeNull()
			await move('d', 'price')
			expect(view.state.fillDraft?.target).toEqual({ top: 3, bottom: 4, left: 2, right: 2 })
		} finally {
			done()
		}
	})
})
