<script setup lang="ts">
import {
	applyEdits,
	createTableController,
	Table,
	useTableSearch,
	useTableView,
	type CellEdit,
	type ColumnDef,
	type StandardSchemaV1,
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
	if (!at) return 'No cell'
	const where = `${at.rowId} ${at.columnId}`
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
	<div class="toolbar">
		<button type="button" :aria-pressed="!large" @click="load(false)">12 rows</button>
		<button type="button" :aria-pressed="large" @click="load(true)">50,000 rows</button>
		<label><input v-model="grouped" type="checkbox" /> Group by group</label>
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
	<div class="scroller" :class="{ tall: large }" :dir="rtl ? 'rtl' : undefined">
		<Table
			:rows="rows"
			:columns="columns"
			:controller="controller"
			:group-by="grouped ? ['group'] : []"
			:default-expanded="GROUPS.map((group) => `group/group=${group}`)"
			:row-window="large"
			:row-height="large ? ROW_HEIGHT : undefined"
			sheet
			sticky-header
			sticky-footer
			aria-label="Price list"
			@cell-edit="onCellEdit"
		>
			<template #header="{ column, label, leaf, sort, toggleSort, selectColumn }">
				<button v-if="leaf && column.sortable" type="button" @click="toggleSort">
					{{ label }}{{ sort === 'asc' ? ' ↑' : sort === 'desc' ? ' ↓' : '' }}
				</button>
				<span v-else>{{ label }}</span>
				<button
					v-if="leaf"
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
		</Table>
	</div>
	<h2>Last reports</h2>
	<button type="button" @click="log = []">Clear the list</button>
	<ol data-testid="log">
		<li v-for="(line, index) in log" :key="index">{{ line }}</li>
	</ol>
</template>
