import { createAgent } from '@ui-sdk/vue/agent'
import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { h, nextTick, shallowRef } from 'vue'
import {
	applyEdits,
	Table,
	type CellEdit,
	type CellFormats,
	type ColumnDef,
	type TableChangeDetails,
	type TableEditDetails,
} from './index'

type Person = { id: string; name: string; score: number }

const people: Person[] = [
	{ id: 'a', name: 'Aino', score: 70 },
	{ id: 'b', name: 'Eero', score: 20 },
]
const columns: ColumnDef<Person>[] = [{ id: 'name' }, { id: 'score', sortable: true }]

test('an agent finds the table by its name, acts on it, and reads a useful error', async () => {
	const sources: string[] = []
	const wrapper = mount(
		() =>
			h(Table<Person>, {
				rows: people,
				columns,
				selection: 'multiple',
				'aria-label': 'People',
				onSortChange: (_value: unknown, details: TableChangeDetails) =>
					sources.push(details.source),
			}),
		{ attachTo: document.body },
	)
	const agent = createAgent()

	const seen = agent.snapshot().find((component) => component.label === 'People')
	expect(seen?.actions).toEqual(expect.arrayContaining(['sortBy', 'setSearch', 'select']))

	const sorted = await agent.act({
		steps: [
			{ ref: 'People', action: 'sortBy', args: ['score', 'desc'] },
			{ ref: 'People', action: 'select', args: ['a'] },
		],
	})
	await nextTick()
	expect(sorted.ok).toBe(true)
	expect(sources).toEqual(['agent'])
	expect(wrapper.findAll('tbody tr').map((row) => row.find('td').text())).toEqual(['Aino', 'Eero'])
	expect(wrapper.get('tbody tr[aria-selected="true"]').text()).toContain('Aino')

	const failed = await agent.act({ steps: [{ ref: 'People', action: 'sortBy', args: ['age'] }] })
	expect(failed.ok).toBe(false)
	expect(failed.error?.message).toContain('No column "age" to sort by. Columns: name, score.')

	wrapper.unmount()
})

test('an agent hides and resets the columns, and hears why a sort cannot add a column', async () => {
	const wrapper = mount(
		() =>
			h(Table<Person>, {
				rows: people,
				columns: [...columns, { id: 'id', aggregate: 'count' }],
				multiSort: 'none',
				defaultColumnVisibility: { id: false },
				'aria-label': 'Staff',
			}),
		{ attachTo: document.body },
	)
	const agent = createAgent()
	const headers = () => wrapper.findAll('thead th').map((cell) => cell.attributes('data-column'))

	const seen = agent.snapshot().find((component) => component.label === 'Staff')
	expect(seen?.actions).toEqual(
		expect.arrayContaining([
			'hideAllColumns',
			'resetColumnVisibility',
			'resetColumnOrder',
			'resetColumnPinning',
			'getTotals',
			'flushSearch',
		]),
	)

	const hidden = await agent.act({
		steps: [
			{ ref: 'Staff', action: 'setColumnVisibility', args: ['id', true] },
			{ ref: 'Staff', action: 'hideAllColumns', args: [] },
		],
	})
	await nextTick()
	expect(hidden.ok).toBe(true)
	expect(headers()).toEqual(['name'])

	const reset = await agent.act({
		steps: [{ ref: 'Staff', action: 'resetColumnVisibility', args: [] }],
	})
	await nextTick()
	expect(reset.ok).toBe(true)
	expect(headers()).toEqual(['name', 'score'])

	const refused = await agent.act({
		steps: [{ ref: 'Staff', action: 'toggleSort', args: ['score', { append: true }] }],
	})
	expect(refused.ok).toBe(false)
	expect(refused.error?.message).toContain('its `multiSort` option is "none"')

	const unknown = await agent.act({
		steps: [{ ref: 'Staff', action: 'getTotals', args: ['group/team=Design'] }],
	})
	expect(unknown.ok).toBe(false)
	expect(unknown.error?.message).toContain('No group "group/team=Design" to read the totals of.')

	wrapper.unmount()
})

test('an agent works a sheet beside a second table: select, paste, read the sum, format, undo', async () => {
	type Part = { id: string; name: string; price: number | null; stock: number | null }
	const start = (): Part[] => [
		{ id: 'a', name: 'Bolt', price: 2.5, stock: 40 },
		{ id: 'b', name: 'Nut', price: 0.5, stock: 90 },
		{ id: 'c', name: 'Washer', price: 0.2, stock: 15 },
	]
	const sheetColumns: ColumnDef<Part>[] = [
		{ id: 'name', editable: false },
		{ id: 'price', format: 'decimal', formatOptions: { locale: 'en-US' } },
		{ id: 'stock', format: 'integer', aggregate: 'sum' },
	]
	const parts = shallowRef(start())
	const spares = shallowRef(start())
	const formats = shallowRef<CellFormats>({})
	const sources: string[] = []
	const table = (label: string, rows: typeof parts, extra: Record<string, unknown> = {}) =>
		h(Table<Part>, {
			rows: rows.value,
			columns: sheetColumns,
			sheet: true,
			locale: 'en-US',
			'aria-label': label,
			onCellEdit: (edits: readonly CellEdit<Part>[], details: TableEditDetails) => {
				sources.push(`${label} ${details.reason} ${details.source}`)
				rows.value = applyEdits(rows.value, edits)
			},
			...extra,
		})
	const wrapper = mount(
		() => [
			table('Parts', parts, {
				cellFormats: formats.value,
				'onUpdate:cellFormats': (value: CellFormats) => (formats.value = value),
				formatColors: ['red'],
			}),
			table('Spares', spares),
		],
		{ attachTo: document.body },
	)
	const agent = createAgent()
	const act = (action: string, ...args: unknown[]) =>
		agent.act({ steps: [{ ref: 'Parts', action, args }] })
	const resultOf = async (action: string, ...args: unknown[]) => {
		const done = await act(action, ...args)
		expect(done.error).toBeUndefined()
		return done.steps?.[0]?.result
	}
	const at = (rowId: string, columnId: string) => ({ rowId, columnId })

	const seen = agent.snapshot().find((component) => component.label === 'Parts')
	expect(seen?.actions).toEqual(
		expect.arrayContaining([
			'fillCells',
			'formatCells',
			'clearCellFormats',
			'toggleCellFormat',
			'getCellFormat',
			'getSelectionSummary',
			'setColumnAggregate',
		]),
	)
	// The formats are no part of what an agent reads at each look: it asks for the format of a cell.
	expect(JSON.stringify(seen)).not.toContain('cellFormats')

	// A block of two columns lands from the first price on, as one report with the agent as its source.
	const pasted = await agent.act({
		steps: [
			{ ref: 'Parts', action: 'selectCells', args: [at('a', 'price')] },
			{ ref: 'Parts', action: 'pasteCells', args: ['3\t10\n4\t20'] },
		],
	})
	expect(pasted.ok).toBe(true)
	await nextTick()
	expect(parts.value.map((row) => [row.price, row.stock])).toEqual([
		[3, 10],
		[4, 20],
		[0.2, 15],
	])
	expect(sources).toEqual(['Parts paste agent'])
	// The table beside it has the same rows and heard nothing.
	expect(spares.value).toEqual(start())

	await act('selectCells', at('a', 'stock'), at('c', 'stock'))
	expect(await resultOf('getSelectionSummary')).toMatchObject({
		cells: 3,
		count: 3,
		numbers: 3,
		sum: 45,
		mean: 15,
		min: 10,
		max: 20,
		texts: { sum: '45' },
	})

	// A fill from the first two lines goes on with their step.
	const filled = await act('fillCells', 'down', 2)
	expect(filled.ok).toBe(true)
	await nextTick()
	expect(parts.value.map((row) => row.stock)).toEqual([10, 20, 30])
	expect((await resultOf('getSelectionSummary')) as { sum: number }).toMatchObject({ sum: 60 })

	// A format is a change of its own key, and a step of the history as an edit is.
	// The selection holds every row, so the format is of the whole column.
	const formatted = await act('formatCells', { bold: true, fill: 'red', decimals: 1 })
	expect(formatted.ok).toBe(true)
	await nextTick()
	expect(formats.value).toEqual({ columns: { stock: { bold: true, fill: 'red', decimals: 1 } } })
	expect(await resultOf('getCellFormat', 'b', 'stock')).toEqual({
		bold: true,
		fill: 'red',
		decimals: 1,
	})
	const cell = wrapper.findAll('table')[0]?.findAll('tbody tr')[1]?.findAll('td')[2]
	expect(cell?.attributes('data-bold')).toBe('')
	expect(cell?.attributes('data-fill')).toBe('red')
	expect(cell?.text()).toBe('20.0')

	// A wrong name comes back with the names that the table knows.
	const wrong = await act('formatCells', { fill: 'pink' })
	expect(wrong.ok).toBe(false)
	expect(wrong.error?.message).toContain('red')
	const unknown = await act('fillCells', 'sideways')
	expect(unknown.ok).toBe(false)
	expect(unknown.error?.message).toContain('down')

	// Three steps back: the format, the fill, the paste. Each is one step.
	const back = await agent.act({
		steps: [
			{ ref: 'Parts', action: 'undo' },
			{ ref: 'Parts', action: 'undo' },
			{ ref: 'Parts', action: 'undo' },
		],
	})
	expect(back.ok).toBe(true)
	await nextTick()
	expect(formats.value.columns ?? {}).toEqual({})
	expect(formats.value.cells ?? {}).toEqual({})
	expect(parts.value).toEqual(start())
	expect(sources).toEqual([
		'Parts paste agent',
		'Parts fill agent',
		'Parts undo agent',
		'Parts undo agent',
	])
	const empty = await act('undo')
	expect(empty.ok).toBe(false)
	expect(empty.error?.message).toContain('Nothing to undo.')
	// The second table took no step and has none to take back.
	const other = await agent.act({ steps: [{ ref: 'Spares', action: 'undo' }] })
	expect(other.error?.message).toContain('Nothing to undo.')
	expect(spares.value).toEqual(start())

	wrapper.unmount()
})
