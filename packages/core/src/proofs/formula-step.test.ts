import { expect, test } from 'vite-plus/test'
import type { CellFormats } from '../sheet'
import { sheetTable } from '../sheet/harness'

// P2 of the formula work: one act changes the values of cells and an
// owner-held state key, and an undo comes in the same turn. A formula entry
// will do this with `onCellEdit` and `cellFormulas`. The key does not exist
// yet, so `cellFormats` stands in for it: it is held the same way (in
// `sync`, outside `controlled`, read through `createTurnValue`).
//
// What the proof found: `createChange` of UI SDK 0.1.0-beta.13 compares a new
// value with the state of the last render, not with what it told the owner in
// this turn. An owner that holds the key passes the value back at its next
// render, so in one turn the state is still the value before the first
// change. A second change that goes back to that value is "no change" for
// `createChange`: it returns false and calls no listener. The table takes the
// false for a refusal. So an undo of a format in the turn of the format fails
// with "The change was not taken back", and the owner keeps the format that
// was undone. The same holds for `cellFormulas` until the table tells such a
// change itself (`dispatch` of `@ui-sdk/core` calls the listener without the
// comparison).

const ref = (rowId: string, columnId: string) => ({ rowId, columnId })

test('P2: values and a key that the table holds change in one turn, and undos in the same turn put both back', () => {
	const { view, values, told } = sheetTable({ sheet: true })
	try {
		void view.api.editCell('a', 'price', 3)
		view.api.formatCells({ bold: true }, { from: ref('a', 'price') })
		view.api.formatCells({ italic: true }, { from: ref('a', 'stock') })
		expect(view.api.getCellFormat('a', 'stock')).toEqual({ italic: true })

		view.api.undo()
		view.api.undo()
		expect(view.api.getCellFormat('a', 'price')).toEqual({})
		view.api.undo()
		expect(values.a?.price).toBe(2.5)
		expect(told()).toEqual([[['a', 'price', 2.5, 3]], [['a', 'price', 3, 2.5]]])

		view.api.redo()
		view.api.redo()
		expect(values.a?.price).toBe(3)
		expect(view.api.getCellFormat('a', 'price')).toEqual({ bold: true })
	} finally {
		view.unmount()
	}
})

test('P2: with a key that the owner holds, a change back to the value of the last render in the same turn is lost', () => {
	const formats: CellFormats[] = []
	const { view, values } = sheetTable({
		sheet: true,
		cellFormats: {},
		onCellFormatsChange: (value: CellFormats) => {
			formats.push(value)
		},
	})
	try {
		// The act: a value, then the key, as a formula entry will report them.
		void view.api.editCell('a', 'price', 3)
		view.api.formatCells({ bold: true }, { from: ref('a', 'price') })
		expect(values.a?.price).toBe(3)
		expect(formats).toEqual([{ cells: { a: { price: { bold: true } } } }])
		// The turn value holds: the table reads what it told, not the state of the last render.
		expect(view.api.getCellFormat('a', 'price')).toEqual({ bold: true })
		view.api.formatCells({ italic: true }, { from: ref('a', 'stock') })
		expect(formats.at(-1)).toEqual({
			cells: { a: { price: { bold: true }, stock: { italic: true } } },
		})
		view.api.undo()
		expect(formats.at(-1)).toEqual({ cells: { a: { price: { bold: true } } } })

		// The fault: this undo would go back to `{}`, the value of the last
		// render, and `createChange` drops it. The owner is never told.
		expect(() => view.api.undo()).toThrow('The change was not taken back.')
		expect(formats).toHaveLength(3)
		expect(formats.at(-1)).toEqual({ cells: { a: { price: { bold: true } } } })
	} finally {
		view.unmount()
	}
})
