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
// change, and a second change that goes back to it was "no change". The table
// now reports such a change itself (`createHeldKey` of `edit/turn.ts`), so the
// undo in the turn of the format is taken and the owner is told.

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

test('P2: with a key that the owner holds, a change back to the value of the last render in the same turn is told', () => {
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
		view.api.undo()
		expect(formats.at(-1)).toEqual({ cells: { a: { price: { bold: true } } } })

		// This undo goes back to `{}`, the value of the last render. It is told all the same.
		view.api.undo()
		expect(formats).toHaveLength(4)
		expect(formats.at(-1)).toEqual({})
		expect(view.api.getCellFormat('a', 'price')).toEqual({})
		view.api.undo()
		expect(values.a?.price).toBe(2.5)

		// The redo starts from the value that was told last.
		view.api.redo()
		view.api.redo()
		expect(formats.at(-1)).toEqual({ cells: { a: { price: { bold: true } } } })
	} finally {
		view.unmount()
	}
})

test('P2: an owner that refuses the change back is a refusal, and the step stays', () => {
	let refuse = false
	const { view } = sheetTable({
		sheet: true,
		cellFormats: {},
		onCellFormatsChange: (_value: CellFormats, details: { cancel(): void }) => {
			if (refuse) details.cancel()
		},
	})
	try {
		view.api.formatCells({ bold: true }, { from: ref('a', 'price') })
		refuse = true
		expect(() => view.api.undo()).toThrow('The change was not taken back.')
		expect(view.api.getCellFormat('a', 'price')).toEqual({ bold: true })
		refuse = false
		view.api.undo()
		expect(view.api.getCellFormat('a', 'price')).toEqual({})
	} finally {
		view.unmount()
	}
})

// A choice of a total always makes a new object, so it never is the state
// object of the last render: this case holds with and without the rule of
// `createHeldKey`. It keeps the second key on the same path.
test('P2: a choice of a total that the owner holds, and the choice back in the same turn', () => {
	const told: unknown[] = []
	const { view } = sheetTable({
		columnAggregates: {},
		onColumnAggregatesChange: (value: unknown) => {
			told.push(value)
		},
	})
	try {
		view.api.setColumnAggregate('price', 'sum')
		view.api.setColumnAggregate('price', undefined)
		expect(told).toEqual([{ price: 'sum' }, {}])
		// A choice that is the value of now reports nothing.
		view.api.setColumnAggregate('price', undefined)
		expect(told).toHaveLength(2)
	} finally {
		view.unmount()
	}
})
