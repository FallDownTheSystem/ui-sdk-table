import { mount } from '@ui-sdk/core/testing'
import { describe, expect, test } from 'vite-plus/test'
import {
	applyEdits,
	cellKey,
	checkValue,
	parseCellKey,
	parseText,
	sameValue,
	type CellEdit,
	type StandardSchemaV1,
} from './edit'
import type { ColumnDef } from './rows'
import { table, type TableEditDetails, type TableOptions } from './table'

type Person = { id: string; name: string; team: string; score: number }

const people = (): Person[] => [
	{ id: 'a', name: 'Aino', team: 'Design', score: 70 },
	{ id: 'b', name: 'Eero', team: 'Platform', score: 20 },
	{ id: 'c', name: 'Helmi', team: 'Design', score: 45 },
]

const atLeastZero: StandardSchemaV1 = {
	'~standard': {
		version: 1,
		vendor: 'test',
		validate: (value) =>
			typeof value === 'number' && value >= 0
				? { value }
				: { issues: [{ message: 'The score must be 0 or more.' }] },
	},
}

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'team', header: 'Team', editable: false },
	{ id: 'score', header: 'Score', aggregate: 'sum', schema: atLeastZero },
]

const notNumber = (text: string) => `"${text}" is not a number.`

/** Markup for the rows of the table, in the way a renderer writes it. Grid row 0 is the header row. */
function markup(ids: readonly string[]): string {
	const cells = (id: string, row: number, header = false) =>
		columns
			.map(
				(column, col) =>
					`<cell value="${id}|${column.id}" row="${row}" col="${col}"${header ? ' header' : ''}>x</cell>`,
			)
			.join('')
	const rows = ids.map(
		(id, index) => `<row value="${id}" index="${index + 1}">${cells(id, index + 1)}</row>`,
	)
	const foot = `<plain-row index="${ids.length + 1}" footer>${cells('f', ids.length + 1)}</plain-row>`
	return `<root aria-label="People"><header-row index="0">${cells('h', 0, true)}</header-row>${rows.join('')}${foot}</root>`
}

function setup(options: Partial<TableOptions<Person>> = {}, ids = ['a', 'b', 'c']) {
	const rows = people()
	const edits: { edits: readonly CellEdit<Person>[]; details: TableEditDetails }[] = []
	const view = mount(
		table,
		{
			rows,
			columns,
			editable: true,
			onCellEdit: (list: readonly CellEdit<Person>[], details: TableEditDetails) =>
				edits.push({ edits: list, details }),
			...options,
		} as TableOptions,
		markup(ids),
	)
	const cell = (rowId: string, columnId: string) =>
		view.part('cell', `${rowId}|${columnId}`) as HTMLElement
	/** Renders the text field of the cell that is edited, as a renderer does after the state changed. */
	function field(): HTMLInputElement {
		const ref = parseCellKey(view.state.editing ?? '')
		if (!ref) throw new Error('No cell is edited.')
		const el = document.createElement('input')
		cell(ref.rowId, ref.columnId).append(el)
		el.addEventListener('keydown', (event) => {
			view.api.edit.inputKeydown(event)
			event.stopPropagation()
		})
		el.addEventListener('focusout', (event) => view.api.edit.focusout(event, view.root))
		view.api.edit.bindInput(el)
		return el
	}
	return { view, rows, edits, cell, field }
}

describe('values of an edit', () => {
	test('a cell id holds any row id and column id', () => {
		const id = cellKey('a|b"c', 'x,y')
		expect(parseCellKey(id)).toEqual({ rowId: 'a|b"c', columnId: 'x,y' })
		expect(parseCellKey('h|name')).toBeUndefined()
		expect(parseCellKey('[1,2]')).toBeUndefined()
	})

	test('a text becomes the kind of value that the cell holds', () => {
		const row = { count: 3, done: true, when: new Date('2026-01-02T00:00:00Z'), note: 'x' }
		const parse = (text: string, column: ColumnDef) => parseText(text, row, column, notNumber)
		expect(parse('12.5', { id: 'count' })).toEqual({ value: 12.5 })
		expect(parse('  ', { id: 'count' })).toEqual({ value: null })
		expect(parse('1o', { id: 'count' })).toEqual({ issues: ['"1o" is not a number.'] })
		expect(parse('False', { id: 'done' })).toEqual({ value: false })
		expect(parse('yes', { id: 'done' })).toEqual({
			issues: ['The value must be "true" or "false".'],
		})
		expect(parse('2026-03-04', { id: 'when' })).toEqual({ value: new Date('2026-03-04') })
		expect(parse('soon', { id: 'when' })).toEqual({ issues: ['"soon" is not a date.'] })
		expect(parse('12', { id: 'note' })).toEqual({ value: '12' })
		// A column of numbers with an empty cell still reads a number.
		expect(parse('7', { id: 'empty', format: 'integer' })).toEqual({ value: 7 })
		// The `parse` of the column wins.
		expect(parse('7', { id: 'note', parse: (text) => `#${text}` })).toEqual({ value: '#7' })
	})

	test('a schema passes a value, refuses it, or answers later', async () => {
		expect(checkValue(undefined, 'x')).toEqual({ value: 'x' })
		expect(checkValue(atLeastZero, 4)).toEqual({ value: 4 })
		expect(checkValue(atLeastZero, -4)).toEqual({ issues: ['The score must be 0 or more.'] })
		const later: StandardSchemaV1 = {
			'~standard': {
				version: 1,
				vendor: 'test',
				validate: (value) => Promise.resolve({ value: String(value).toUpperCase() }),
			},
		}
		const result = checkValue(later, 'x')
		expect(result).toBeInstanceOf(Promise)
		expect(await result).toEqual({ value: 'X' })
	})

	test('two values that show the same are the same', () => {
		expect(sameValue(null, '')).toBe(true)
		expect(sameValue(undefined, null)).toBe(true)
		expect(sameValue(0, '')).toBe(false)
		expect(sameValue(new Date(5), new Date(5))).toBe(true)
		expect(sameValue('a', 'b')).toBe(false)
	})

	test('`applyEdits` gives new objects for the rows that changed and keeps the others', () => {
		const rows = people()
		const [a, b, c] = rows as [Person, Person, Person]
		const name = columns[0] as ColumnDef<Person>
		const score: ColumnDef<Person> = { id: 'points', key: 'score' }
		const next = applyEdits(rows, [
			{ rowId: 'a', columnId: 'name', row: a, column: name, value: 'Anna', previous: 'Aino' },
			{ rowId: 'a', columnId: 'points', row: a, column: score, value: 1, previous: 70 },
			{ rowId: 'c', columnId: 'name', row: c, column: name, value: 'Hilla', previous: 'Helmi' },
		])
		expect(next).toEqual([
			{ id: 'a', name: 'Anna', team: 'Design', score: 1 },
			b,
			{ id: 'c', name: 'Hilla', team: 'Design', score: 45 },
		])
		expect(next[1]).toBe(b)
		expect(next).not.toBe(rows)
		// The caller's rows are as they were.
		expect(a).toEqual({ id: 'a', name: 'Aino', team: 'Design', score: 70 })
	})
})

describe('cell editing', () => {
	test('Enter opens the editor with the value, and Enter saves through `onCellEdit`', async () => {
		const { view, rows, edits, cell, field } = setup()
		try {
			expect(cell('a', 'name').hasAttribute('data-editable')).toBe(true)
			expect(cell('a', 'name').hasAttribute('aria-readonly')).toBe(false)
			// A cell that cannot be edited says so, because the cells around it can.
			expect(cell('a', 'team').getAttribute('aria-readonly')).toBe('true')
			expect(cell('h', 'name').hasAttribute('aria-readonly')).toBe(false)
			expect(cell('f', 'name').hasAttribute('aria-readonly')).toBe(false)

			cell('a', 'name').focus()
			await view.keys('Enter')
			expect(view.state.editing).toBe(cellKey('a', 'name'))
			expect(cell('a', 'name').hasAttribute('data-editing')).toBe(true)
			expect(cell('b', 'name').hasAttribute('data-editing')).toBe(false)
			const input = field()
			expect(input.value).toBe('Aino')
			expect(document.activeElement).toBe(input)

			input.value = 'Anna'
			await view.keys('Enter')
			expect(view.state.editing).toBeNull()
			expect(edits).toHaveLength(1)
			expect(edits[0]?.edits).toEqual([
				{
					rowId: 'a',
					columnId: 'name',
					row: rows[0],
					column: columns[0],
					value: 'Anna',
					previous: 'Aino',
				},
			])
			expect(edits[0]?.edits[0]?.row).toBe(rows[0])
			expect(edits[0]?.details).toMatchObject({ reason: 'enter-key', source: 'keyboard' })
			// The table does not write the value: the row is the caller's.
			expect(rows[0]?.name).toBe('Aino')
			// Focus is back on the cell, so the arrow keys go on from it.
			expect(document.activeElement).toBe(cell('a', 'name'))
		} finally {
			view.unmount()
		}
	})

	test('F2 and a character open the editor, and a cell that cannot be edited stays closed', async () => {
		const { view, cell, field } = setup()
		try {
			cell('b', 'score').focus()
			await view.keys('F2')
			expect(view.state.editing).toBe(cellKey('b', 'score'))
			expect(field().value).toBe('20')
			await view.keys('Escape')
			expect(view.state.editing).toBeNull()
			expect(document.activeElement).toBe(cell('b', 'score'))

			await view.keys('7')
			expect(view.state.editing).toBe(cellKey('b', 'score'))
			// The character that opened the editor is its first text.
			expect(field().value).toBe('7')
			await view.keys('Escape')

			cell('b', 'team').focus()
			await view.keys('Enter')
			await view.keys('x')
			expect(view.state.editing).toBeNull()
			// The header row and the footer row hold no values.
			cell('h', 'name').focus()
			await view.keys('F2')
			cell('f', 'name').focus()
			await view.keys('F2')
			expect(view.state.editing).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('a value that the schema refuses keeps the editor open, with the reason', async () => {
		const { view, edits, cell, field } = setup()
		try {
			cell('b', 'score').focus()
			await view.keys('Enter')
			const input = field()
			input.value = '-5'
			await view.keys('Enter')
			const id = cellKey('b', 'score')
			expect(view.state.editing).toBe(id)
			expect(view.state.editErrors).toEqual({ [id]: 'The score must be 0 or more.' })
			expect(view.api.edit.error(view.state, id)).toBe('The score must be 0 or more.')
			expect(view.announced).toContain('The score must be 0 or more.')
			expect(document.activeElement).toBe(input)
			expect(edits).toHaveLength(0)

			// Tab does not leave a value that is refused.
			await view.keys('Tab')
			expect(view.state.editing).toBe(id)
			expect(document.activeElement).toBe(input)

			// A text that is no number has its own reason.
			input.value = 'many'
			await view.keys('Enter')
			expect(view.state.editErrors).toEqual({ [id]: '"many" is not a number.' })
			// A person who changes the text has seen the reason.
			input.dispatchEvent(new Event('input', { bubbles: true }))
			expect(view.state.editErrors).toEqual({})

			input.value = '30'
			await view.keys('Enter')
			expect(view.state.editing).toBeNull()
			expect(edits[0]?.edits[0]).toMatchObject({ rowId: 'b', value: 30, previous: 20 })
		} finally {
			view.unmount()
		}
	})

	test('Escape puts the value back and gives focus back to the cell', async () => {
		const { view, edits, cell, field } = setup()
		try {
			cell('c', 'score').focus()
			await view.keys('Enter')
			const input = field()
			input.value = '-1'
			await view.keys('Enter')
			expect(Object.keys(view.state.editErrors)).toHaveLength(1)
			await view.keys('Escape')
			expect(view.state.editing).toBeNull()
			expect(view.state.editErrors).toEqual({})
			expect(edits).toHaveLength(0)
			expect(document.activeElement).toBe(cell('c', 'score'))
		} finally {
			view.unmount()
		}
	})

	test('Tab saves and goes to the next cell, and Shift+Tab to the cell before', async () => {
		const { view, edits, cell, field } = setup()
		try {
			cell('a', 'score').focus()
			await view.keys('Enter')
			field().value = '71'
			await view.keys('Tab')
			expect(edits[0]?.details.reason).toBe('tab-key')
			// The last cell of a row: the next cell is the first cell of the next row.
			expect(document.activeElement).toBe(cell('b', 'name'))
			expect(view.state.active).toEqual({ row: 2, col: 0 })

			await view.keys('Enter')
			field().value = 'Eemeli'
			await view.keys('Shift+Tab')
			expect(edits).toHaveLength(2)
			expect(document.activeElement).toBe(cell('a', 'score'))

			// The same text saves nothing, and Tab still moves on.
			await view.keys('Enter')
			field()
			await view.keys('Tab')
			expect(edits).toHaveLength(2)
			expect(document.activeElement).toBe(cell('b', 'name'))
		} finally {
			view.unmount()
		}
	})

	test('a listener that cancels the edit keeps the editor open', async () => {
		const { view, cell, field } = setup({
			onCellEdit: (_edits, details) => details.cancel(),
		})
		try {
			cell('a', 'name').focus()
			await view.keys('Enter')
			field().value = 'Anna'
			await view.keys('Enter')
			expect(view.state.editing).toBe(cellKey('a', 'name'))
			expect(view.state.editErrors).toEqual({ [cellKey('a', 'name')]: 'The change was not saved.' })
		} finally {
			view.unmount()
		}
	})

	test('focus that leaves the editor saves, and the editor of another cell saves the first', async () => {
		const { view, edits, cell, field } = setup()
		try {
			const outside = document.createElement('button')
			document.body.append(outside)
			cell('a', 'name').focus()
			await view.keys('Enter')
			field().value = 'Anna'
			outside.focus()
			expect(view.state.editing).toBeNull()
			expect(edits[0]?.details.reason).toBe('focus-out')
			// Focus stays where the person put it.
			expect(document.activeElement).toBe(outside)
			outside.remove()

			view.api.startEdit('b', 'name')
			expect(document.activeElement).toBe(cell('b', 'name'))
			field().value = 'Eemeli'
			view.api.startEdit('c', 'name')
			expect(view.state.editing).toBe(cellKey('c', 'name'))
			expect(edits[1]?.edits[0]).toMatchObject({ rowId: 'b', value: 'Eemeli' })
			view.api.cancelEdit()
			expect(view.state.editing).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('a schema that answers later keeps the editor open until the answer', async () => {
		let answer: (ok: boolean) => void = () => {}
		const slow: StandardSchemaV1 = {
			'~standard': {
				version: 1,
				vendor: 'test',
				validate: (value) =>
					new Promise((resolve) => {
						answer = (ok) =>
							resolve(ok ? { value } : { issues: [{ message: 'The name is taken.' }] })
					}),
			},
		}
		const { view, edits, cell, field } = setup({
			columns: [{ id: 'name', schema: slow }, { id: 'team' }, { id: 'score' }],
		})
		try {
			cell('a', 'name').focus()
			await view.keys('Enter')
			const input = field()
			input.value = 'Eero'
			await view.keys('Enter')
			expect(view.state.editing).toBe(cellKey('a', 'name'))
			answer(false)
			await view.settle()
			expect(view.state.editErrors).toEqual({ [cellKey('a', 'name')]: 'The name is taken.' })
			expect(edits).toHaveLength(0)

			input.value = 'Anna'
			await view.keys('Enter')
			answer(true)
			await view.settle()
			expect(view.state.editing).toBeNull()
			expect(edits[0]?.edits[0]).toMatchObject({ value: 'Anna' })
			expect(document.activeElement).toBe(cell('a', 'name'))
		} finally {
			view.unmount()
		}
	})

	test('an editor closes when its row leaves the table', async () => {
		const { view, cell, field } = setup()
		try {
			cell('b', 'name').focus()
			await view.keys('Enter')
			field()
			view.api.setSearch('Aino')
			expect(view.state.editing).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('without `editable`, no cell opens and no cell is marked', async () => {
		const { view, cell } = setup({ editable: false })
		try {
			expect(cell('a', 'name').hasAttribute('data-editable')).toBe(false)
			expect(cell('a', 'team').hasAttribute('aria-readonly')).toBe(false)
			cell('a', 'name').focus()
			await view.keys('Enter')
			expect(view.state.editing).toBeNull()
			expect(() => view.api.editCell('a', 'name', 'x')).toThrow(
				'The cell of row "a" in column "name" cannot be edited. Columns with cells that can be edited: none.',
			)
		} finally {
			view.unmount()
		}
	})

	test('a column decides for each row whether its cell can be edited', async () => {
		const { view, cell } = setup({
			editable: false,
			columns: [
				{ id: 'name', editable: (row) => row.team === 'Design' },
				{ id: 'team' },
				{ id: 'score' },
			],
		})
		try {
			expect(cell('a', 'name').hasAttribute('data-editable')).toBe(true)
			expect(cell('b', 'name').getAttribute('aria-readonly')).toBe('true')
			cell('b', 'name').focus()
			await view.keys('Enter')
			expect(view.state.editing).toBeNull()
			cell('a', 'name').focus()
			await view.keys('Enter')
			expect(view.state.editing).toBe(cellKey('a', 'name'))
		} finally {
			view.unmount()
		}
	})

	test('`editCell` checks the value and throws with the reason', () => {
		const { view, rows, edits } = setup()
		try {
			void view.api.editCell('b', 'score', 55)
			expect(edits[0]?.edits).toEqual([
				{
					rowId: 'b',
					columnId: 'score',
					row: rows[1],
					column: columns[2],
					value: 55,
					previous: 20,
				},
			])
			expect(edits[0]?.details.reason).toBe('imperative')
			// A text is read as the editor reads it.
			void view.api.editCell('b', 'score', '56')
			expect(edits[1]?.edits[0]?.value).toBe(56)
			// The same value is no edit.
			void view.api.editCell('b', 'score', 20)
			expect(edits).toHaveLength(2)

			expect(() => view.api.editCell('b', 'score', -1)).toThrow(
				'Column "score" refuses -1 for row "b": The score must be 0 or more.',
			)
			expect(() => view.api.editCell('b', 'score', 'low')).toThrow('"low" is not a number.')
			expect(() => view.api.editCell('b', 'team', 'Sales')).toThrow(
				'The cell of row "b" in column "team" cannot be edited. Columns with cells that can be edited: name, score.',
			)
			expect(() => view.api.editCell('z', 'score', 1)).toThrow('No row "z" to edit. Rows: a, b, c.')
			expect(() => view.api.editCell('b', 'age', 1)).toThrow(
				'No column "age" to edit. Columns: name, team, score.',
			)
			expect(edits).toHaveLength(2)
		} finally {
			view.unmount()
		}
	})
})

describe('cell range', () => {
	const copyEvent = (type: 'copy' | 'paste', text = '') => {
		const data = new Map<string, string>([['text/plain', text]])
		const event = new Event(type, { bubbles: true, cancelable: true })
		Object.defineProperty(event, 'clipboardData', {
			value: {
				getData: (kind: string) => data.get(kind) ?? '',
				setData: (kind: string, value: string) => data.set(kind, value),
			},
		})
		return { event: event as ClipboardEvent, data }
	}

	test('Shift with an arrow grows a range that never holds a header or a footer cell', async () => {
		const { view, cell } = setup({ cellSelection: true })
		try {
			expect(view.root.getAttribute('aria-multiselectable')).toBe('true')
			expect(cell('a', 'name').getAttribute('aria-selected')).toBe('false')
			// A header cell and a footer cell are never part of a range, so they do not say.
			expect(cell('h', 'name').hasAttribute('aria-selected')).toBe(false)
			expect(cell('f', 'name').hasAttribute('aria-selected')).toBe(false)

			cell('a', 'name').focus()
			await view.keys('Shift+ArrowDown', 'Shift+ArrowRight')
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 0 }, end: { row: 2, col: 1 } })
			expect(view.changes.at(-1)).toMatchObject({ key: 'cellRange', reason: 'list-navigation' })
			expect(view.announced.at(-1)).toBe('2 rows by 2 columns selected.')
			expect(cell('a', 'name').getAttribute('aria-selected')).toBe('true')
			expect(cell('a', 'name').getAttribute('data-range-edge')).toBe('top left')
			expect(cell('b', 'team').getAttribute('data-range-edge')).toBe('right bottom')
			expect(cell('b', 'score').getAttribute('aria-selected')).toBe('false')
			expect(cell('c', 'name').hasAttribute('data-selected')).toBe(false)

			// Up from the first row of the body: the range stops there.
			await view.keys('Shift+ArrowUp', 'Shift+ArrowUp', 'Shift+ArrowUp')
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 0 }, end: { row: 1, col: 1 } })
			// Every cell: the rows of the body.
			await view.keys('Control+a')
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 0 }, end: { row: 3, col: 2 } })
			expect(cell('h', 'score').hasAttribute('data-selected')).toBe(false)
			expect(cell('f', 'score').hasAttribute('data-selected')).toBe(false)
			expect(cell('c', 'score').getAttribute('data-range-edge')).toBe('right bottom')

			// Escape drops the range, and an arrow key without Shift does too.
			await view.keys('Escape')
			expect(view.state.cellRange).toBeNull()
			await view.keys('Shift+ArrowDown', 'ArrowDown')
			expect(view.state.cellRange).toBeNull()
			expect(view.state.active).toEqual({ row: 2, col: 0 })
		} finally {
			view.unmount()
		}
	})

	test('from a header cell, Shift with an arrow moves focus and starts no range', async () => {
		const { view, cell } = setup({ cellSelection: true })
		try {
			cell('h', 'name').focus()
			await view.keys('Shift+ArrowRight')
			expect(view.state.cellRange).toBeNull()
			expect(view.state.active).toEqual({ row: 0, col: 1 })
			await view.keys('Control+a')
			expect(view.state.cellRange).toBeNull()
		} finally {
			view.unmount()
		}
	})

	test('Space selects the row when rows can be selected, and the rows of the range when not', async () => {
		const both = setup({ cellSelection: true, selection: 'multiple' })
		try {
			both.cell('a', 'name').focus()
			await both.view.keys('Space')
			expect(both.view.state.selected).toEqual(['a'])
			expect(both.view.state.cellRange).toBeNull()
		} finally {
			both.view.unmount()
		}
		const { view, cell } = setup({ cellSelection: true })
		try {
			cell('b', 'team').focus()
			await view.keys('Shift+Space')
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 0 }, end: { row: 2, col: 2 } })
			// The columns of the range, in the rows of the body.
			cell('b', 'team').focus()
			await view.keys('Escape', 'Control+Space')
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 1 }, end: { row: 3, col: 1 } })
		} finally {
			view.unmount()
		}
	})

	test('without `cellSelection`, Shift with an arrow moves focus', async () => {
		const { view, cell } = setup()
		try {
			expect(cell('a', 'name').hasAttribute('aria-selected')).toBe(false)
			cell('a', 'name').focus()
			await view.keys('Shift+ArrowDown')
			expect(view.state.cellRange).toBeNull()
			expect(view.state.active).toEqual({ row: 2, col: 0 })
			expect(() => view.api.selectCells({ rowId: 'a', columnId: 'name' })).toThrow(
				'This table has no cell selection. Set its `cellSelection` option to true.',
			)
		} finally {
			view.unmount()
		}
	})

	test('`selectCells` selects by row and column ids, and a copy gives the values as text', () => {
		const { view, cell } = setup({ cellSelection: true })
		try {
			view.api.selectCells({ rowId: 'a', columnId: 'name' }, { rowId: 'b', columnId: 'score' })
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 0 }, end: { row: 2, col: 2 } })
			expect(view.changes.at(-1)).toMatchObject({ key: 'cellRange', reason: 'imperative' })
			expect(view.api.copyCells()).toBe('Aino\tDesign\t70\nEero\tPlatform\t20')

			const { event, data } = copyEvent('copy')
			cell('a', 'name').dispatchEvent(event)
			expect(data.get('text/plain')).toBe('Aino\tDesign\t70\nEero\tPlatform\t20')
			expect(event.defaultPrevented).toBe(true)
			expect(view.announced.at(-1)).toBe('6 cells copied.')

			view.api.clearCellSelection()
			expect(view.state.cellRange).toBeNull()
			// Without a range, the active cell alone.
			expect(view.api.copyCells()).toBe('Aino')

			expect(() => view.api.selectCells({ rowId: 'z', columnId: 'name' })).toThrow(
				'No row "z" to select. Rows: a, b, c.',
			)
			expect(() => view.api.selectCells({ rowId: 'a', columnId: 'age' })).toThrow(
				'No column "age" to select.',
			)
			expect(() => view.api.selectCells('a' as never)).toThrow('A cell is `{ rowId, columnId }`')
		} finally {
			view.unmount()
		}
	})

	test('a paste fills cells from the first selected cell, through the check of each column', () => {
		const { view, rows, edits, cell } = setup({ cellSelection: true })
		try {
			view.api.selectCells({ rowId: 'b', columnId: 'name' })
			// Three columns and two rows of text. The team column cannot be edited, so it is skipped.
			void view.api.pasteCells('Eemeli\tSales\t21\nHilla\tSales\t46\n')
			expect(edits).toHaveLength(1)
			expect(edits[0]?.details.reason).toBe('paste')
			expect(edits[0]?.edits.map((edit) => [edit.rowId, edit.columnId, edit.value])).toEqual([
				['b', 'name', 'Eemeli'],
				['b', 'score', 21],
				['c', 'name', 'Hilla'],
				['c', 'score', 46],
			])
			expect(rows[1]).toEqual({ id: 'b', name: 'Eero', team: 'Platform', score: 20 })
			// The cells that the paste covers are the range now.
			expect(view.state.cellRange).toEqual({ anchor: { row: 2, col: 0 }, end: { row: 3, col: 2 } })
			expect(view.announced.at(-1)).toBe('4 cells changed.')

			// One refused value stops the paste, and no cell changes.
			view.api.selectCells({ rowId: 'a', columnId: 'score' })
			expect(() => view.api.pasteCells('5\n-2\n9')).toThrow(
				'Nothing was pasted. Score refuses "-2": The score must be 0 or more.',
			)
			expect(edits).toHaveLength(1)

			// One value fills every selected cell.
			view.api.selectCells({ rowId: 'a', columnId: 'score' }, { rowId: 'c', columnId: 'score' })
			void view.api.pasteCells('20')
			expect(edits[1]?.edits.map((edit) => [edit.rowId, edit.value])).toEqual([
				['a', 20],
				['c', 20],
			])

			// A paste by the keyboard, on a cell.
			view.api.selectCells({ rowId: 'a', columnId: 'name' })
			const { event } = copyEvent('paste', 'Anna')
			cell('a', 'name').dispatchEvent(event)
			expect(event.defaultPrevented).toBe(true)
			expect(edits[2]?.edits[0]).toMatchObject({ rowId: 'a', columnId: 'name', value: 'Anna' })
			// A refusal from the keyboard is said, and nothing is thrown.
			view.api.selectCells({ rowId: 'a', columnId: 'score' })
			cell('a', 'score').dispatchEvent(copyEvent('paste', 'x').event)
			expect(view.announced.at(-1)).toBe(
				'Nothing was pasted. Score refuses "x": "x" is not a number.',
			)

			view.api.selectCells({ rowId: 'a', columnId: 'team' })
			expect(() => view.api.pasteCells('Sales')).toThrow(
				'Nothing was pasted. No cell here can be edited.',
			)
		} finally {
			view.unmount()
		}
	})

	test('a range goes when other rows come to its places, and stays when the same rows come back', () => {
		const { view, rows } = setup({ cellSelection: true, columns: [...columns] })
		try {
			view.api.selectCells({ rowId: 'a', columnId: 'name' }, { rowId: 'b', columnId: 'team' })
			const range = view.state.cellRange
			// New row objects with the same ids, as after an edit.
			void view.api.editCell('a', 'name', 'Anna')
			expect(view.state.cellRange).toBe(range)

			view.api.sortBy('score')
			expect(view.state.cellRange).toBeNull()
			expect(view.changes).toContainEqual(
				expect.objectContaining({ key: 'cellRange', reason: 'reset' }),
			)

			view.api.selectCells({ rowId: 'b', columnId: 'name' }, { rowId: 'c', columnId: 'team' })
			view.api.setColumnVisibility('team', false)
			expect(view.state.cellRange).toBeNull()
			expect(rows).toHaveLength(3)
		} finally {
			view.unmount()
		}
	})

	test('a drag over cells paints a range, and reports its end once', async () => {
		const commits: unknown[] = []
		const { view, cell } = setup({
			cellSelection: true,
			onCellRangeCommit: (value) => commits.push(value),
		})
		try {
			await view.drag(cell('a', 'name'), { to: cell('c', 'team') })
			expect(view.state.cellRange).toEqual({ anchor: { row: 1, col: 0 }, end: { row: 3, col: 1 } })
			expect(view.changes.at(-1)).toMatchObject({ key: 'cellRange', reason: 'drag' })
			expect(commits).toEqual([{ anchor: { row: 1, col: 0 }, end: { row: 3, col: 1 } }])
			// A press without a move drops the range, and that is no end of a drag.
			await view.click(cell('b', 'team'))
			expect(view.state.cellRange).toBeNull()
			expect(commits).toHaveLength(1)
		} finally {
			view.unmount()
		}
	})
})
