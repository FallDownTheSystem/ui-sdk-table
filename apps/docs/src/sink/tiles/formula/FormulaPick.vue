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
	FORMULA_FUNCTIONS,
	formulaHelp,
	insertReference,
	useFormulaBar,
} from 'ui-sdk-table-vue/formulas'
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue'

type Line = { id: string; item: string; price: number; qty: number; total?: unknown }

const lines = shallowRef<Line[]>([
	{ id: 'l1', item: 'Desk lamp', price: 39, qty: 4, total: null },
	{ id: 'l2', item: 'Monitor arm', price: 89, qty: 2, total: null },
	{ id: 'l3', item: 'Keyboard', price: 59, qty: 3, total: null },
	{ id: 'l4', item: 'Headset', price: 79, qty: 2, total: null },
])

const columns: ColumnDef<Line>[] = [
	rowNumberColumn<Line>(),
	{ id: 'item', header: 'Item', allowFormula: false, width: 150 },
	{ id: 'price', header: 'Price', format: 'decimal', width: 90 },
	{ id: 'qty', header: 'Qty', format: 'integer', width: 70 },
	{ id: 'total', header: 'Total', format: 'decimal', width: 100 },
]

const engine = createFormulaEngine()
const controller = createTableController()
const bar = useFormulaBar(controller)
const field = useTemplateRef<HTMLInputElement>('field')
const caret = shallowRef(0)
// The reference of the last pick: the next step of a drag replaces it.
const picked = shallowRef<{ start: number; end: number } | null>(null)

const help = computed(() => formulaHelp(bar.text.value, caret.value, { locale: 'en-US' }))
const picking = computed(
	() => bar.text.value.startsWith('=') && (help.value.reference || picked.value !== null),
)
const word = computed(() => {
	const token = help.value.token
	return token?.kind === 'name' ? token : null
})
const suggestions = computed(() => {
	const typed = word.value?.text.toUpperCase()
	return typed ? FORMULA_FUNCTIONS.filter((info) => info.name.startsWith(typed)).slice(0, 4) : []
})

function moveCaret(place: number) {
	caret.value = place
	void nextTick(() => field.value?.setSelectionRange(place, place))
}
function typed(event: Event) {
	const el = event.target as HTMLInputElement
	picked.value = null
	bar.input(el.value)
	caret.value = el.selectionEnd ?? 0
}
function choose(name: string) {
	if (!word.value) return
	const next = insertReference(bar.text.value, word.value, `${name}(`)
	bar.input(next.text)
	moveCaret(next.end)
}
function pick(cells: CellPick | null) {
	const address = cells && controller.getRangeAddress(cells)
	if (!address) return
	const next = insertReference(
		bar.text.value,
		picked.value ?? { start: caret.value, end: caret.value },
		address,
	)
	bar.input(next.text)
	picked.value = next
	moveCaret(next.end)
}

const references = computed(() => {
	const at = bar.cell.value
	return at && bar.text.value.startsWith('=')
		? controller.getFormulaReferences(bar.text.value, at)
		: []
})
const rowOf = (id: string) => lines.value.findIndex((line) => line.id === id)
const colOf = (id: string) => columns.findIndex((column) => column.id === id)
const cellAttrs = computed(() => {
	const found = references.value
	return (context: CellAttrsContext<Line>) => {
		if (context.kind !== 'cell' || !found.length) return undefined
		const row = rowOf(context.node.id)
		const col = colOf(context.column.id)
		const index = found.findIndex(
			(ref) =>
				row >= rowOf(ref.from.rowId) &&
				row <= rowOf(ref.to.rowId) &&
				col >= colOf(ref.from.columnId) &&
				col <= colOf(ref.to.columnId),
		)
		return index < 0 ? undefined : { 'data-state': index % 2 ? 'alert' : 'accent' }
	}
})
</script>

<template>
	<div class="demo">
		<form
			class="formula-bar"
			@submit.prevent="
				picked = null;
				bar.commit()
			"
		>
			<output class="formula-address">{{ bar.address.value || '—' }}</output>
			<input
				ref="field"
				class="formula-field"
				data-slot="input"
				aria-label="Formula of the active cell"
				placeholder="Press a total, type =SUM("
				autocomplete="off"
				:value="bar.text.value"
				:disabled="!bar.ready.value"
				@input="typed"
				@keyup="caret = ($event.target as HTMLInputElement).selectionEnd ?? 0"
				@keydown.escape.prevent="bar.cancel()"
			/>
		</form>
		<p class="demo-note formula-issue" role="status">
			<template v-if="suggestions.length">
				<button
					v-for="info in suggestions"
					:key="info.name"
					type="button"
					data-slot="button"
					@pointerdown.prevent
					@click="choose(info.name)"
				>
					{{ info.name }}
				</button>
			</template>
			<template v-else-if="help.call?.info">
				{{ help.call.name }}({{
					help.call.info.arguments
						.map((arg, index) =>
							index === help.call?.argument ? arg.name.toUpperCase() : arg.name,
						)
						.join(', ')
				}})
			</template>
			<template v-else>{{ bar.error.value || 'Then drag over the prices.' }}</template>
		</p>
		<div class="sink-frame">
			<Table
				:formulas="engine"
				:rows="lines"
				:columns="columns"
				:controller="controller"
				:pick-cells="picking"
				:cell-attrs="cellAttrs"
				locale="en-US"
				sheet
				column-letters
				aria-label="An order with a formula writer"
				@picked-cells-change="pick"
				@cell-edit="(edits: readonly CellEdit<Line>[]) => (lines = applyEdits(lines, edits))"
			/>
		</div>
	</div>
</template>
