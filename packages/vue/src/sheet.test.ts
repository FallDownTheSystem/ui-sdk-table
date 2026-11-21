import { mount } from '@vue/test-utils'
import { afterEach, expect, test } from 'vite-plus/test'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import {
	applyEdits,
	createTableController,
	rowNumberColumn,
	setFormats,
	Table,
	useSelectionSummary,
	type CellAttrsContext,
	type CellEdit,
	type CellFormats,
	type CellSlotProps,
	type ColumnAggregates,
	type ColumnDef,
	type FootSlotProps,
	type TableChangeDetails,
	type TableEditDetails,
} from './index'

// The sheet features that need rows that come and go, slots, or `v-model`:
// what a test of the primitive alone cannot show.

type Part = { id: string; name: string; kind: string; price: number; stock: number }

const parts = (): Part[] => [
	{ id: 'a', name: 'Bolt', kind: 'Steel', price: 2.5, stock: 40 },
	{ id: 'b', name: 'Nut', kind: 'Steel', price: 0.5, stock: 90 },
	{ id: 'c', name: 'Washer', kind: 'Brass', price: 0.2, stock: 15 },
	{ id: 'd', name: 'Screw', kind: 'Brass', price: 1.5, stock: 60 },
]

const columns: ColumnDef<Part>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'kind', header: 'Kind' },
	{ id: 'price', header: 'Price', format: 'decimal', formatOptions: { locale: 'en-US' } },
	{ id: 'stock', header: 'Stock', sortable: true, aggregate: 'sum' },
]
const numbered: ColumnDef<Part>[] = [rowNumberColumn<Part>(), ...columns]

const wrappers: { unmount: () => void }[] = []
afterEach(() => {
	for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

const cellRef = (rowId: string, columnId: string) => ({ rowId, columnId })

/** A table whose owner puts each report into its rows and holds the formats, as an app with `v-model` does. */
function setup(
	extra: Record<string, unknown> = {},
	slots: Record<string, unknown> = {},
	/** Whether the owner holds the formats (`v-model`), or the table keeps them itself. */
	held = true,
) {
	const rows = shallowRef(parts())
	const formats = shallowRef<CellFormats>({})
	const controller = createTableController()
	const reports: { edits: readonly CellEdit<Part>[]; details: TableEditDetails }[] = []
	const formatReasons: string[] = []
	const wrapper = mount(
		() =>
			h(
				Table<Part>,
				{
					rows: rows.value,
					columns,
					controller,
					locale: 'en-US',
					'aria-label': 'Parts',
					...(held
						? {
								cellFormats: formats.value,
								'onUpdate:cellFormats': (value: CellFormats) => (formats.value = value),
							}
						: undefined),
					onCellFormatsChange: (_value: CellFormats, details: TableChangeDetails) =>
						formatReasons.push(details.reason),
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
	const cell = (rowId: string, columnId: string) => {
		const index = controller.getView().visibleColumns.findIndex((column) => column.id === columnId)
		const row = wrapper.findAll('tbody tr').find((item) => item.attributes('data-row-id') === rowId)
		const at = row ?? wrapper.findAll('tbody tr')[rows.value.findIndex((item) => item.id === rowId)]
		if (!at) throw new Error(`No row "${rowId}" is rendered.`)
		const found = at.findAll('th, td')[index]
		if (!found) throw new Error(`No cell of column "${columnId}" is rendered.`)
		return found
	}
	const texts = (columnId: string) => {
		const index = controller.getView().visibleColumns.findIndex((column) => column.id === columnId)
		return wrapper.findAll('tbody tr').map((row) => row.findAll('th, td')[index]?.text())
	}
	return { wrapper, rows, formats, controller, reports, formatReasons, cell, texts }
}

// --- Row numbers -----------------------------------------------------------

test('the number of a row is a `th` with the role of a row header, counted over group rows and pages', async () => {
	const { wrapper, controller } = setup({
		columns: numbered,
		sheet: true,
		defaultGroupBy: ['kind'],
		defaultExpanded: ['kind:Steel', 'kind:Brass'],
	})
	await nextTick()
	const open = controller.getView()
	// Whatever ids the groups have, both must be open for this test.
	if (!open.hasExpanded) controller.expandAll()
	await nextTick()
	const headers = wrapper.findAll('tbody th')
	expect(headers.map((header) => header.text())).toEqual(['1', '2', '3', '4'])
	for (const header of headers) {
		expect(header.attributes('role')).toBe('rowheader')
		expect(header.attributes('data-row-header')).toBe('')
		expect(header.attributes('aria-selected')).toBeUndefined()
	}
	expect(headers[2]?.attributes('aria-label')).toBe('Row 3')
	// Two group rows and four data rows: a group row holds no number.
	expect(wrapper.findAll('tbody tr')).toHaveLength(6)
})

test('the numbers of the rows go on on the next page', async () => {
	const { wrapper, controller } = setup({
		columns: numbered,
		sheet: true,
		defaultPage: { page: 1, pageSize: 3 },
	})
	await nextTick()
	expect(wrapper.findAll('tbody th').map((header) => header.text())).toEqual(['1', '2', '3'])
	controller.setPage(2)
	await nextTick()
	expect(wrapper.findAll('tbody th').map((header) => header.text())).toEqual(['4'])
})

test('the `row-header` slot gets the number and a function that selects the cells of its row', async () => {
	const { wrapper, controller } = setup(
		{ columns: numbered, sheet: true },
		{
			'row-header': (props: { number: number; row: Part; selectRow: (event?: Event) => void }) =>
				h(
					'button',
					{ type: 'button', onClick: (event: Event) => props.selectRow(event) },
					`${props.number}: ${props.row.name}`,
				),
		},
	)
	await nextTick()
	const buttons = wrapper.findAll('tbody th button')
	expect(buttons.map((button) => button.text())).toEqual([
		'1: Bolt',
		'2: Nut',
		'3: Washer',
		'4: Screw',
	])
	await buttons[1]?.trigger('click')
	expect(controller.getView().cellSelection).toEqual({
		from: cellRef('b', 'name'),
		to: cellRef('b', 'stock'),
		rows: 1,
		columns: 4,
	})
	// The number itself is in no range: a copy holds the four values.
	expect(controller.copyCells()).toBe('Nut\tSteel\t0.5\t90')
})

// --- Fill ------------------------------------------------------------------

test('the fill handle is in the cell at the end corner of the selected cells, and nowhere without the option; a fill from code needs no handle', async () => {
	const { wrapper, controller } = setup({ sheet: true })
	await nextTick()
	const handles = () => wrapper.findAll('[data-slot="table-fill-handle"]')
	controller.selectCells(cellRef('a', 'price'), cellRef('b', 'stock'))
	await nextTick()
	expect(handles()).toHaveLength(1)
	expect(handles()[0]?.attributes('aria-hidden')).toBe('true')
	const corner = handles()[0]?.element.closest('td')
	expect(corner?.textContent).toContain('90')
	controller.selectCells(cellRef('c', 'name'))
	await nextTick()
	expect(handles()).toHaveLength(1)
	expect(handles()[0]?.element.closest('td')?.textContent).toContain('Washer')

	const off = setup({ sheet: true, fillHandle: false })
	await nextTick()
	off.controller.selectCells(cellRef('a', 'price'), cellRef('b', 'stock'))
	await nextTick()
	expect(off.wrapper.findAll('[data-slot="table-fill-handle"]')).toHaveLength(0)
	// The option is what a person can do. A call from code fills, as a paste from code pastes.
	void off.controller.fillCells('down')
	await nextTick()
	expect(off.rows.value.map((row) => row.price)).toEqual([2.5, 2.5, 0.2, 1.5])
})

test('an undo of a fill puts back exactly the values of before, also after a sort, a filter and a row that left', async () => {
	const { rows, controller, reports, wrapper } = setup({ sheet: true })
	await nextTick()
	const before = parts()
	controller.selectCells(cellRef('a', 'stock'), cellRef('d', 'stock'))
	void controller.fillCells('down', 2)
	await nextTick()
	// 40, 90: the step is 50.
	expect(rows.value.map((row) => row.stock)).toEqual([40, 90, 140, 190])
	expect(reports).toHaveLength(1)
	expect(controller.getHistory().entries).toMatchObject([{ reason: 'fill', cells: 2 }])

	// The list is another one now: sorted, filtered, and one of the filled rows is gone.
	controller.sortBy('name', 'desc')
	controller.setSearch('Brass')
	rows.value = rows.value.filter((row) => row.id !== 'd')
	await nextTick()
	expect(wrapper.findAll('tbody tr')).toHaveLength(1)

	controller.undo()
	await nextTick()
	// Row c has its old value, row d is gone and takes nothing, and no other cell changed.
	expect(rows.value).toEqual(before.filter((row) => row.id !== 'd'))
	expect(reports[1]?.details.reason).toBe('undo')
	expect(reports[1]?.edits.map((edit) => [edit.rowId, edit.previous, edit.value])).toEqual([
		['c', 140, 15],
	])
	// The step is taken back, so a second undo has nothing.
	expect(controller.getView().canUndo).toBe(false)
	controller.redo()
	await nextTick()
	expect(rows.value.find((row) => row.id === 'c')?.stock).toBe(140)
})

test('an undo of a fill reaches a row that a filter hides', async () => {
	const { rows, controller } = setup({ sheet: true })
	await nextTick()
	controller.selectCells(cellRef('a', 'price'), cellRef('d', 'price'))
	void controller.fillCells('down')
	await nextTick()
	expect(rows.value.map((row) => row.price)).toEqual([2.5, 2.5, 2.5, 2.5])
	controller.setSearch('Bolt')
	await nextTick()
	controller.undo()
	await nextTick()
	expect(rows.value).toEqual(parts())
})

// --- The summary of a selection --------------------------------------------

test('`useSelectionSummary` follows the selection and an edit inside it', async () => {
	const rows = shallowRef(parts())
	const controller = createTableController()
	let summary: ReturnType<typeof useSelectionSummary> | undefined
	const Page = defineComponent({
		setup() {
			summary = useSelectionSummary(controller, { debounce: 0 })
			return () =>
				h(Table<Part>, {
					rows: rows.value,
					columns,
					controller,
					sheet: true,
					locale: 'en-US',
					onCellEdit: (edits: readonly CellEdit<Part>[]) => {
						rows.value = applyEdits(rows.value, edits)
					},
				})
		},
	})
	const wrapper = mount(Page, { attachTo: document.body })
	wrappers.push(wrapper)
	await nextTick()
	// No cell is active yet.
	expect(summary?.value).toBeNull()

	controller.selectCells(cellRef('a', 'stock'), cellRef('c', 'stock'))
	await new Promise((resolve) => setTimeout(resolve, 5))
	expect(summary?.value).toMatchObject({ cells: 3, numbers: 3, sum: 145, min: 15, max: 90 })
	expect(summary?.value?.texts.sum).toBe('145')
	const first = summary?.value

	void controller.editCell('b', 'stock', 100)
	await nextTick()
	await new Promise((resolve) => setTimeout(resolve, 5))
	expect(summary?.value).not.toBe(first)
	expect(summary?.value?.sum).toBe(155)

	// One cell is counted at once, without the pause.
	controller.selectCells(cellRef('d', 'price'))
	expect(summary?.value).toMatchObject({ cells: 1, sum: 1.5 })
	expect(summary?.value?.texts.sum).toBe('1.50')
	controller.clearCellSelection()
	await new Promise((resolve) => setTimeout(resolve, 5))
	expect(summary?.value).toMatchObject({ cells: 1 })
})

// --- The function of the sum row -------------------------------------------

test('`v-model:column-aggregates` and the footer slot choose the function of a total, and it is no step of the history', async () => {
	const chosen = ref<ColumnAggregates>({})
	const seen: FootSlotProps<Part>[] = []
	const { wrapper, controller } = setup(
		{
			sheet: true,
			columnAggregates: chosen.value,
			'onUpdate:columnAggregates': (value: ColumnAggregates) => (chosen.value = value),
		},
		{
			'foot-stock': (props: FootSlotProps<Part>) => {
				seen.push(props)
				return `${props.aggregate}: ${props.text}`
			},
		},
	)
	await nextTick()
	expect(wrapper.get('tfoot').text()).toContain('sum: 205')
	seen.at(-1)?.setAggregate('max')
	await nextTick()
	expect(chosen.value).toEqual({ stock: 'max' })
	// The owner holds the state; this test passes it on by a new render.
	await wrapper.setProps({})
	expect(controller.getView().canUndo).toBe(false)
	expect(controller.getHistory().entries).toEqual([])
})

test('a chosen function reaches the footer, with its name for a screen reader, and `null` takes the footer row away', async () => {
	const chosen = shallowRef<ColumnAggregates>({})
	const controller = createTableController()
	const wrapper = mount(
		() =>
			h(Table<Part>, {
				rows: parts(),
				columns,
				controller,
				locale: 'en-US',
				columnAggregates: chosen.value,
				'onUpdate:columnAggregates': (value: ColumnAggregates) => (chosen.value = value),
			}),
		{ attachTo: document.body },
	)
	wrappers.push(wrapper)
	await nextTick()
	const foot = () => wrapper.find('tfoot td[data-column="stock"]')
	expect(foot().text()).toBe('205')
	expect(foot().attributes('data-aggregate')).toBe('sum')
	expect(foot().attributes('aria-label')).toBeUndefined()

	controller.setColumnAggregate('stock', 'mean')
	await nextTick()
	expect(foot().text()).toBe('51.25')
	expect(foot().attributes('data-aggregate')).toBe('mean')
	expect(foot().attributes('aria-label')).toBe('Average: 51.25')

	controller.setColumnAggregate('price', 'max')
	await nextTick()
	expect(wrapper.find('tfoot td[data-column="price"]').text()).toBe('2.50')

	// Two choices in one turn: the second starts from the first, also before the owner passed it back.
	controller.setColumnAggregate('price', undefined)
	controller.setColumnAggregate('stock', null)
	await nextTick()
	expect(chosen.value).toEqual({ stock: null })
	expect(wrapper.find('tfoot').exists()).toBe(false)
})

// --- Cell formats ----------------------------------------------------------

test('formats that the table keeps: the text and the attributes of a cell follow its format, and only that cell renders again', async () => {
	const runs: string[] = []
	const formats = shallowRef<CellFormats>({})
	const { controller, cell, texts } = setup(
		{
			sheet: true,
			formatColors: ['red', 'green'],
			onCellFormatsChange: (value: CellFormats) => (formats.value = value),
		},
		{
			cell: (props: CellSlotProps<Part>) => {
				runs.push(`${props.node.id}:${props.column.id}`)
				return props.format?.bold ? h('strong', props.text) : props.text
			},
		},
		false,
	)
	await nextTick()
	expect(texts('price')).toEqual(['2.50', '0.50', '0.20', '1.50'])

	runs.length = 0
	controller.formatCells(
		{ decimals: 0, bold: true, fill: 'green' },
		{ from: cellRef('a', 'price') },
	)
	await nextTick()
	expect(formats.value).toEqual({
		cells: { a: { price: { decimals: 0, bold: true, fill: 'green' } } },
	})
	expect(texts('price')).toEqual(['3', '0.50', '0.20', '1.50'])
	expect(cell('a', 'price').find('strong').exists()).toBe(true)
	expect(cell('a', 'price').attributes()).toMatchObject({
		'data-bold': '',
		'data-fill': 'green',
		'data-format': 'decimal',
	})
	expect(cell('b', 'price').attributes('data-bold')).toBeUndefined()
	// One cell got a format, and one cell ran its slot again.
	expect(runs).toEqual(['a:price'])

	// A format of the whole column reaches every row, and the cell keeps what it said itself.
	runs.length = 0
	controller.formatCells(
		{ format: 'currency', currency: 'USD', decimals: 2 },
		{ columns: ['price'] },
	)
	await nextTick()
	expect(formats.value.columns).toEqual({
		price: { format: 'currency', currency: 'USD', decimals: 2 },
	})
	expect(formats.value.cells).toEqual({ a: { price: { bold: true, fill: 'green' } } })
	expect(texts('price')).toEqual(['$2.50', '$0.50', '$0.20', '$1.50'])
	expect([...new Set(runs)].toSorted()).toEqual(['a:price', 'b:price', 'c:price', 'd:price'])
})

test('`v-model:cell-formats`: two changes in one turn both reach the owner, and the cells show what the owner holds', async () => {
	const { controller, formats, cell, texts } = setup({ sheet: true })
	await nextTick()
	controller.formatCells({ italic: true }, { from: cellRef('c', 'stock') })
	// The owner did not pass the first change back yet. The second one must not lose it.
	controller.formatCells({ decimals: 1 }, { columns: ['stock'] })
	expect(controller.getCellFormat('c', 'stock')).toEqual({ italic: true, decimals: 1 })
	await nextTick()
	expect(formats.value).toEqual({
		columns: { stock: { decimals: 1 } },
		cells: { c: { stock: { italic: true } } },
	})
	expect(texts('stock')).toEqual(['40.0', '90.0', '15.0', '60.0'])
	expect(cell('c', 'stock').attributes('data-italic')).toBe('')

	// Two undos in one turn take both back, and two redos put both on again.
	controller.undo()
	controller.undo()
	await nextTick()
	expect(formats.value).toEqual({})
	expect(texts('stock')).toEqual(['40', '90', '15', '60'])
	controller.redo()
	controller.redo()
	await nextTick()
	expect(formats.value).toEqual({
		columns: { stock: { decimals: 1 } },
		cells: { c: { stock: { italic: true } } },
	})

	// An owner that does not take a change keeps its formats, and the table follows the owner.
	const fixed = setup({ sheet: true, 'onUpdate:cellFormats': () => {} })
	await nextTick()
	fixed.controller.formatCells({ bold: true }, { columns: ['name'] })
	await nextTick()
	expect(fixed.cell('a', 'name').attributes('data-bold')).toBeUndefined()
	expect(fixed.controller.getCellFormat('a', 'name')).toEqual({})
})

test('a format stays with its row through a sort, and a row that comes later has the format of its column', async () => {
	const { controller, rows, cell, texts } = setup({ sheet: true })
	await nextTick()
	controller.formatCells({ italic: true }, { from: cellRef('c', 'stock') })
	controller.formatCells({ decimals: 1 }, { columns: ['stock'] })
	controller.sortBy('name', 'asc')
	await nextTick()
	// Bolt, Nut, Screw, Washer: row c is last now.
	expect(texts('name')).toEqual(['Bolt', 'Nut', 'Screw', 'Washer'])
	const italic = [...document.querySelectorAll('tbody td[data-italic]')]
	expect(italic).toHaveLength(1)
	expect(italic[0]?.textContent).toBe('15.0')

	rows.value = [...rows.value, { id: 'e', name: 'Anchor', kind: 'Steel', price: 3, stock: 7 }]
	await nextTick()
	expect(texts('stock')[0]).toBe('7.0')
	expect(cell('e', 'stock').attributes('data-format')).toBe('decimal')
})

test('the footer and the totals of a group show as their column does, without a render of the rows', async () => {
	const rendered: string[] = []
	const { controller, wrapper } = setup(
		{
			sheet: true,
			defaultGroupBy: ['kind'],
			rowAttrs: (context: { kind: string }) => {
				rendered.push(context.kind)
				return undefined
			},
		},
		{},
		false,
	)
	await nextTick()
	const foot = () => wrapper.get('tfoot td[data-column="stock"]').text()
	const groups = () =>
		wrapper.findAll('tbody td[data-kind="group-total"]').map((total) => total.text())
	expect(foot()).toBe('205')
	expect(groups()).toEqual(['130', '75'])

	rendered.length = 0
	controller.formatCells(
		{ format: 'currency', currency: 'USD', decimals: 0 },
		{ columns: ['stock'] },
	)
	await nextTick()
	expect(foot()).toBe('$205')
	expect(groups()).toEqual(['$130', '$75'])
	expect(wrapper.get('tfoot td[data-column="stock"]').attributes('data-format')).toBe('currency')
	// No row was rendered again for it: the cells of the column heard the change themselves.
	expect(rendered).toEqual([])
})

test('the label of a group that says a total follows the format of that column', async () => {
	// The first column has a total, so the label covers it and says it.
	const first: ColumnDef<Part>[] = [
		{ id: 'stock', header: 'Stock', aggregate: 'sum' },
		{ id: 'kind', header: 'Kind' },
		{ id: 'price', header: 'Price', aggregate: 'sum' },
	]
	const { controller, wrapper } = setup({ columns: first, sheet: true, defaultGroupBy: ['kind'] })
	await nextTick()
	const label = () => wrapper.get('tbody td[data-kind="group-label"]').text()
	expect(label()).toContain('130')
	controller.formatCells({ decimals: 2 }, { columns: ['stock'] })
	await nextTick()
	expect(label()).toContain('130.00')
})

test('a caller of `cellAttrs` cannot overwrite the looks of a format', async () => {
	const { controller, cell } = setup({
		sheet: true,
		formatColors: ['red', 'green'],
		cellAttrs: (context: CellAttrsContext<Part>) =>
			context.kind === 'cell'
				? {
						'data-fill': 'red',
						'data-bold': '',
						'data-align': 'end',
						'data-italic': '',
						'data-color': 'red',
						class: 'mine',
					}
				: undefined,
	})
	await nextTick()
	controller.formatCells({ fill: 'green' }, { from: cellRef('a', 'name') })
	await nextTick()
	const attrs = cell('a', 'name').attributes()
	expect(attrs['data-fill']).toBe('green')
	expect(attrs.class).toContain('mine')
	for (const name of ['data-bold', 'data-align', 'data-italic', 'data-color']) {
		expect(attrs[name]).toBeUndefined()
	}
	expect(cell('b', 'name').attributes('data-fill')).toBeUndefined()
})

test('an undo of a format step leaves a format that the owner gave another cell beside the history', async () => {
	const { controller, formats, formatReasons, cell } = setup({ sheet: true })
	await nextTick()
	controller.selectCells(cellRef('a', 'price'), cellRef('b', 'stock'))
	controller.formatCells({ bold: true })
	await nextTick()
	const step = formats.value
	// The owner writes its own state: the table hears it as a prop, and it is no step.
	formats.value = setFormats(
		setFormats(formats.value, { rows: ['d'], columns: ['name'] }, { italic: true }),
		{ rows: ['a'], columns: ['price'] },
		{ decimals: 0 },
	)
	await nextTick()
	expect(controller.getHistory().entries).toHaveLength(1)
	expect(cell('d', 'name').attributes('data-italic')).toBe('')

	controller.undo()
	await nextTick()
	// Bold is gone from the four cells. The italic cell and the decimals of the owner stay.
	expect(formats.value).toEqual({
		cells: { a: { price: { decimals: 0 } }, d: { name: { italic: true } } },
	})
	expect(formatReasons).toEqual(['imperative', 'undo'])
	expect(cell('a', 'price').text()).toBe('3')
	expect(cell('a', 'price').attributes('data-bold')).toBeUndefined()

	controller.redo()
	await nextTick()
	expect(formats.value.cells?.a).toEqual({
		price: { decimals: 0, bold: true },
		stock: { bold: true },
	})
	expect(formats.value.cells?.b).toBe(step.cells?.b)
	expect(formats.value.cells?.d).toEqual({ name: { italic: true } })
})

test('a format step and a fill step go back in their order, each exactly', async () => {
	const { controller, formats, rows } = setup({ sheet: true })
	await nextTick()
	controller.selectCells(cellRef('a', 'stock'), cellRef('d', 'stock'))
	controller.formatCells({ decimals: 1 })
	await nextTick()
	const formatted = formats.value
	void controller.fillCells('down')
	await nextTick()
	expect(rows.value.map((row) => row.stock)).toEqual([40, 40, 40, 40])
	controller.undo()
	await nextTick()
	expect(rows.value).toEqual(parts())
	expect(formats.value).toBe(formatted)
	controller.undo()
	await nextTick()
	expect(formats.value).toEqual({})
	expect(controller.getView()).toMatchObject({ canUndo: false, canRedo: true })
})

test('the editor of a cell with a percent format shows the plain value', async () => {
	const { controller, wrapper, cell, rows } = setup({ sheet: true })
	await nextTick()
	controller.formatCells({ format: 'percentage' }, { from: cellRef('b', 'price') })
	await nextTick()
	expect(cell('b', 'price').text()).toBe('50%')
	controller.startEdit('b', 'price')
	await nextTick()
	const input = wrapper.get('tbody input')
	// The value as code writes it, as in a column with the `percentage` format.
	expect((input.element as HTMLInputElement).value).toBe('0.5')
	await input.setValue('0.75')
	await input.trigger('keydown', { key: 'Enter' })
	await nextTick()
	expect(rows.value[1]?.price).toBe(0.75)
	expect(cell('b', 'price').text()).toBe('75%')
})

test('an export holds the text of the screen for a cell with a format', async () => {
	const { controller } = setup({ sheet: true })
	await nextTick()
	controller.formatCells({ format: 'currency', currency: 'USD' }, { from: cellRef('a', 'price') })
	await nextTick()
	const data = controller.exportData({ columns: ['price'] })
	expect(data.rows.map((row) => row.cells[0]?.text)).toEqual(['$2.50', '0.50', '0.20', '1.50'])
	expect(data.rows[0]?.cells[0]?.format).toEqual({ format: 'currency', currency: 'USD' })
})

// --- The preset ------------------------------------------------------------

test('`<Table sheet>` in its short form gives every feature, and each can be set to false', async () => {
	const rows = shallowRef(parts())
	const controller = createTableController()
	const off = createTableController()
	const Page = defineComponent({
		components: { Table },
		setup: () => ({
			rows,
			columns,
			controller,
			off,
			edit: (edits: readonly CellEdit<Part>[]) => (rows.value = applyEdits(rows.value, edits)),
		}),
		template: `
			<Table :rows="rows" :columns="columns" :controller="controller" sheet aria-label="On" @cell-edit="edit" />
			<Table :rows="rows" :columns="columns" :controller="off" sheet :history="false" :fill-handle="false" aria-label="Off" @cell-edit="edit" />`,
	})
	const wrapper = mount(Page, { attachTo: document.body })
	wrappers.push(wrapper)
	await nextTick()
	const [on] = wrapper.findAll('table')
	expect(on?.attributes('data-sheet')).toBe('')

	controller.selectCells(cellRef('a', 'stock'), cellRef('c', 'stock'))
	void controller.fillCells('down')
	await nextTick()
	expect(rows.value.map((row) => row.stock)).toEqual([40, 40, 40, 60])
	controller.undo()
	await nextTick()
	expect(rows.value).toEqual(parts())
	expect(wrapper.findAll('[data-slot="table-fill-handle"]')).toHaveLength(1)

	off.selectCells(cellRef('a', 'stock'), cellRef('c', 'stock'))
	await nextTick()
	expect(wrapper.findAll('[data-slot="table-fill-handle"]')).toHaveLength(1)
	expect(() => off.undo()).toThrow(/history/)
	void off.editCell('a', 'stock', 41)
	await nextTick()
	expect(rows.value[0]?.stock).toBe(41)
	expect(off.getView().canUndo).toBe(false)
})
