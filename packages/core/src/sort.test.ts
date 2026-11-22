import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import { table, type TableOptions } from './table'

type Person = { id: string; name: string; team: string; score: number }

const people: Person[] = [
	{ id: 'a', name: 'Alice', team: 'Design', score: 70 },
	{ id: 'b', name: 'Edward', team: 'Platform', score: 20 },
	{ id: 'c', name: 'Hannah', team: 'Design', score: 45 },
]

const columns = [
	{ id: 'name', sortable: true },
	{ id: 'team', sortable: true },
	{ id: 'score', sortable: true },
]

function setup(options: Partial<TableOptions<Person>> = {}) {
	const cells = columns
		.map((column, col) => `<cell value="h|${column.id}" row="0" col="${col}" header>x</cell>`)
		.join('')
	return mount(
		table,
		{ rows: people, columns, ...options } as TableOptions,
		`<root aria-label="People"><header-row index="0">${cells}</header-row></root>`,
	)
}

/** A press on a header, as the button in it reports it, with the keys that are held. */
const press = (keys: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {}) => ({
	event: new MouseEvent('click', keys),
})

const sortOf = (view: ReturnType<typeof setup>) =>
	view.state.sort.map((rule) => `${rule.id} ${rule.desc ? 'desc' : 'asc'}`)

describe('how a press on a header changes the sort', () => {
	test('`modifier` is the default: a press replaces the sort, and Shift, Control or Command adds a column', () => {
		for (const keys of [{ shiftKey: true }, { ctrlKey: true }, { metaKey: true }]) {
			const view = setup()
			try {
				view.api.toggleSort('team', press())
				view.api.toggleSort('name', press(keys))
				expect(sortOf(view)).toEqual(['team asc', 'name asc'])
				expect(view.changes.at(-1)).toMatchObject({ key: 'sort', reason: 'press' })
				// A column of the sort keeps its place while its order turns, and leaves on the third press.
				view.api.toggleSort('team', press(keys))
				expect(sortOf(view)).toEqual(['team desc', 'name asc'])
				view.api.toggleSort('team', press(keys))
				expect(sortOf(view)).toEqual(['name asc'])
				view.api.toggleSort('score', press())
				expect(sortOf(view)).toEqual(['score asc'])
			} finally {
				view.unmount()
			}
		}
	})

	test('`none`: one column at a time, and a modifier key changes nothing', () => {
		const view = setup({ multiSort: 'none' })
		try {
			view.api.toggleSort('team', press())
			view.api.toggleSort('name', press({ shiftKey: true }))
			expect(sortOf(view)).toEqual(['name asc'])
			view.api.toggleSort('score', press({ ctrlKey: true, metaKey: true }))
			expect(sortOf(view)).toEqual(['score asc'])
		} finally {
			view.unmount()
		}
	})

	test('`always`: each press adds its column, with a key or without', () => {
		const view = setup({ multiSort: 'always' })
		try {
			view.api.toggleSort('team', press())
			view.api.toggleSort('name', press())
			view.api.toggleSort('score', press({ shiftKey: true }))
			expect(sortOf(view)).toEqual(['team asc', 'name asc', 'score asc'])
			view.api.toggleSort('name', press())
			view.api.toggleSort('name', press())
			expect(sortOf(view)).toEqual(['team asc', 'score asc'])
			// A caller that says `append: false` asks for one column, and gets it.
			view.api.toggleSort('name', { append: false })
			expect(sortOf(view)).toEqual(['name asc'])
		} finally {
			view.unmount()
		}
	})

	test('Enter on a header follows the mode, with each modifier key', async () => {
		const modifier = setup()
		const none = setup({ multiSort: 'none' })
		const always = setup({ multiSort: 'always' })
		try {
			await modifier.keys('Tab', 'Enter', 'ArrowRight', 'Shift+Enter')
			expect(sortOf(modifier)).toEqual(['name asc', 'team asc'])
			await modifier.keys('ArrowRight', 'Control+Enter')
			expect(sortOf(modifier)).toEqual(['name asc', 'team asc', 'score asc'])
			expect(modifier.changes.at(-1)).toMatchObject({
				key: 'sort',
				reason: 'press',
				source: 'keyboard',
			})
			await modifier.keys('Meta+Enter')
			expect(sortOf(modifier)).toEqual(['name asc', 'team asc', 'score desc'])
			await modifier.keys('Enter')
			expect(sortOf(modifier)).toEqual([])

			await none.keys('Tab', 'Enter', 'ArrowRight', 'Shift+Enter')
			expect(sortOf(none)).toEqual(['team asc'])
			await none.keys('ArrowRight', 'Control+Enter')
			expect(sortOf(none)).toEqual(['score asc'])

			await always.keys('Tab', 'Enter', 'ArrowRight', 'Enter')
			expect(sortOf(always)).toEqual(['name asc', 'team asc'])
		} finally {
			modifier.unmount()
			none.unmount()
			always.unmount()
		}
	})

	test('an action that asks for `append` in the mode `none` fails with the reason, and changes nothing', () => {
		const view = setup({ multiSort: 'none', defaultSort: [{ id: 'team' }] })
		try {
			const reason =
				'This table sorts by one column at a time: its `multiSort` option is "none", so `append` cannot add a column to the sort. Leave `append` out, or set `multiSort` to "modifier" or "always".'
			expect(() => view.api.toggleSort('name', { append: true })).toThrow(reason)
			expect(() => view.api.sortBy('name', 'asc', { append: true })).toThrow(reason)
			expect(sortOf(view)).toEqual(['team asc'])
			expect(() => view.api.toggleSort('name', { append: 'yes' as never })).toThrow(
				'`append` of a sort is true or false.',
			)
			// Without `append`, both act in the mode.
			view.api.sortBy('name', 'desc')
			view.api.toggleSort('score')
			expect(sortOf(view)).toEqual(['score asc'])
		} finally {
			view.unmount()
		}
		const wrong = setup({ multiSort: true as never })
		try {
			expect(() => wrong.api.toggleSort('name')).toThrow(
				'`multiSort` is one of: none, modifier, always. It is "true".',
			)
		} finally {
			wrong.unmount()
		}
	})

	test('code that names its columns can add one in the modes `modifier` and `always`', () => {
		for (const multiSort of ['modifier', 'always'] as const) {
			const view = setup({ multiSort })
			try {
				view.api.sortBy('team')
				view.api.sortBy('score', 'desc', { append: true })
				expect(sortOf(view)).toEqual(['team asc', 'score desc'])
				// `sortBy` asks for one column unless it says otherwise, in every mode.
				view.api.sortBy('name')
				expect(sortOf(view)).toEqual(['name asc'])
				view.api.toggleSort('team', { append: true })
				expect(sortOf(view)).toEqual(['name asc', 'team asc'])
			} finally {
				view.unmount()
			}
		}
	})

	test('a sort of the owner with more columns than the mode allows stays, and sorts', () => {
		const view = setup({
			multiSort: 'none',
			defaultSort: [{ id: 'team' }, { id: 'score', desc: true }],
		})
		try {
			expect(view.api.rows().map((row) => row.id)).toEqual(['a', 'c', 'b'])
			expect(sortOf(view)).toEqual(['team asc', 'score desc'])
			// The next press is a press in the mode: one column.
			view.api.toggleSort('score', press())
			expect(sortOf(view)).toEqual([])
		} finally {
			view.unmount()
		}
	})

	test('with rows from a server, the sort is a request that follows the same rules', () => {
		const view = setup({ manualSort: true, multiSort: 'always', alwaysSorted: true })
		try {
			view.api.toggleSort('team', press())
			view.api.toggleSort('score', press())
			expect(sortOf(view)).toEqual(['team asc', 'score asc'])
			// The table did not sort: the rows are as the server sent them.
			expect(view.api.rows().map((row) => row.id)).toEqual(['a', 'b', 'c'])
		} finally {
			view.unmount()
		}
	})
})

describe('a table that keeps its sort', () => {
	test('a press on the only column of the sort turns the order and never clears it', async () => {
		const view = setup({ alwaysSorted: true })
		try {
			// A table without a sort starts without one: the option does not sort it.
			expect(sortOf(view)).toEqual([])
			view.api.toggleSort('name', press())
			view.api.toggleSort('name', press())
			expect(sortOf(view)).toEqual(['name desc'])
			view.api.toggleSort('name', press())
			expect(sortOf(view)).toEqual(['name asc'])
			expect(view.changes.at(-1)).toMatchObject({ key: 'sort', reason: 'press' })
			// The keyboard and a call without an event follow the same rule.
			await view.keys('Tab', 'Enter', 'Enter')
			expect(sortOf(view)).toEqual(['name asc'])
			view.api.toggleSort('name')
			view.api.toggleSort('name')
			expect(sortOf(view)).toEqual(['name asc'])
			// Another column takes the sort over.
			view.api.toggleSort('team', press())
			expect(sortOf(view)).toEqual(['team asc'])
		} finally {
			view.unmount()
		}
	})

	test('with several columns, the third press takes a column out while another one stays', () => {
		const view = setup({
			alwaysSorted: true,
			defaultSort: [
				{ id: 'team', desc: true },
				{ id: 'name', desc: true },
			],
		})
		try {
			view.api.toggleSort('team', press({ shiftKey: true }))
			expect(sortOf(view)).toEqual(['name desc'])
			view.api.toggleSort('name', press({ shiftKey: true }))
			expect(sortOf(view)).toEqual(['name asc'])
		} finally {
			view.unmount()
		}
	})

	test('without the option, the third press clears the sort, and code can clear it in both', () => {
		const off = setup()
		const on = setup({ alwaysSorted: true, defaultSort: [{ id: 'name' }] })
		try {
			off.api.toggleSort('name', press())
			off.api.toggleSort('name', press())
			off.api.toggleSort('name', press())
			expect(sortOf(off)).toEqual([])
			// `sortBy` with `null` is the word of the owner, and the sort is the owner's.
			on.api.sortBy('name', null)
			expect(sortOf(on)).toEqual([])
		} finally {
			off.unmount()
			on.unmount()
		}
	})
})
