<script setup lang="ts">
import {
	applyEdits,
	createTableController,
	rowNumberColumn,
	Table,
	type CellAttrsContext,
	type CellEdit,
	type CellFormulas,
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

type Line = { id: string; item: string; price: number | null; qty: number | null; total?: unknown }

const lines = shallowRef<Line[]>([
	{ id: 'l1', item: 'Desk lamp', price: 39, qty: 4, total: 156 },
	{ id: 'l2', item: 'Monitor arm', price: 89, qty: 2, total: 178 },
	{ id: 'l3', item: 'Keyboard', price: 59, qty: 3, total: 177 },
	{ id: 'l4', item: 'Order total', price: null, qty: null, total: null },
])

const columns: ColumnDef<Line>[] = [
	rowNumberColumn<Line>(),
	{ id: 'item', header: 'Item', allowFormula: false },
	{ id: 'price', header: 'Price', format: 'decimal' },
	{ id: 'qty', header: 'Qty', format: 'integer' },
	{ id: 'total', header: 'Total', format: 'decimal' },
]

const formulas = shallowRef<CellFormulas>({
	cells: {
		l1: { total: '=[price]*[qty]' },
		l2: { total: '=[price]*[qty]' },
		l3: { total: '=[price]*[qty]' },
	},
})

const engine = createFormulaEngine()
const controller = createTableController()
const bar = useFormulaBar(controller)
const field = useTemplateRef<HTMLInputElement>('field')
const frame = useTemplateRef<HTMLElement>('frame')

// The caret of the field, and the reference that the last pick put there:
// the next pick replaces it, so a drag writes one reference.
const caret = shallowRef({ start: 0, end: 0 })
const picked = shallowRef<{ start: number; end: number } | null>(null)
// A screen reader hears nothing when a script changes the text of a field, so
// the status line says the address of each pick.
const said = shallowRef('')

const text = computed(() => bar.text.value)
const help = computed(() => formulaHelp(text.value, caret.value.end, { locale: 'en-US' }))
const formula = computed(() => text.value.startsWith('='))
// The pick mode is on where a reference fits at the caret, and after a pick until the person types.
const picking = computed(() => formula.value && (help.value.reference || picked.value !== null))

// The functions whose name starts with the word at the caret.
const word = computed(() => {
	const token = help.value.token
	return token && (token.kind === 'name' || token.kind === 'function') ? token : null
})
const suggestions = computed(() => {
	const typed = word.value?.text.toUpperCase()
	return typed ? FORMULA_FUNCTIONS.filter((info) => info.name.startsWith(typed)).slice(0, 6) : []
})

function readCaret() {
	const el = field.value
	if (el) caret.value = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 }
}
function place(start: number, end = start) {
	caret.value = { start, end }
	void nextTick(() => field.value?.setSelectionRange(start, end))
}
function typed(event: Event) {
	picked.value = null
	said.value = ''
	bar.input((event.target as HTMLInputElement).value)
	readCaret()
}
function choose(name: string) {
	const token = word.value
	if (!token) return
	const next = insertReference(text.value, token, `${name}(`)
	bar.input(next.text)
	picked.value = null
	place(next.end)
}
function pick(cells: CellPick | null) {
	const address = cells && controller.getRangeAddress(cells)
	if (!address) return
	const next = insertReference(text.value, picked.value ?? caret.value, address)
	bar.input(next.text)
	picked.value = { start: next.start, end: next.end }
	said.value = `Picked ${address}`
	place(next.end)
}
const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const
function arrow(event: KeyboardEvent) {
	const key = ARROWS.find((name) => name === event.key)
	if (!key || !picking.value || event.altKey) return
	event.preventDefault()
	controller.movePick(key, {
		extend: event.shiftKey,
		edge: event.ctrlKey || event.metaKey,
		// After a typed character, a pick starts again from the cell of the field.
		start: picked.value === null,
	})
}
function commit() {
	picked.value = null
	said.value = ''
	// After the field, focus goes back to the active cell.
	if (bar.commit()) frame.value?.querySelector<HTMLElement>('[data-active]')?.focus()
}

// Each reference of the text and its cells get one colour, by its place in the text.
const references = computed(() => {
	const at = bar.cell.value
	return formula.value && at ? controller.getFormulaReferences(text.value, at) : []
})
const rowIndex = computed(() => new Map(lines.value.map((line, index) => [line.id, index])))
const columnIndex = new Map(columns.slice(1).map((column, index) => [column.id, index]))
const cellAttrs = computed(() => {
	const found = references.value
	return (context: CellAttrsContext<Line>) => {
		if (context.kind !== 'cell' || !found.length) return undefined
		const row = rowIndex.value.get(context.node.id) ?? -1
		const col = columnIndex.get(context.column.id) ?? -1
		const index = found.findIndex(
			(ref) =>
				row >= (rowIndex.value.get(ref.from.rowId) ?? 0) &&
				row <= (rowIndex.value.get(ref.to.rowId) ?? -1) &&
				col >= (columnIndex.get(ref.from.columnId) ?? 0) &&
				col <= (columnIndex.get(ref.to.columnId) ?? -1),
		)
		return index < 0 ? undefined : { 'data-reference': String(index % 4) }
	}
})
</script>

<template>
	<form class="writer" @submit.prevent="commit">
		<output data-testid="address">{{ bar.address.value || '—' }}</output>
		<input
			ref="field"
			aria-label="Formula of the active cell"
			placeholder="Press a cell, then type ="
			autocomplete="off"
			spellcheck="false"
			:value="text"
			:disabled="!bar.ready.value"
			:aria-invalid="!!bar.error.value"
			@input="typed"
			@select="readCaret"
			@keyup="readCaret"
			@click="readCaret"
			@keydown="arrow"
			@keydown.escape.prevent="bar.cancel()"
		/>
		<p v-if="help.call?.info" data-testid="hint">
			{{ help.call.name }}(<template v-for="(arg, index) in help.call.info.arguments" :key="index"
				><template v-if="index">, </template
				><strong v-if="index === help.call.argument">{{ arg.name }}</strong
				><template v-else>{{ arg.name }}</template></template
			>)
		</p>
		<ul v-if="suggestions.length" aria-label="Functions">
			<li v-for="info in suggestions" :key="info.name">
				<button type="button" @pointerdown.prevent @click="choose(info.name)">
					<strong>{{ info.name }}</strong> {{ info.help }}
				</button>
			</li>
		</ul>
		<p role="status">{{ bar.error.value || said }}</p>
	</form>
	<div ref="frame">
		<Table
			v-model:cell-formulas="formulas"
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
</template>
