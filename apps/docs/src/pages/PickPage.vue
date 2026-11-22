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
import {
	createFormulaEngine,
	formulaHelp,
	insertReference,
	useFormulaBar,
} from 'ui-sdk-table-vue/formulas'
import { computed, shallowRef, useTemplateRef } from 'vue'

// The pick mode with each kind of field that writes a formula, for the
// browser tests of `e2e/pick.spec.ts`. `?field=own` writes into the text field
// of the table's editor, `?field=slot` into a field of the `editor` slot, and
// `?field=bar` (the default) into a formula bar outside the table.
// `?pick=off` leaves the pick mode off, and `?dir=rtl` reads the table from right to left. `?rows=50000` gives that many rows in
// a row window, and gives the cells of each reference of the bar an
// attribute through `cellAttrs`, to measure a key in the bar.

type Line = { id: string; item: string; price: number; qty: number; total?: unknown }

const query = new URLSearchParams(location.search)
const field = query.get('field') ?? 'bar'
const allowed = query.get('pick') !== 'off'
const rtl = query.get('dir') === 'rtl'
// The text of the field inside the table while a person types it, and the caret of the field.
const draft = shallowRef('')
const caret = shallowRef(0)

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
	// A sum gives the table a footer, which a press in the pick mode leaves alone.
	{ id: 'qty', header: 'Qty', aggregate: 'sum' },
	{ id: 'total', header: 'Total' },
]

const engine = createFormulaEngine()
const controller = createTableController()
const bar = useFormulaBar(controller)

// A new function at each new text of the bar, as an app that colours the references does.
const references = computed(() => {
	const at = bar.cell.value
	return count && at && bar.text.value.startsWith('=')
		? controller.getFormulaReferences(bar.text.value, at)
		: []
})
const cellAttrs = computed(() => {
	const found = references.value
	if (!found.length) return undefined
	const mark = controller.getReferenceMarks(found)
	return (context: CellAttrsContext<Line>) => {
		const at = context.kind === 'cell' ? mark(context.node.id, context.column.id) : undefined
		return at && { 'data-state': 'reference', 'data-reference-edge': at.edges || undefined }
	}
})
const frame = useTemplateRef<HTMLElement>('frame')
const picks = shallowRef<string[]>([])
// The reference of the last pick, which the next step of a drag replaces.
const last = shallowRef<{ start: number; end: number } | null>(null)

function write(input: HTMLInputElement, address: string) {
	const selection = last.value ?? { start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 }
	const next = insertReference(input.value, selection, address)
	last.value = { start: next.start, end: next.end }
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
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
// The mode is on where a reference fits at the caret, and while the reference
// of the last pick is still the end of the text that the person sees.
const picking = computed(() => {
	if (!allowed) return false
	const text = field === 'bar' ? bar.text.value : draft.value
	return last.value !== null || formulaHelp(text, caret.value, { locale: 'en-US' }).reference
})
function keydown(event: KeyboardEvent) {
	if (['Shift', 'Control', 'Meta', 'Alt'].includes(event.key)) return
	if (!ARROWS.has(event.key) || !picking.value) {
		last.value = null
		return
	}
	// The table hears the keys of its own text field; a field of the app calls `movePick`.
	if (field === 'own') return
	event.preventDefault()
	controller.movePick(event.key as 'ArrowUp', {
		extend: event.shiftKey,
		edge: event.ctrlKey || event.metaKey,
		// After a typed character, the pick starts from the cell of the field again.
		start: last.value === null,
	})
}
function edited(event: Event) {
	if (event.target instanceof HTMLInputElement) draft.value = event.target.value
	read(event)
}
function read(event: Event) {
	if (event.target instanceof HTMLInputElement) caret.value = event.target.selectionStart ?? 0
}
// A character that opens the editor is its first text, with no `input` event.
function focused(event: FocusEvent) {
	draft.value = event.target instanceof HTMLInputElement ? event.target.value : ''
	read(event)
}
</script>

<template>
	<main
		ref="frame"
		@keydown.capture="keydown"
		@keyup.capture="read"
		@click.capture="read"
		@input.capture="edited"
		@focusin.capture="focused"
	>
		<h1>Pick cells</h1>
		<input
			v-if="field === 'bar'"
			aria-label="Formula bar"
			:value="bar.text.value"
			@input="bar.input(($event.target as HTMLInputElement).value)"
			@keydown.enter="bar.commit()"
		/>
		<output data-testid="picks">{{ picks.join(' ') }}</output>
		<div
			:style="count ? { blockSize: '500px', overflow: 'auto' } : undefined"
			:dir="rtl ? 'rtl' : undefined"
		>
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
