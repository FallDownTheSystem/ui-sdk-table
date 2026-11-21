import { createAgent } from '@ui-sdk/vue/agent'
import { mount } from '@vue/test-utils'
import { afterEach, expect, test, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import {
	applyEdits,
	createTableController,
	Table,
	useTableSearch,
	useTableView,
	type CellEdit,
	type ColumnDef,
	type EditorSlotProps,
	type HeaderSlotProps,
	type PageState,
	type TableEditDetails,
} from './index'

type Part = { id: string; name: string; kind: string; stock: number }

const parts = (): Part[] => [
	{ id: 'a', name: 'Bolt', kind: 'Steel', stock: 40 },
	{ id: 'b', name: 'Nut', kind: 'Steel', stock: 90 },
	{ id: 'c', name: 'Washer', kind: 'Brass', stock: 15 },
]

const columns: ColumnDef<Part>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'kind', header: 'Kind' },
	{ id: 'stock', header: 'Stock', sortable: true },
]

const wrappers: { unmount: () => void }[] = []
afterEach(() => {
	for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

/** A table whose owner puts each report into its rows with `applyEdits`, as an app does. */
function setup(extra: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
	const rows = shallowRef(parts())
	const controller = createTableController()
	const reports: { edits: readonly CellEdit<Part>[]; details: TableEditDetails }[] = []
	const wrapper = mount(
		() =>
			h(
				Table<Part>,
				{
					rows: rows.value,
					columns,
					controller,
					'aria-label': 'Parts',
					onCellEdit: (edits: readonly CellEdit<Part>[], details: TableEditDetails) => {
						reports.push({ edits, details })
						rows.value = applyEdits(rows.value, edits)
					},
					...extra,
				},
				slots as never,
			),
		{ attachTo: document.body },
	)
	wrappers.push(wrapper)
	const cell = (row: number, col: number) =>
		wrapper.get(`tbody tr:nth-child(${row}) td:nth-child(${col})`)
	const names = () => wrapper.findAll('tbody tr').map((row) => row.find('td').text())
	return { wrapper, rows, controller, reports, cell, names }
}

test('`<Table history>` in its short form turns the history on, and an owner with `applyEdits` gets the old value back', async () => {
	const rows = shallowRef(parts())
	const controller = createTableController()
	const Page = defineComponent({
		components: { Table },
		setup: () => ({
			rows,
			columns,
			controller,
			edit: (edits: readonly CellEdit<Part>[]) => (rows.value = applyEdits(rows.value, edits)),
		}),
		template:
			'<Table :rows="rows" :columns="columns" :controller="controller" editable history @cell-edit="edit" />',
	})
	const wrapper = mount(Page, { attachTo: document.body })
	wrappers.push(wrapper)
	await nextTick()
	void controller.editCell('b', 'stock', 91)
	await nextTick()
	expect(rows.value[1]?.stock).toBe(91)
	expect(controller.getView().canUndo).toBe(true)
	controller.undo()
	await nextTick()
	expect(rows.value[1]?.stock).toBe(90)
	expect(wrapper.get('tbody tr:nth-child(2) td:nth-child(3)').text()).toBe('90')
	controller.redo()
	await nextTick()
	expect(rows.value[1]?.stock).toBe(91)
})

test('two undos in one turn both reach the rows of an owner with `applyEdits`', async () => {
	const { rows, controller, reports } = setup({ editable: true, history: true })
	void controller.editCell('a', 'name', 'Rivet')
	await nextTick()
	void controller.editCell('a', 'stock', 41)
	await nextTick()
	const other = rows.value[1]
	controller.undo()
	controller.undo()
	// The second report holds the row object that the first one replaced.
	expect(reports[3]?.edits[0]?.row).not.toBe(rows.value[0])
	expect(rows.value[0]).toEqual({ id: 'a', name: 'Bolt', kind: 'Steel', stock: 40 })
	expect(rows.value[1]).toBe(other)
	await nextTick()
	controller.redo()
	controller.redo()
	expect(rows.value[0]).toEqual({ id: 'a', name: 'Rivet', kind: 'Steel', stock: 41 })
})

test('a row that left the table is skipped at the undo, and a step with no cell left is dropped for the step before it', async () => {
	const { rows, controller, reports } = setup({
		editable: true,
		cellSelection: true,
		history: true,
	})
	void controller.editCell('a', 'stock', 41)
	await nextTick()
	controller.selectCells({ rowId: 'b', columnId: 'stock' }, { rowId: 'c', columnId: 'stock' })
	void controller.pasteCells('1\n2')
	await nextTick()
	void controller.editCell('c', 'name', 'Ring')
	await nextTick()

	// The owner removes the last row.
	rows.value = rows.value.slice(0, 2)
	await nextTick()
	// The newest step has no cell left: it goes, and the paste before it is taken back for the row that is there.
	controller.undo()
	expect(reports.at(-1)?.details.reason).toBe('undo')
	expect(reports.at(-1)?.edits.map((edit) => [edit.rowId, edit.value])).toEqual([['b', 90]])
	expect(controller.getHistory()).toMatchObject({ position: 1 })
	expect(controller.getHistory().entries.map((entry) => entry.reason)).toEqual([
		'imperative',
		'paste',
	])
	await nextTick()
	// A person who cannot see the table hears what the undo could not do.
	await new Promise((resolve) => setTimeout(resolve, 150))
	const live = [...document.querySelectorAll('[aria-live="polite"]')]
	expect(live.map((region) => region.textContent)).toContain(
		'1 cell changed back. 1 cell is not in the table any more.',
	)

	// Every row is other data now: the steps find no cell, and there is nothing to undo.
	rows.value = [{ id: 'x', name: 'Pin', kind: 'Steel', stock: 1 }]
	await nextTick()
	expect(() => controller.undo()).toThrow('Nothing to undo.')
	expect(controller.getHistory().entries.map((entry) => entry.reason)).toEqual(['paste'])
	expect(() => controller.redo()).toThrow('Nothing to redo.')
	expect(controller.getHistory().entries).toEqual([])
})

test('an undo finds a row that the sort moved, and the active cell goes to where the row is', async () => {
	const { controller, rows, names } = setup({
		editable: true,
		history: true,
		defaultSort: [{ id: 'name', desc: false }],
	})
	expect(names()).toEqual(['Bolt', 'Nut', 'Washer'])
	void controller.editCell('a', 'name', 'Zinc bolt')
	await nextTick()
	expect(names()).toEqual(['Nut', 'Washer', 'Zinc bolt'])
	controller.undo()
	// The cell of the step is in the third row at the report, and the active cell is on it.
	expect(controller.getView().activeCell).toEqual({ rowId: 'a', columnId: 'name' })
	await nextTick()
	expect(rows.value[0]?.name).toBe('Bolt')
	expect(names()).toEqual(['Bolt', 'Nut', 'Washer'])
	// The active cell went with its row.
	expect(controller.getView().activeCell).toEqual({ rowId: 'a', columnId: 'name' })
})

test('with pages from a server, another page, sort or filter empties the history', async () => {
	const page = shallowRef<PageState>({ page: 1, pageSize: 3 })
	const { controller } = setup({
		editable: true,
		history: true,
		manualPage: true,
		manualSort: true,
		manualFilter: true,
		rowCount: 9,
		page: page.value,
		'onUpdate:page': (next: PageState) => (page.value = next),
	})
	void controller.editCell('a', 'stock', 41)
	await nextTick()
	expect(controller.getView().canUndo).toBe(true)
	// New rows after an edit are no reason to forget it.
	void controller.editCell('a', 'stock', 42)
	await nextTick()
	expect(controller.getHistory().entries).toHaveLength(2)

	controller.sortBy('name')
	await nextTick()
	expect(controller.getHistory().entries).toEqual([])
	void controller.editCell('a', 'stock', 43)
	await nextTick()
	controller.setSearch('bolt')
	await nextTick()
	expect(controller.getView().canUndo).toBe(false)
})

test('a page of a server that goes to another page empties the history', async () => {
	const page = shallowRef<PageState>({ page: 1, pageSize: 3 })
	const rows = shallowRef(parts())
	const controller = createTableController()
	const wrapper = mount(
		() =>
			h(Table<Part>, {
				rows: rows.value,
				columns,
				controller,
				editable: true,
				history: true,
				manualPage: true,
				rowCount: 9,
				page: page.value,
				'onUpdate:page': (next: PageState | undefined) => next && (page.value = next),
				onCellEdit: (edits: readonly CellEdit<Part>[]) =>
					(rows.value = applyEdits(rows.value, edits)),
			}),
		{ attachTo: document.body },
	)
	wrappers.push(wrapper)
	void controller.editCell('a', 'stock', 41)
	await nextTick()
	expect(controller.getView().canUndo).toBe(true)
	controller.nextPage()
	await nextTick()
	expect(page.value.page).toBe(2)
	expect(controller.getView().canUndo).toBe(false)
})

test('an agent undoes and redoes, its own edits are steps that say so, and it reads why an undo cannot run', async () => {
	const { rows, controller } = setup({ editable: true, cellSelection: true, history: true })
	const agent = createAgent()
	const seen = agent.snapshot().find((component) => component.label === 'Parts')
	expect(seen?.actions).toEqual(
		expect.arrayContaining([
			'undo',
			'redo',
			'clearCells',
			'cutCells',
			'selectAllCells',
			'selectCellRows',
			'selectCellColumns',
		]),
	)
	const edited = await agent.act({
		steps: [{ ref: 'Parts', action: 'editCell', args: ['b', 'stock', 5] }],
	})
	expect(edited.ok).toBe(true)
	await nextTick()
	expect(controller.getHistory().entries).toEqual([
		{ id: 1, reason: 'imperative', source: 'agent', cells: 1 },
	])
	const undone = await agent.act({ steps: [{ ref: 'Parts', action: 'undo' }] })
	expect(undone.ok).toBe(true)
	await nextTick()
	expect(rows.value[1]?.stock).toBe(90)
	const empty = await agent.act({ steps: [{ ref: 'Parts', action: 'undo' }] })
	expect(empty.ok).toBe(false)
	expect(empty.error?.message).toContain('Nothing to undo.')
	const again = await agent.act({
		steps: [
			{ ref: 'Parts', action: 'redo' },
			{ ref: 'Parts', action: 'selectCellRows', args: ['a', 'b'] },
			{ ref: 'Parts', action: 'clearCells' },
		],
	})
	expect(again.ok).toBe(true)
	await nextTick()
	expect(rows.value.map((row) => [row.name, row.stock])).toEqual([
		['', null],
		['', null],
		['Washer', 15],
	])
	const wrong = await agent.act({
		steps: [{ ref: 'Parts', action: 'selectCellColumns', args: ['size'] }],
	})
	expect(wrong.error?.message).toContain('No column "size" to select. Columns: name, kind, stock.')
})

test('in a sheet with groups, Enter in the editor passes over the group row to the next data row', async () => {
	const { wrapper, rows } = setup({
		sheet: true,
		defaultGroupBy: ['kind'],
		defaultExpanded: ['group/kind=Steel', 'group/kind=Brass'],
	})
	await nextTick()
	const all = wrapper.findAll('tbody tr')
	const kinds = all.map(
		(row) => row.attributes('data-kind') ?? row.find('td').attributes('data-kind') ?? 'row',
	)
	// Group row, Bolt, Nut, group row, Washer.
	expect(all).toHaveLength(5)
	expect(kinds.filter((kind) => kind !== 'row').length).toBeGreaterThan(0)
	const stock = (row: number) => wrapper.get(`tbody tr:nth-child(${row}) td[data-column="stock"]`)
	;(stock(3).element as HTMLElement).focus()
	await stock(3).trigger('keydown', { key: '7' })
	await nextTick()
	const input = stock(3).get('input')
	await input.trigger('keydown', { key: 'Enter' })
	await nextTick()
	expect(rows.value[1]?.stock).toBe(7)
	expect(document.activeElement).toBe(stock(5).element)
})

test('an editor from a slot knows the character that opened it, and its Enter moves down in a sheet', async () => {
	const seen: Pick<EditorSlotProps<Part>, 'mode' | 'typed'>[] = []
	const { cell, rows } = setup(
		{ sheet: true },
		{
			'edit-stock': (props: EditorSlotProps<Part>) => {
				seen.push({ mode: props.mode, typed: props.typed })
				return h('input', {
					class: 'own',
					value: props.typed ?? props.text,
					onKeydown: (event: KeyboardEvent) => {
						if (event.key !== 'Enter') return
						event.stopPropagation()
						props.save(Number((event.target as HTMLInputElement).value), event)
					},
				})
			},
		},
	)
	;(cell(1, 3).element as HTMLElement).focus()
	await cell(1, 3).trigger('keydown', { key: '8' })
	await nextTick()
	expect(seen.at(-1)).toEqual({ mode: 'replace', typed: '8' })
	const own = cell(1, 3).get('input.own')
	expect((own.element as HTMLInputElement).value).toBe('8')
	await own.trigger('keydown', { key: 'Enter' })
	await nextTick()
	expect(rows.value[0]?.stock).toBe(8)
	expect(document.activeElement).toBe(cell(2, 3).element)

	await cell(2, 3).trigger('keydown', { key: 'F2' })
	await nextTick()
	expect(seen.at(-1)).toEqual({ mode: 'edit', typed: undefined })
})

test('`selectColumn` of the header slot selects the cells of the column, with Shift from the active cell, and sorting stays apart', async () => {
	const { wrapper, controller } = setup(
		{ cellSelection: true },
		{
			header: (props: HeaderSlotProps<Part>) => [
				h('button', { class: 'sort', onClick: props.toggleSort }, props.label),
				h('button', { class: 'pick', onClick: props.selectColumn }, 'Select'),
			],
		},
	)
	await wrapper.findAll('button.pick')[0]?.trigger('click')
	expect(controller.getView().cellSelection).toEqual({
		from: { rowId: 'a', columnId: 'name' },
		to: { rowId: 'c', columnId: 'name' },
		rows: 3,
		columns: 1,
	})
	expect(controller.getView().sort).toEqual([])
	await wrapper.findAll('button.pick')[2]?.trigger('click', { shiftKey: true })
	expect(controller.getView().cellSelection).toMatchObject({
		from: { rowId: 'a', columnId: 'name' },
		to: { rowId: 'c', columnId: 'stock' },
		columns: 3,
	})
	await wrapper.findAll('button.sort')[2]?.trigger('click')
	expect(controller.getView().sort).toEqual([{ id: 'stock', desc: false }])
})

test('a search field and a view that are made before their table log no warning of UI SDK', async () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
	const error = vi.spyOn(console, 'error').mockImplementation(() => {})
	try {
		const controller = createTableController()
		let search: ReturnType<typeof useTableSearch> | undefined
		let view: ReturnType<typeof useTableView> | undefined
		const Page = defineComponent({
			setup() {
				search = useTableSearch(controller)
				view = useTableView(controller)
				return () => [
					h('output', search?.text.value),
					h(Table<Part>, { rows: parts(), columns, controller, defaultFilter: { search: 'nut' } }),
				]
			},
		})
		const wrapper = mount(Page, { attachTo: document.body })
		wrappers.push(wrapper)
		await nextTick()
		// The field has the text of the table as soon as the table is there.
		expect(search?.text.value).toBe('nut')
		expect(view?.value?.dataRowCount).toBe(1)
		const said = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]))
		expect(said.filter((text) => text.includes('[ui-sdk]'))).toEqual([])
	} finally {
		warn.mockRestore()
		error.mockRestore()
	}
})
