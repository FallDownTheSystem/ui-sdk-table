<script setup lang="ts">
import {
	applyEdits,
	createTableController,
	rowNumberColumn,
	Table,
	type CellEdit,
	type CellFormulas,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { createFormulaEngine, useFormulaBar } from 'ui-sdk-table-vue/formulas'
import { shallowRef, useTemplateRef } from 'vue'

// A cell that can hold a formula can hold the text of an error, such as `#DIV/0!`.
type Line = { id: string; item: string; price: number | null; qty: number | null; total?: unknown }

const lines = shallowRef<Line[]>([
	{ id: 'l1', item: 'Desk lamp', price: 39, qty: 4, total: 156 },
	{ id: 'l2', item: 'Monitor arm', price: 89, qty: 2, total: 178 },
	{ id: 'l3', item: 'Keyboard', price: 59, qty: 3, total: 177 },
	{ id: 'sum', item: 'Order total', price: null, qty: null, total: 511 },
])

const columns: ColumnDef<Line>[] = [
	rowNumberColumn<Line>(),
	{ id: 'item', header: 'Item', allowFormula: false },
	{ id: 'price', header: 'Price', format: 'decimal' },
	{ id: 'qty', header: 'Qty', format: 'integer' },
	{ id: 'total', header: 'Total', format: 'decimal' },
]

// The stored form holds ids: `[price]` is "this row", `[total@l1]` the total of row l1.
const formulas = shallowRef<CellFormulas>({
	cells: {
		l1: { total: '=[price]*[qty]' },
		l2: { total: '=[price]*[qty]' },
		l3: { total: '=[price]*[qty]' },
		sum: { total: '=SUM([total@l1]:[total@l3])' },
	},
})

// One engine for the life of the table.
const engine = createFormulaEngine()
const controller = createTableController()
const bar = useFormulaBar(controller)
const frame = useTemplateRef<HTMLElement>('frame')

// After the bar, focus goes back to the active cell.
const backToCell = () => frame.value?.querySelector<HTMLElement>('[data-active]')?.focus()
function commit() {
	if (bar.commit()) backToCell()
}
function cancel() {
	bar.cancel()
	backToCell()
}
</script>

<template>
	<form @submit.prevent="commit">
		<output data-testid="address">{{ bar.address.value || '—' }}</output>
		<input
			aria-label="Formula of the active cell"
			:value="bar.text.value"
			:disabled="!bar.ready.value"
			:aria-invalid="!!bar.error.value"
			@input="bar.input(($event.target as HTMLInputElement).value)"
			@keydown.escape.prevent="cancel"
		/>
		<p role="status">{{ bar.error.value }}</p>
	</form>
	<div ref="frame">
		<Table
			v-model:cell-formulas="formulas"
			:formulas="engine"
			:rows="lines"
			:columns="columns"
			:controller="controller"
			locale="en-US"
			sheet
			column-letters
			aria-label="An order with formulas"
			@cell-edit="(edits: readonly CellEdit<Line>[]) => (lines = applyEdits(lines, edits))"
		/>
	</div>
</template>
