import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import { cellKey } from './edit/cells'
import { createFormulaEngine } from './formulas'
import type { ColumnDef } from './rows'
import { table, type TableOptions } from './table'

// The option `numberKeyboard` of a column: the editor of a cell asks a phone
// for its number keyboard, unless the field can hold a formula or the cell
// shows no number.

type Line = { id: string; price: number; qty: number }

const rows: Line[] = [
	{ id: 'a', price: 2, qty: 3 },
	{ id: 'b', price: 1.5, qty: 4 },
]

function editorOf(
	columns: ColumnDef<Line>[],
	more: Partial<TableOptions> = {},
	columnId = 'price',
) {
	const key = cellKey('a', columnId)
	const view = mount(
		table,
		{ rows, columns, editable: true, ...more } as TableOptions,
		`<root aria-label="Lines"><row value="a" index="1"><cell value="a|${columnId}" row="1" col="0"><editor value='${key}' as="input"></editor></cell></row></root>`,
	)
	const editor = view.part('editor', key) as HTMLElement
	return { view, editor }
}

const priced = (extra: Partial<ColumnDef<Line>> = {}): ColumnDef<Line>[] => [
	{ id: 'price', header: 'Price', format: 'decimal', numberKeyboard: true, ...extra },
	{ id: 'qty', header: 'Quantity' },
]

describe('the number keyboard of the editor', () => {
	test('is asked for with the option, and the editor is as before without it', () => {
		const on = editorOf(priced())
		const off = editorOf(priced({ numberKeyboard: undefined }))
		try {
			expect(on.editor.getAttribute('inputmode')).toBe('decimal')
			expect(off.editor.hasAttribute('inputmode')).toBe(false)
			// Without the option, the editor has the attributes of before and nothing more.
			const names = (el: HTMLElement) => el.getAttributeNames().sort()
			expect(names(off.editor)).toEqual(names(on.editor).filter((name) => name !== 'inputmode'))
		} finally {
			on.view.unmount()
			off.view.unmount()
		}
	})

	test('is held back where the field can hold a formula, and given with `allowFormula: false`', () => {
		const formulas = { formulas: createFormulaEngine() }
		const free = editorOf(priced(), formulas)
		const plain = editorOf(priced({ allowFormula: false }), formulas)
		try {
			expect(free.editor.hasAttribute('inputmode')).toBe(false)
			expect(plain.editor.getAttribute('inputmode')).toBe('decimal')
		} finally {
			free.view.unmount()
			plain.view.unmount()
		}
	})

	test('is held back in a cell of a computed column, whose field shows the formula of the column', () => {
		const { view, editor } = editorOf(
			[
				{ id: 'price', header: 'Price' },
				{ id: 'qty', header: 'Quantity', numberKeyboard: true, allowFormula: false },
			],
			{
				formulas: createFormulaEngine(),
				defaultCellFormulas: { columns: { qty: '=[price]*2' } },
			},
			'qty',
		)
		try {
			expect(editor.hasAttribute('inputmode')).toBe(false)
		} finally {
			view.unmount()
		}
	})

	test('follows the format of the cell: not for a date, yes for a percentage', () => {
		const date = editorOf(priced(), {
			defaultCellFormats: { cells: { a: { price: { format: 'date' } } } },
		})
		const share = editorOf(priced({ format: 'text' }), {
			defaultCellFormats: { cells: { a: { price: { format: 'percentage' } } } },
		})
		const bare = editorOf(priced({ format: undefined }))
		try {
			expect(date.editor.hasAttribute('inputmode')).toBe(false)
			expect(share.editor.getAttribute('inputmode')).toBe('decimal')
			// A column without a format gets the keyboard.
			expect(bare.editor.getAttribute('inputmode')).toBe('decimal')
		} finally {
			date.view.unmount()
			share.view.unmount()
			bare.view.unmount()
		}
	})
})
