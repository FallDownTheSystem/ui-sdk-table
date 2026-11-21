<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	createTableController,
	Table,
	useTableView,
	type CellFormat,
	type CellFormats,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'

type Fund = { id: string; fund: string; fee: number; year: number; five: number }

const funds: Fund[] = [
	{ id: 'f1', fund: 'Nordic Index', fee: 0.2, year: 7.84, five: 41.2 },
	{ id: 'f2', fund: 'Global Bonds', fee: 0.35, year: -1.36, five: 3.9 },
	{ id: 'f3', fund: 'Small Caps', fee: 1.1, year: 12.07, five: 58.6 },
	{ id: 'f4', fund: 'Green Energy', fee: 0.75, year: -6.52, five: 22.4 },
	{ id: 'f5', fund: 'Money Market', fee: 0.1, year: 2.91, five: 9.3 },
]
const columns: ColumnDef<Fund>[] = [
	{ id: 'fund', header: 'Fund' },
	{ id: 'fee', header: 'Fee', format: 'decimal' },
	{ id: 'year', header: '1 year', format: 'decimal' },
	{ id: 'five', header: '5 years', format: 'decimal' },
]
// The names that a format can carry as a colour. The style of the page gives each its colours.
const COLORS = ['accent', 'alert']

const controller = createTableController()
const view = useTableView(controller)
const formats = shallowRef<CellFormats | undefined>({
	cells: { f2: { year: { color: 'alert' } }, f4: { year: { color: 'alert' } } },
})

// The format of the active cell, for the pressed buttons.
const active = computed<CellFormat>(() => {
	const at = view.value?.activeCell
	// Read here so that a change of the formats makes this answer again.
	void formats.value
	return at ? controller.getCellFormat(at.rowId, at.columnId) : {}
})
const off = computed(() => !view.value?.cellSelection)

function decimals(step: number) {
	const now = active.value.decimals ?? 2
	controller.formatCells({ decimals: Math.min(4, Math.max(0, now + step)) })
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button
				class="look"
				aria-label="Bold"
				:aria-pressed="active.bold === true"
				:disabled="off"
				@click="controller.toggleCellFormat('bold')"
			>
				<b>B</b>
			</Button>
			<Button
				class="look"
				aria-label="Italic"
				:aria-pressed="active.italic === true"
				:disabled="off"
				@click="controller.toggleCellFormat('italic')"
			>
				<i>I</i>
			</Button>
			<Button
				:aria-pressed="active.fill === 'accent'"
				:disabled="off"
				@click="controller.formatCells({ fill: active.fill === 'accent' ? null : 'accent' })"
			>
				Mark
			</Button>
			<Button aria-label="One decimal more" :disabled="off" @click="decimals(1)">.00 +</Button>
			<Button aria-label="One decimal fewer" :disabled="off" @click="decimals(-1)">.00 −</Button>
			<Button :disabled="off" @click="controller.clearCellFormats()">Clear</Button>
		</div>
		<div class="sink-frame">
			<Table
				v-model:cell-formats="formats"
				:rows="funds"
				:columns="columns"
				:controller="controller"
				:format-colors="COLORS"
				cell-selection
				aria-label="Funds with cells that take a format"
			/>
		</div>
		<p class="demo-note" data-testid="formats-count">
			{{ Object.keys(formats?.cells ?? {}).length }} rows hold a format of their own
		</p>
	</div>
</template>
