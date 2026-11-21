import { createInlineEdit, definePrimitive } from '@ui-sdk/core'
import { mount } from '@ui-sdk/core/testing'
import { expect, test } from 'vite-plus/test'

// A proof of `createInlineEdit` of UI SDK 0.1.0-beta.13, which is experimental
// and was not part of the first proof. The table builds its cell editing on
// the rules that these tests show. When a new UI SDK version changes a rule,
// a test here fails before the table does.

const proof = definePrimitive({
	name: 'edit-proof',
	options: { values: 'value', refuse: 'value' },
	state: (_options: { values: Record<string, string>; refuse?: (text: string) => boolean }) => ({
		editing: null as string | null,
	}),
	api: (context) => {
		const commits: [string, string, string][] = []
		const edit = createInlineEdit(context, {
			key: 'editing',
			value: (id) => context.options().values[id] ?? '',
			commit: (id, text, details) => {
				commits.push([id, text, details.reason])
				if (context.options().refuse?.(text)) return false
				context.options().values[id] = text
				return true
			},
			disabled: (id) => id === 'locked',
		})
		return { edit, commits }
	},
	slots: (slot) => ({
		root: slot({}),
		cell: slot<{ value: string }>({
			props: { value: 'string' },
			role: 'gridcell',
			focus: 'roving',
			keys: ['Enter', 'F2'],
			attrs: () => ({ tabindex: '0' }),
			on: {
				keydown: (event, { api, key }) => {
					api.edit.keydown(event, key)
				},
				dblclick: (event, { api, key }) => {
					api.edit.dblclick(event, key)
				},
			},
		}),
	}),
})

function setup(refuse?: (text: string) => boolean) {
	const values: Record<string, string> = { a: 'one', b: 'two', locked: 'fixed' }
	const view = mount(
		proof,
		{ values, refuse },
		'<root><cell value="a">one</cell><cell value="b">two</cell><cell value="locked">fixed</cell></root>',
	)
	const cell = (id: string) => view.part('cell', id) as HTMLElement
	/** Renders the input for the cell that is edited, as a renderer does after the state changed. */
	function input(): HTMLInputElement {
		const el = document.createElement('input')
		const id = view.state.editing
		if (id === null) throw new Error('No cell is edited.')
		cell(id).append(el)
		el.addEventListener('keydown', (event) => view.api.edit.inputKeydown(event))
		const leave = view.api.edit.bindInput(el)
		el.addEventListener('focusout', (event) => {
			if (view.api.edit.end('focus-out', event)) {
				leave()
				el.remove()
			}
		})
		return el
	}
	return { view, values, cell, input }
}

test('Enter and F2 start an edit with the value, and a character starts with that character', async () => {
	const { view, cell, input } = setup()
	try {
		cell('a').focus()
		await view.keys('Enter')
		expect(view.state.editing).toBe('a')
		const first = input()
		expect(first.value).toBe('one')
		expect(document.activeElement).toBe(first)
		view.api.edit.cancel()
		expect(view.state.editing).toBeNull()

		cell('a').focus()
		await view.keys('F2')
		expect(view.state.editing).toBe('a')
		view.api.edit.cancel()

		cell('b').focus()
		await view.keys('x')
		expect(view.state.editing).toBe('b')
		expect(input().value).toBe('x')
		view.api.edit.cancel()

		// A key with Control is a command, not text.
		cell('b').focus()
		await view.keys('Control+c')
		expect(view.state.editing).toBeNull()
		// Space is not text for the behavior, so it stays free for the row selection.
		await view.keys('Space')
		expect(view.state.editing).toBeNull()
	} finally {
		view.unmount()
	}
})

test('a disabled id does not start, by key or by call', async () => {
	const { view, cell } = setup()
	try {
		cell('locked').focus()
		await view.keys('Enter')
		expect(view.state.editing).toBeNull()
		expect(view.api.edit.start('locked')).toBe(false)
	} finally {
		view.unmount()
	}
})

test('Enter saves, Escape puts the text back, and the same text saves nothing', async () => {
	const { view, values, cell, input } = setup()
	try {
		cell('a').focus()
		await view.keys('Enter')
		const field = input()
		field.value = 'uno'
		await view.keys('Enter')
		expect(view.api.commits).toEqual([['a', 'uno', 'enter-key']])
		expect(values.a).toBe('uno')
		expect(view.state.editing).toBeNull()
		// The input is still in the page and has focus. The renderer removes it.
		expect(document.activeElement).toBe(field)
		field.remove()

		cell('a').focus()
		await view.keys('Enter')
		const again = input()
		again.value = 'changed'
		await view.keys('Escape')
		expect(view.state.editing).toBeNull()
		expect(values.a).toBe('uno')
		expect(view.api.commits).toHaveLength(1)
		again.remove()

		// The same text ends the edit and calls no commit.
		cell('a').focus()
		await view.keys('Enter')
		input()
		await view.keys('Enter')
		expect(view.state.editing).toBeNull()
		expect(view.api.commits).toHaveLength(1)
	} finally {
		view.unmount()
	}
})

test('a refused commit keeps the edit open, for Enter, for Tab and for focus that leaves', async () => {
	const { view, values, cell, input } = setup((text) => text === 'bad')
	try {
		cell('a').focus()
		await view.keys('Enter')
		const field = input()
		field.value = 'bad'
		await view.keys('Enter')
		expect(view.state.editing).toBe('a')
		expect(values.a).toBe('one')
		expect(field.value).toBe('bad')

		const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
		expect(view.api.edit.inputKeydown(tab)).toBe(false)
		expect(view.state.editing).toBe('a')

		expect(view.api.edit.end('focus-out')).toBe(false)
		expect(view.state.editing).toBe('a')
		expect(view.api.commits.map((commit) => commit[2])).toEqual([
			'enter-key',
			'tab-key',
			'focus-out',
		])

		// A start on another cell while this one is open drops the refused text
		// without a word. So the table ends an open edit itself before it starts
		// the next one, and does not start when the edit stays open.
		expect(view.api.edit.start('b', { reason: 'imperative' })).toBe(true)
		expect(view.state.editing).toBe('b')
		expect(view.api.commits).toHaveLength(3)
	} finally {
		view.unmount()
	}
})

test('Tab saves and says so, and focus goes back to where the edit started', async () => {
	const { view, values, cell, input } = setup()
	try {
		cell('b').focus()
		await view.keys('F2')
		const field = input()
		field.value = 'dos'
		const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
		expect(view.api.edit.inputKeydown(tab)).toBe(true)
		expect(values.b).toBe('dos')
		expect(view.state.editing).toBeNull()
		// The key is used, so the browser does not move focus. Focus is still in
		// the input: the table moves it, to the cell or to the next cell.
		expect(tab.defaultPrevented).toBe(true)
		expect(document.activeElement).toBe(field)
	} finally {
		view.unmount()
	}
})

test('a double click starts an edit', () => {
	const { view, cell } = setup()
	try {
		cell('a').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
		expect(view.state.editing).toBe('a')
	} finally {
		view.unmount()
	}
})
