<script setup lang="ts">
import {
	applyEdits,
	createTableController,
	rowNumberColumn,
	Table,
	type CellAttrsContext,
	type CellEdit,
	type CellPick,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { createFormulaEngine, insertReference, useFormulaBar } from 'ui-sdk-table-vue/formulas'
import { computed, shallowRef, useTemplateRef } from 'vue'

// The pick mode with each kind of field that writes a formula, for the
// browser tests of `e2e/pick.spec.ts`. `?field=own` writes into the text field
// of the table's editor, `?field=slot` into a field of the `editor` slot, and
// `?field=bar` (the default) into a formula bar outside the table.
// `?pick=off` leaves the pick mode off. `?rows=50000` gives that many rows in
// a row window, and gives the cells of each reference of the bar an
// attribute through `cellAttrs`, to measure a key in the bar.

type Line = { id: string; item: string; price: number; qty: number; total?: unknown }

const query = new URLSearchParams(location.search)
const field = query.get('field') ?? 'bar'
const allowed = query.get('pick') !== 'off'
// The text of the field inside the table while a person types it.
const draft = shallowRef('')

const count = Number(query.get('rows') ?? 0)
const lines = shallowRef<Line[]>(
	count
		? Array.from({ length: count }, (_, index) => ({
				id: `l${index + 1}`,
				item: `Item ${index + 1}`,
				price: index % 100,
				qty: 1 + (index % 7),
				total: 0,
			}))
		: [
				{ id: 'l1', item: 'Desk lamp', price: 39, qty: 4, total: 0 },
				{ id: 'l2', item: 'Monitor arm', price: 89, qty: 2, total: 0 },
				{ id: 'l3', item: 'Keyboard', price: 59, qty: 3, total: 0 },
				{ id: 'l4', item: 'Mouse', price: 25, qty: 5, total: 0 },
			],
)

const columns: ColumnDef<Line>[] = [
	rowNumberColumn<Line>(),
	{ id: 'item', header: 'Item', allowFormula: false },
	{ id: 'price', header: 'Price' },
	{ id: 'qty', header: 'Qty' },
	{ id: 'total', header: 'Total' },
]

const engine = createFormulaEngine()
const controller = createTableController()
const bar = useFormulaBar(controller)

const rowIndex = new Map(lines.value.map((line, index) => [line.id, index]))
const columnIndex = new Map(columns.map((column, index) => [column.id, index]))
// A new function at each new text of the bar, as an app that colours the references does.
const references = computed(() => {
	const at = bar.cell.value
	return count && at && bar.text.value.startsWith('=')
		? controller.getFormulaReferences(bar.text.value, at)
		: []
})
const cellAttrs = computed(() => {
	const found = references.value
	return (context: CellAttrsContext<Line>) => {
		if (context.kind !== 'cell' || !found.length) return undefined
		const row = rowIndex.get(context.node.id) ?? -1
		const col = columnIndex.get(context.column.id) ?? -1
		const hit = found.some(
			(ref) =>
				row >= (rowIndex.get(ref.from.rowId) ?? 0) &&
				row <= (rowIndex.get(ref.to.rowId) ?? -1) &&
				col >= (columnIndex.get(ref.from.columnId) ?? 0) &&
				col <= (columnIndex.get(ref.to.columnId) ?? -1),
		)
		return hit ? { 'data-state': 'reference' } : undefined
	}
})
const frame = useTemplateRef<HTMLElement>('frame')
const picks = shallowRef<string[]>([])
// The reference of the last pick, which the next step of a drag replaces.
let last: { start: number; end: number } | null = null

function write(input: HTMLInputElement, address: string) {
	const selection = last ?? { start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 }
	const next = insertReference(input.value, selection, address)
	last = { start: next.start, end: next.end }
	input.value = next.text
	input.setSelectionRange(next.end, next.end)
	input.dispatchEvent(new Event('input', { bubbles: true }))
}

function pick(cells: CellPick | null) {
	const address = cells && controller.getRangeAddress(cells)
	if (!address) return
	picks.value = [...picks.value, address]
	const target =
		field === 'bar'
			? frame.value?.querySelector<HTMLInputElement>('[aria-label="Formula bar"]')
			: frame.value?.querySelector<HTMLInputElement>(
					field === 'own' ? '[data-slot="table-editor"]' : '[data-testid="slot-field"]',
				)
	if (target) write(target, address)
}
const typed = () => (last = null)
// The mode is on while the text of the field is a formula, as an app does it.
const picking = computed(
	() => allowed && (field === 'bar' ? bar.text.value : draft.value).startsWith('='),
)
function edited(event: Event) {
	if (event.target instanceof HTMLInputElement) draft.value = event.target.value
}
function focused(event: FocusEvent) {
	if (!(event.target instanceof HTMLInputElement)) draft.value = ''
}
</script>

<template>
	<main ref="frame" @keydown.capture="typed" @input.capture="edited" @focusin.capture="focused">
		<h1>Pick cells</h1>
		<input
			v-if="field === 'bar'"
			aria-label="Formula bar"
			:value="bar.text.value"
			@input="bar.input(($event.target as HTMLInputElement).value)"
			@keydown.enter="bar.commit()"
		/>
		<output data-testid="picks">{{ picks.join(' ') }}</output>
		<div :style="count ? { blockSize: '500px', overflow: 'auto' } : undefined">
			<Table
				:formulas="engine"
				:rows="lines"
				:columns="columns"
				:controller="controller"
				:pick-cells="picking"
				:cell-attrs="query.get('attrs') === 'off' ? undefined : cellAttrs"
				:row-window="count > 0"
				sheet
				column-letters
				locale="en-US"
				aria-label="Lines"
				@picked-cells-change="pick"
				@cell-edit="(edits: readonly CellEdit<Line>[]) => (lines = applyEdits(lines, edits))"
			>
				<template v-if="field === 'slot'" #editor="{ text, save, cancel }">
					<input
						data-testid="slot-field"
						aria-label="Own editor"
						:default-value="text"
						@vue:mounted="({ el }: { el: HTMLInputElement }) => el.focus()"
						@keydown.enter.stop.prevent="save(($event.target as HTMLInputElement).value, $event)"
						@keydown.escape.stop.prevent="cancel()"
						@keydown.stop
					/>
				</template>
			</Table>
		</div>
	</main>
</template>
