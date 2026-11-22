import { describe, expect, test } from 'vite-plus/test'
import { priceSchema, sheetTable } from './sheet/harness'

// The column `kind` cannot be edited, so Tab passes over it.

describe('the entry mode', () => {
	test('Tab and Shift+Tab on a cell walk the cells that can be edited, and leave the table at both ends', async () => {
		const { view, cell, press } = sheetTable({ entry: true })
		try {
			expect(view.root.hasAttribute('data-entry')).toBe(true)
			cell('a', 'name').focus()
			await view.settle()
			const walk: Element[] = []
			for (let step = 0; step < 7; step++) {
				expect(press(document.activeElement as Element, 'Tab').defaultPrevented).toBe(true)
				walk.push(document.activeElement as Element)
			}
			expect(walk).toEqual(
				[
					['a', 'price'],
					['a', 'stock'],
					['b', 'name'],
					['b', 'price'],
					['b', 'stock'],
					['c', 'name'],
					['c', 'price'],
				].map(([row = '', column = '']) => cell(row, column)),
			)
			cell('d', 'stock').focus()
			await view.settle()
			// After the last cell, the key is the browser's, and it takes focus out of the table.
			expect(press(cell('d', 'stock'), 'Tab').defaultPrevented).toBe(false)
			expect(press(cell('d', 'stock'), 'Tab', { shiftKey: true }).defaultPrevented).toBe(true)
			expect(document.activeElement).toBe(cell('d', 'price'))
			cell('a', 'name').focus()
			await view.settle()
			expect(press(cell('a', 'name'), 'Tab', { shiftKey: true }).defaultPrevented).toBe(false)
			// From a cell that cannot be edited, Tab goes on to the next one that can.
			cell('a', 'kind').focus()
			await view.settle()
			press(cell('a', 'kind'), 'Tab')
			expect(document.activeElement).toBe(cell('a', 'price'))
		} finally {
			view.unmount()
		}
	})

	test('one press opens the editor of the pressed cell, also when the release is on another element; a drag and a press with Shift open none', async () => {
		const { view, cell } = sheetTable({ entry: true })
		// A press as a browser sends it: the pointer goes down on a cell, and the click can reach another element.
		const press = (down: Element, init: MouseEventInit = {}, up: Element = down, moved = 0) => {
			down.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					button: 0,
					clientX: 10,
					clientY: 10,
					...init,
				}),
			)
			up.dispatchEvent(
				new MouseEvent('click', {
					bubbles: true,
					button: 0,
					clientX: 10 + moved,
					clientY: 10,
					...init,
				}),
			)
		}
		try {
			press(cell('a', 'kind'))
			expect(view.state.editing).toBeNull()
			press(cell('b', 'price'), { shiftKey: true })
			expect(view.state.editing).toBeNull()
			// A drag from one cell to another ends with a click on their row.
			press(cell('b', 'price'), {}, view.root, 120)
			expect(view.state.editing).toBeNull()
			// The columns moved under a still pointer, so the click went to the row: the pressed cell opens.
			press(cell('b', 'price'), {}, cell('b', 'stock').parentElement ?? view.root)
			expect(view.state.editing).toBe(JSON.stringify(['b', 'price']))
		} finally {
			view.unmount()
		}
	})

	test('Tab in the editor saves and goes to the next cell that can be edited, and after the last one lets the key go', async () => {
		const { view, values, reports, cell, field, press } = sheetTable({ entry: true })
		try {
			cell('a', 'name').focus()
			press(cell('a', 'name'), 'B')
			const input = field()
			input.value = 'Bar'
			expect(press(input, 'Tab').defaultPrevented).toBe(true)
			expect(values.a?.name).toBe('Bar')
			expect(reports[0]?.details.reason).toBe('tab-key')
			expect(document.activeElement).toBe(cell('a', 'price'))
			await view.settle()

			cell('d', 'stock').focus()
			press(cell('d', 'stock'), '7')
			const last = field()
			const event = press(last, 'Tab')
			expect(event.defaultPrevented).toBe(false)
			expect(values.d?.stock).toBe(7)
			expect(view.state.editing).toBeNull()
			expect(document.activeElement).toBe(cell('d', 'stock'))
		} finally {
			view.unmount()
		}
	})

	test('a refused text at the last cell keeps the editor open, and Tab stays in the field', async () => {
		const { view, values, cell, field, press } = sheetTable(
			{ entry: true },
			// The stock of the last row cannot be edited, so its price is the last cell that can.
			{ schema: priceSchema(), locked: ['d'] },
		)
		try {
			cell('d', 'price').focus()
			press(cell('d', 'price'), '-')
			const input = field()
			input.value = '-1'
			expect(press(input, 'Tab').defaultPrevented).toBe(true)
			expect(view.state.editing).toBe(JSON.stringify(['d', 'price']))
			expect(view.state.editErrors).toEqual({
				[JSON.stringify(['d', 'price'])]: 'The price must be 0 or more.',
			})
			input.value = '3'
			expect(press(input, 'Tab').defaultPrevented).toBe(false)
			expect(values.d?.price).toBe(3)
		} finally {
			view.unmount()
		}
	})
})
