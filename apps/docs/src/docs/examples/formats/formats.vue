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

type Fund = { id: string; fund: string; fee: number; year: number }

const funds: Fund[] = [
	{ id: 'f1', fund: 'Nordic Index', fee: 0.002, year: 0.0784 },
	{ id: 'f2', fund: 'Global Bonds', fee: 0.0035, year: -0.0136 },
	{ id: 'f3', fund: 'Small Caps', fee: 0.011, year: 0.1207 },
]

const columns: ColumnDef<Fund>[] = [
	{ id: 'fund', header: 'Fund' },
	{
		id: 'fee',
		header: 'Fee',
		format: 'decimal',
		formatOptions: { minimumFractionDigits: 4, maximumFractionDigits: 4 },
	},
	{
		id: 'year',
		header: 'One year',
		format: 'percentage',
		formatOptions: { minimumFractionDigits: 1, maximumFractionDigits: 1, showUnit: true },
	},
]

const controller = createTableController()
const view = useTableView(controller)
// Formats are plain data that the app saves with its document.
const formats = shallowRef<CellFormats | undefined>({ cells: { f2: { year: { color: 'alert' } } } })

// The format of the active cell gives the pressed state of the buttons.
const active = computed<CellFormat>(() => {
	const at = view.value?.activeCell
	void formats.value
	return at ? controller.getCellFormat(at.rowId, at.columnId) : {}
})
</script>

<template>
	<div>
		<Button :aria-pressed="active.bold === true" @click="controller.toggleCellFormat('bold')">
			Bold
		</Button>
		<Button @click="controller.formatCells({ format: 'percentage', decimals: 1 })">Percent</Button>
		<Button @click="controller.formatCells({ fill: 'accent' })">Mark</Button>
		<Button @click="controller.clearCellFormats()">Clear</Button>
	</div>
	<!-- A colour of a format is a name. The style of the page gives each name its colours. -->
	<Table
		v-model:cell-formats="formats"
		:rows="funds"
		:columns="columns"
		:controller="controller"
		:format-colors="['accent', 'alert']"
		cell-selection
		aria-label="Funds"
	/>
</template>
