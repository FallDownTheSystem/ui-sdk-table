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

type Line = { id: string; item: string; price: number | null; qty: number | null; total?: unknown }

const lines = shallowRef<Line[]>([
	{ id: 'l1', item: 'Desk lamp', price: 39, qty: 4, total: 156 },
	{ id: 'l2', item: 'Monitor arm', price: 89, qty: 2, total: 178 },
	{ id: 'l3', item: 'Keyboard', price: 59, qty: 3, total: 177 },
	{ id: 'l4', item: 'Cable tray', price: 24, qty: 6, total: 144 },
	{ id: 'l5', item: 'Footrest', price: 45, qty: 1, total: 45 },
	{ id: 'l6', item: 'Headset', price: 79, qty: 2, total: 158 },
	{ id: 'l7', item: 'Webcam', price: 65, qty: 2, total: 130 },
	{ id: 'l8', item: 'Desk mat', price: 19, qty: 5, total: 95 },
	{ id: 'l9', item: 'Chair', price: 249, qty: 1, total: 249 },
	{ id: 'l10', item: 'Power strip', price: 29, qty: 3, total: 87 },
	{ id: 'l11', item: 'Headphones', price: 129, qty: 1, total: 129 },
	{ id: 'l12', item: 'USB hub', price: 35, qty: 4, total: 140 },
	{ id: 'l13', item: 'Bookend', price: 12, qty: 6, total: 72 },
	{ id: 'l14', item: 'Whiteboard', price: 89, qty: 1, total: 89 },
	{ id: 'sum', item: 'Order total', price: null, qty: null, total: 1849 },
])

const columns: ColumnDef<Line>[] = [
	rowNumberColumn<Line>(),
	// A name stays a name: a text with `=` in it is kept as text here.
	{ id: 'item', header: 'Item', allowFormula: false, width: 170 },
	{ id: 'price', header: 'Price', format: 'decimal', width: 100 },
	{ id: 'qty', header: 'Qty', format: 'integer', width: 80 },
	{ id: 'total', header: 'Total', format: 'decimal', width: 120 },
]

// The formulas are plain data in the stored form: `[price]` is "this row", `[total@l1]` a cell of row l1.
const START: CellFormulas = {
	cells: {
		...Object.fromEntries(
			['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10', 'l11', 'l12', 'l13', 'l14'].map(
				(id) => [id, { total: '=[price]*[qty]' }],
			),
		),
		sum: { total: '=SUM([total@l1]:[total@l14])' },
	},
}

// One engine for the life of the tile.
const engine = createFormulaEngine()
const controller = createTableController()
const bar = useFormulaBar(controller)
const frame = useTemplateRef<HTMLElement>('frame')
const formulas = shallowRef<CellFormulas>(START)

const backToCell = () => frame.value?.querySelector<HTMLElement>('[data-active]')?.focus()
function commit() {
	if (bar.commit()) backToCell()
}
function cancel() {
	bar.cancel()
	backToCell()
}

function onCellEdit(edits: readonly CellEdit<Line>[]) {
	lines.value = applyEdits(lines.value, edits)
}
</script>

<template>
	<div class="demo">
		<form class="formula-bar" @submit.prevent="commit">
			<output class="formula-address" data-testid="formula-address">{{
				bar.address.value || '—'
			}}</output>
			<input
				class="formula-field"
				data-slot="input"
				aria-label="Formula of the active cell"
				placeholder="Press a cell"
				:value="bar.text.value"
				:disabled="!bar.ready.value"
				:aria-invalid="!!bar.error.value"
				@input="bar.input(($event.target as HTMLInputElement).value)"
				@keydown.escape.prevent="cancel"
			/>
		</form>
		<p class="demo-note formula-issue" role="status">
			{{ bar.error.value || 'Try =SUM(D1:D3), or change a price and watch D15.' }}
		</p>
		<div ref="frame" class="sink-frame">
			<Table
				v-model:cell-formulas="formulas"
				:formulas="engine"
				:rows="lines"
				:columns="columns"
				:controller="controller"
				locale="en-US"
				sheet
				column-letters
				aria-label="An order with formulas in its cells"
				@cell-edit="onCellEdit"
			/>
		</div>
	</div>
</template>
