<script setup lang="ts">
import {
	applyEdits,
	CELL_FORMAT_NAMES,
	createTableController,
	rowNumberColumn,
	Table,
	useSelectionSummary,
	useTableSearch,
	useTableView,
	type AggregateName,
	type CellEdit,
	type CellFormat,
	type CellFormatPatch,
	type CellFormats,
	type ColumnAggregates,
	type ColumnDef,
	type ColumnPinning,
	type StandardSchemaV1,
	type TableChangeDetails,
	type TableEditDetails,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'

type Product = {
	id: string
	product: string
	group: string
	price: number | null
	discount: number | null
	stock: number | null
	date: string
}

const query = new URLSearchParams(location.search)
// With `dir=rtl`, the sheet reads from right to left.
const rtl = query.get('dir') === 'rtl'

type Entry = [string, string, number, number, number, string]
const FIRST: Entry = ['Bolt M6', 'Fasteners', 0.12, 0, 4200, '2026-01-12']
const LIST: Entry[] = [
	FIRST,
	['Nut M6', 'Fasteners', 0.05, 0, 9800, '2026-01-12'],
	['Washer 6 mm', 'Fasteners', 0.02, 0.1, 15000, '2026-01-19'],
	['Wood screw 4x40', 'Fasteners', 0.08, 0, 7600, '2026-02-02'],
	['Hammer 300 g', 'Tools', 14.9, 0.15, 85, '2026-02-09'],
	['Screwdriver PH2', 'Tools', 6.5, 0, 240, '2026-02-09'],
	['Spirit level 60 cm', 'Tools', 22, 0.2, 40, '2026-02-16'],
	['Tape measure 5 m', 'Tools', 8.75, 0, 130, '2026-03-02'],
	['Wall paint 10 l', 'Paint', 54, 0.1, 62, '2026-03-09'],
	['Primer 3 l', 'Paint', 27.5, 0, 48, '2026-03-09'],
	['Brush 50 mm', 'Paint', 4.2, 0.05, 310, '2026-03-16'],
	['Roller set', 'Paint', 12.4, 0, 95, '2026-03-23'],
]
const GROUPS = ['Fasteners', 'Tools', 'Paint']
const LARGE = 50_000
const ROW_HEIGHT = 36

function createProducts(count: number): Product[] {
	return Array.from({ length: count }, (_unused, index) => {
		const [product, group, price, discount, stock, date] = LIST[index % LIST.length] ?? FIRST
		const round = Math.floor(index / LIST.length)
		return {
			id: `p${index + 1}`,
			product: round ? `${product} #${round + 1}` : product,
			group,
			price,
			discount,
			stock,
			date,
		}
	})
}

// A schema of the Standard Schema kind, written by hand. A schema of Zod,
// Valibot or ArkType has the same shape and goes in the same place.
function schema(check: (value: unknown) => string | undefined): StandardSchemaV1 {
	return {
		'~standard': {
			version: 1,
			vendor: 'demo',
			validate: (value) => {
				const message = check(value)
				return message === undefined ? { value } : { issues: [{ message }] }
			},
		},
	}
}
const empty = (value: unknown) => value == null || value === ''

// A check that only a server can do. A schema can answer with a promise, and
// the editor, a paste and a clear all wait for it.
const slow = shallowRef(false)
const SLOW_MS = 600
const priceSchema: StandardSchemaV1 = {
	'~standard': {
		version: 1,
		vendor: 'demo',
		validate: (value) => {
			const result =
				empty(value) || (typeof value === 'number' && value >= 0)
					? { value }
					: { issues: [{ message: 'A price is 0 or more.' }] }
			if (!slow.value) return result
			return new Promise((resolve) => setTimeout(() => resolve(result), SLOW_MS))
		},
	},
}

const columns: ColumnDef<Product>[] = [
	// The number of each row, as its header: a press on it selects the row.
	rowNumberColumn<Product>(),
	{
		id: 'product',
		header: 'Product',
		width: 220,
		sortable: true,
		schema: schema((value) =>
			typeof value === 'string' && value.trim() !== '' ? undefined : 'A product has a name.',
		),
	},
	{ id: 'group', header: 'Group', width: 130, editable: false },
	{
		id: 'price',
		header: 'Price',
		width: 120,
		sortable: true,
		format: 'currency',
		formatOptions: { currency: 'EUR', showUnit: true },
		schema: priceSchema,
	},
	{
		id: 'discount',
		header: 'Discount',
		width: 120,
		format: 'percentage',
		formatOptions: { showUnit: true },
		schema: schema((value) =>
			empty(value) || (typeof value === 'number' && value >= 0 && value <= 1)
				? undefined
				: 'A discount is a part of 1, such as 0.15 for 15 %.',
		),
	},
	{
		id: 'stock',
		header: 'Stock',
		width: 110,
		sortable: true,
		format: 'integer',
		aggregate: 'sum',
		schema: schema((value) =>
			empty(value) || (typeof value === 'number' && Number.isInteger(value) && value >= 0)
				? undefined
				: 'A stock is a whole number, 0 or more.',
		),
	},
	{
		id: 'date',
		header: 'Listed',
		width: 140,
		format: 'date',
		schema: schema((value) =>
			empty(value) ||
			(typeof value === 'string' &&
				/^\d{4}-\d{2}-\d{2}$/.test(value) &&
				!Number.isNaN(Date.parse(value)))
				? undefined
				: 'A date is written as year-month-day, such as 2026-03-09.',
		),
	},
]

const controller = createTableController()
const view = useTableView(controller)
const search = useTableSearch(controller)
// What the selected cells add up to, counted after the selection rests.
const summary = useSelectionSummary(controller)

// The formats and the functions of the totals are state of the owner, as the
// rows are: an app saves them with its document.
const formats = shallowRef<CellFormats>({})
const aggregates = shallowRef<ColumnAggregates>({})
const pinned = shallowRef(false)
// One object for each answer: a new object at each render of the page would be a new state of the table.
const PINNED: ColumnPinning = { start: ['product'] }
const NOT_PINNED: ColumnPinning = {}
// The names that a format can carry as a colour. The style of the page gives each its colours.
const COLORS = ['red', 'amber', 'green', 'blue']
const TOTALS: readonly AggregateName[] = ['sum', 'mean', 'min', 'max', 'count']
const TOTAL_COLUMNS = ['price', 'discount', 'stock']

// The format of the active cell, for the pressed buttons of the toolbar.
const active = computed<CellFormat>(() => {
	const at = view.value?.activeCell
	// Read here so that a change of the formats makes this answer again.
	void formats.value
	return at ? controller.getCellFormat(at.rowId, at.columnId) : {}
})

function format(patch: CellFormatPatch) {
	controller.formatCells(patch)
}

/** One decimal more or fewer for the selected cells, from what the active cell shows. */
function decimals(step: number) {
	const at = view.value?.activeCell
	const shown = active.value.format ?? columns.find((column) => column.id === at?.columnId)?.format
	// What a format shows when nothing says how many: a price has two, a share and a count none.
	const usual = shown === 'currency' || shown === 'decimal' ? 2 : 0
	const now = active.value.decimals ?? usual
	format({ decimals: Math.min(10, Math.max(0, now + step)) })
}

function onFormats(_value: CellFormats, details: TableChangeDetails) {
	log.value = [`formats: ${details.reason}`, ...log.value].slice(0, 6)
}

/** A file with the cells as the screen shows them. The writers load at the first export. */
async function exportCsv() {
	const { downloadCsv } = await import('ui-sdk-table-vue/export')
	downloadCsv(controller.exportData({ totals: true }), 'price-list')
}

const valueOf = (event: Event) => (event.target as HTMLSelectElement).value
const rows = shallowRef(createProducts(LIST.length))
const large = shallowRef(false)
const grouped = shallowRef(false)
const locked = shallowRef(false)
const log = shallowRef<string[]>([])

function load(many: boolean) {
	large.value = many
	rows.value = createProducts(many ? LARGE : LIST.length)
	// Other rows are other data: a step of the rows before has nothing to take back.
	if (view.value) controller.clearHistory()
}

function onCellEdit(edits: readonly CellEdit<Product>[], details: TableEditDetails) {
	if (locked.value) {
		details.cancel()
		return
	}
	// The table reports an undo and a redo as it reports an edit, so this line is the whole owner.
	rows.value = applyEdits(rows.value, edits)
	const cells = edits
		.slice(0, 6)
		.map((edit) => `${edit.rowId}.${edit.columnId}=${JSON.stringify(edit.value)}`)
	const more = edits.length > 6 ? ` and ${edits.length - 6} more` : ''
	log.value = [`${details.reason}: ${cells.join(' ')}${more}`, ...log.value].slice(0, 6)
}

// The steps are no state of the view, so they are read again after each change of the table.
const steps = computed(() => {
	if (!view.value) return { undo: 0, redo: 0 }
	const { entries, position } = controller.getHistory()
	return { undo: position, redo: entries.length - position }
})

const status = computed(() => {
	const at = view.value?.activeCell
	const cells = view.value?.cellSelection
	if (!at && !cells) return 'No cell'
	// A letter or the corner is active: it is no cell of the data, and it can select cells.
	const where = at ? `${at.rowId} ${at.columnId}` : 'No cell'
	if (!cells || (cells.rows === 1 && cells.columns === 1)) return where
	return `${where}, ${cells.rows} by ${cells.columns} cells from ${cells.from.rowId} ${cells.from.columnId} to ${cells.to.rowId} ${cells.to.columnId}`
})

/** Reads the text of the discount editor: an empty text empties the cell, and any other text must be a number. */
function discountOf(event: Event): unknown {
	const text = (event.target as HTMLInputElement).value.trim()
	return text === '' ? null : Number(text)
}

/** Gives focus to an editor of the page when the table shows it, with the caret after its text. */
const focusOnMount = (el: unknown) => {
	if (!(el instanceof HTMLInputElement)) return
	queueMicrotask(() => {
		el.focus()
		el.setSelectionRange(el.value.length, el.value.length)
	})
}
</script>

<template>
	<h1>Sheet</h1>
	<p>
		A table with the <code>sheet</code> option. Type on a cell and press Enter to go down, or an
		arrow key to go on. Delete empties the selected cells, Ctrl+X cuts them, and a paste repeats a
		block over a range that it fits. Ctrl+Z takes a change back, Ctrl+Y or Ctrl+Shift+Z puts it on
		again. Tab leaves the table; inside a selected range it walks the range, and Escape drops the
		range.
	</p>
	<p>
		Drag the square at the corner of the selected cells to fill, or press Ctrl+D and Ctrl+R: one
		line repeats, and two numbers or two days go on with their step. A press on a row number selects
		the row, and a press on a letter above the headers its column; the corner selects every cell.
		Space on a letter selects its column, and Shift with an arrow takes the next one. Ctrl+B and
		Ctrl+I make the selected cells bold and italic, and the buttons below give them a format. The
		footer picks the function of each total.
	</p>
	<div class="toolbar">
		<button type="button" :aria-pressed="!large" @click="load(false)">12 rows</button>
		<button type="button" :aria-pressed="large" @click="load(true)">50,000 rows</button>
		<label><input v-model="grouped" type="checkbox" /> Group by group</label>
		<label><input v-model="pinned" type="checkbox" /> Pin Product</label>
		<label><input v-model="locked" type="checkbox" /> Refuse every edit</label>
		<label><input v-model="slow" type="checkbox" /> Slow check of prices</label>
		<label>
			Search
			<input
				v-model="search.text.value"
				type="search"
				@keydown.escape="search.clear()"
				@keydown.enter="search.flush()"
			/>
		</label>
	</div>
	<div class="toolbar">
		<button type="button" :disabled="!view?.canUndo" @click="controller.undo()">Undo</button>
		<button type="button" :disabled="!view?.canRedo" @click="controller.redo()">Redo</button>
		<button type="button" @click="controller.clearHistory()">Forget the steps</button>
		<span>
			Steps: <output data-testid="steps">{{ steps.undo }} to undo, {{ steps.redo }} to redo</output>
		</span>
		<span> Cell: <output data-testid="status">{{ status }}</output> </span>
	</div>
	<div class="toolbar" role="toolbar" aria-label="Format of the selected cells">
		<button
			type="button"
			class="look"
			aria-label="Bold"
			:aria-pressed="active.bold === true"
			:disabled="!view?.activeCell"
			@click="controller.toggleCellFormat('bold')"
		>
			<b>B</b>
		</button>
		<button
			type="button"
			class="look"
			aria-label="Italic"
			:aria-pressed="active.italic === true"
			:disabled="!view?.activeCell"
			@click="controller.toggleCellFormat('italic')"
		>
			<i>I</i>
		</button>
		<label>
			Side
			<select
				data-testid="format-align"
				:value="active.align ?? ''"
				:disabled="!view?.activeCell"
				@change="format({ align: (valueOf($event) || null) as CellFormat['align'] | null })"
			>
				<option value="">As the column</option>
				<option value="start">Start</option>
				<option value="center">Center</option>
				<option value="end">End</option>
			</select>
		</label>
		<label>
			Show as
			<select
				data-testid="format-kind"
				:value="active.format ?? ''"
				:disabled="!view?.activeCell"
				@change="format({ format: (valueOf($event) || null) as CellFormat['format'] | null })"
			>
				<option value="">As the column</option>
				<option v-for="name in CELL_FORMAT_NAMES" :key="name" :value="name">{{ name }}</option>
			</select>
		</label>
		<button
			type="button"
			aria-label="One decimal more"
			:disabled="!view?.activeCell"
			@click="decimals(1)"
		>
			.0 +
		</button>
		<button
			type="button"
			aria-label="One decimal fewer"
			:disabled="!view?.activeCell"
			@click="decimals(-1)"
		>
			.0 −
		</button>
		<label>
			Fill
			<select
				data-testid="format-fill"
				:value="active.fill ?? ''"
				:disabled="!view?.activeCell"
				@change="format({ fill: valueOf($event) || null })"
			>
				<option value="">None</option>
				<option v-for="name in COLORS" :key="name" :value="name">{{ name }}</option>
			</select>
		</label>
		<label>
			Text
			<select
				data-testid="format-color"
				:value="active.color ?? ''"
				:disabled="!view?.activeCell"
				@change="format({ color: valueOf($event) || null })"
			>
				<option value="">None</option>
				<option v-for="name in COLORS" :key="name" :value="name">{{ name }}</option>
			</select>
		</label>
		<button type="button" :disabled="!view?.activeCell" @click="controller.clearCellFormats()">
			Clear the format
		</button>
		<button type="button" @click="aggregates = {}">Totals as defined</button>
		<button type="button" @click="exportCsv">Export CSV</button>
	</div>
	<div class="scroller sheet" :class="{ tall: large }" :dir="rtl ? 'rtl' : undefined">
		<Table
			v-model:cell-formats="formats"
			v-model:column-aggregates="aggregates"
			:rows="rows"
			:columns="columns"
			:controller="controller"
			:group-by="grouped ? ['group'] : []"
			:default-expanded="GROUPS.map((group) => `group/group=${group}`)"
			:column-pinning="pinned ? PINNED : NOT_PINNED"
			:format-colors="COLORS"
			:row-window="large"
			:row-height="large ? ROW_HEIGHT : undefined"
			sheet
			column-letters
			sticky-header
			sticky-footer
			aria-label="Price list"
			@cell-edit="onCellEdit"
			@cell-formats-change="onFormats"
		>
			<template #header="{ column, label, leaf, sort, toggleSort, selectColumn }">
				<button v-if="leaf && column.sortable" type="button" @click="toggleSort">
					{{ label }}{{ sort === 'asc' ? ' ↑' : sort === 'desc' ? ' ↓' : '' }}
				</button>
				<span v-else>{{ label }}</span>
				<button
					v-if="leaf && !column.rowHeader"
					type="button"
					class="column-pick"
					:aria-label="`Select the cells of ${label}`"
					@click="selectColumn"
				>
					▾
				</button>
			</template>
			<template #edit-discount="{ text, typed, mode, error, save, cancel }">
				<input
					:ref="focusOnMount"
					class="cell-editor"
					aria-label="Edit Discount"
					:data-mode="mode"
					:aria-invalid="error ? 'true' : undefined"
					:value="typed ?? text"
					@keydown.enter.prevent="save(discountOf($event), $event)"
					@keydown.escape.prevent="cancel()"
					@keydown.stop
				/>
				<span v-if="error" class="cell-error">{{ error }}</span>
			</template>
			<template #foot="{ column, text, aggregate, setAggregate }">
				<template v-if="TOTAL_COLUMNS.includes(column.id)">
					<select
						class="total-pick"
						:aria-label="`Total of ${column.header}`"
						:value="aggregate ?? ''"
						@change="setAggregate((valueOf($event) || null) as AggregateName | null, $event)"
						@keydown.stop
					>
						<option value="">No total</option>
						<option v-for="name in TOTALS" :key="name" :value="name">{{ name }}</option>
					</select>
					<span class="total-text">{{ text }}</span>
				</template>
			</template>
		</Table>
	</div>
	<p class="summary" data-testid="summary">
		<template v-if="summary && summary.numbers > 1">
			Sum {{ summary.texts.sum }}, average {{ summary.texts.mean }}, smallest
			{{ summary.texts.min }}, largest {{ summary.texts.max }}, {{ summary.count }} of
			{{ summary.cells }} cells with a value
		</template>
		<template v-else-if="summary"
			>{{ summary.count }} of {{ summary.cells }} cells with a value</template
		>
		<template v-else>No cell is selected</template>
	</p>
	<h2>Last reports</h2>
	<button type="button" @click="log = []">Clear the list</button>
	<ol data-testid="log">
		<li v-for="(line, index) in log" :key="index">{{ line }}</li>
	</ol>
</template>
