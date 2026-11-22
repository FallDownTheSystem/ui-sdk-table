import { mount } from '@ui-sdk/core/testing'
import { parseCellKey, type CellEdit, type StandardSchemaV1 } from '../edit'
import type { ColumnDef } from '../rows'
import { rowNumberColumn } from './chrome'
import { table, type TableEditDetails, type TableOptions } from '../table'

// For the tests of the sheet behaviors of this package, and no part of it.
//
// `mount` of UI SDK never passes new options, so a table in these tests keeps
// the row objects of its first render. An owner that makes new rows, as an
// app does, cannot show them here. So the rows of this table are ids only,
// and the values are in a store beside them that each column reads. An edit
// that the owner puts into the store is what the table reads next, as with
// new rows. Rows that come and go are tested with Vue, in `packages/vue`.

export type Item = { name: string; kind: string; price: number; stock: number }
export type ItemRow = { id: string }
export type Report = { edits: readonly CellEdit<ItemRow>[]; details: TableEditDetails }

export const items = (): Record<string, Item> => ({
	a: { name: 'Bolt', kind: 'Steel', price: 2.5, stock: 40 },
	b: { name: 'Nut', kind: 'Steel', price: 0.5, stock: 90 },
	c: { name: 'Washer', kind: 'Brass', price: 0.2, stock: 15 },
	d: { name: 'Screw', kind: 'Brass', price: 1.5, stock: 60 },
})

export const COLUMN_IDS = ['name', 'kind', 'price', 'stock'] as const

/** A schema that refuses a price under 0, at once or after a turn. */
export const priceSchema = (later = false, seen?: unknown[]): StandardSchemaV1 => ({
	'~standard': {
		version: 1,
		vendor: 'test',
		validate: (value) => {
			seen?.push(value)
			const result =
				typeof value === 'number' && value >= 0
					? { value }
					: { issues: [{ message: 'The price must be 0 or more.' }] }
			return later ? Promise.resolve(result) : result
		},
	},
})

/**
 * Grid row 0 is the header row, and with `letters` the row of letters, whose
 * cells have the id `l|{column}`. Each body row has one cell for each column.
 */
function markup(ids: readonly string[], columnIds: readonly string[], letters = false): string {
	const head = letters ? 2 : 1
	const cells = (id: string, row: number, header = false) =>
		columnIds
			.map(
				(column, col) =>
					`<cell value="${id}|${column}" row="${row}" col="${col}"${header ? ' header' : ''}>x</cell>`,
			)
			.join('')
	const rows = ids.map(
		(id, index) => `<row value="${id}" index="${index + head}">${cells(id, index + head)}</row>`,
	)
	const top = letters ? `<header-row index="0">${cells('l', 0, true)}</header-row>` : ''
	return `<root aria-label="Parts">${top}<header-row index="${head - 1}">${cells('h', head - 1, true)}</header-row>${rows.join('')}</root>`
}

export function sheetTable(
	options: Partial<TableOptions<ItemRow>> = {},
	given: {
		/** What the owner does with a report. Without it, the owner puts the values into its store. */
		owner?: (report: Report, apply: () => void) => void
		schema?: StandardSchemaV1
		/** A column of row numbers before the others. Every column number is then one higher. */
		numbers?: boolean
		/** The rows whose stock cannot be edited. */
		locked?: readonly string[]
		/** More columns after the others, each with this id, that read the store as the others do. */
		more?: readonly string[]
	} = {},
) {
	const values = items()
	const ids = Object.keys(values)
	const rows: ItemRow[] = ids.map((id) => ({ id }))
	const reports: Report[] = []
	const read = (key: keyof Item) => (row: ItemRow) => values[row.id]?.[key]
	const columns: ColumnDef<ItemRow>[] = [
		...(given.numbers ? [rowNumberColumn<ItemRow>()] : []),
		{ id: 'name', header: 'Name', value: read('name') },
		{ id: 'kind', header: 'Kind', value: read('kind'), editable: false },
		{ id: 'price', header: 'Price', value: read('price'), schema: given.schema },
		{
			id: 'stock',
			header: 'Stock',
			value: read('stock'),
			editable: given.locked ? (row) => !given.locked?.includes(row.id) : undefined,
		},
		...(given.more ?? []).map((id): ColumnDef<ItemRow> => ({
			id,
			header: id.charAt(0).toUpperCase() + id.slice(1),
			value: (row) => (values[row.id] as Record<string, unknown> | undefined)?.[id],
		})),
	]
	const view = mount(
		table,
		{
			rows,
			columns,
			onCellEdit: (edits: readonly CellEdit<ItemRow>[], details: TableEditDetails) => {
				const report = { edits, details }
				reports.push(report)
				const apply = () => {
					for (const edit of edits) {
						const item = values[edit.rowId] as Record<string, unknown> | undefined
						if (item) item[edit.columnId] = edit.value
					}
				}
				if (given.owner) given.owner(report, apply)
				else apply()
			},
			...options,
		} as TableOptions,
		markup(
			ids,
			// Columns of the test in place of the columns of the harness: one level, in their order of display.
			(options.columns ?? columns).map((column) => column.id),
			!!options.columnLetters,
		),
	)
	const cell = (rowId: string, columnId: string) =>
		view.part('cell', `${rowId}|${columnId}`) as HTMLElement
	/** Renders the text field of the cell that is edited, as a renderer does after the state changed. */
	function field(): HTMLInputElement {
		const ref = parseCellKey(view.state.editing ?? '')
		if (!ref) throw new Error('No cell is edited.')
		const el = document.createElement('input')
		cell(ref.rowId, ref.columnId).append(el)
		el.addEventListener('keydown', (event) => view.api.editorKeydown(event))
		el.addEventListener('focusout', (event) => view.api.edit.focusout(event, view.root))
		const leave = view.api.edit.bindInput(el)
		// A renderer takes the field out when the edit ends.
		const stop = setInterval(() => {
			if (view.state.editing !== null) return
			clearInterval(stop)
			leave()
			el.remove()
		}, 0)
		return el
	}
	/** Presses a key on an element, and gives the event back to look at. */
	function press(el: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
		const code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key
		const event = new KeyboardEvent('keydown', {
			key,
			code,
			bubbles: true,
			cancelable: true,
			...init,
		})
		el.dispatchEvent(event)
		return event
	}
	/** A clipboard event with its own store, as a browser gives it. */
	function clipboard(type: 'copy' | 'cut' | 'paste', text = '') {
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
	/** What each report held, as `[row, column, before, after]`. */
	const told = () =>
		reports.map((report) =>
			report.edits.map((edit) => [edit.rowId, edit.columnId, edit.previous, edit.value]),
		)
	return { view, values, rows, reports, told, cell, field, press, clipboard }
}
