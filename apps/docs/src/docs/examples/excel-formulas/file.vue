<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	applyEdits,
	createTableController,
	rowNumberColumn,
	Table,
	type CellEdit,
	type CellFormulas,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { createFormulaEngine, excelFormulas } from 'ui-sdk-table-vue/formulas'
import { shallowRef } from 'vue'

type Month = { id: string; month: string; income: number; costs: number; profit?: unknown }

const rows = shallowRef<Month[]>([
	{ id: 'm1', month: 'January', income: 8200, costs: 5100, profit: 3100 },
	{ id: 'm2', month: 'February', income: 7600, costs: 5400, profit: 2200 },
	{ id: 'm3', month: 'March', income: 9100, costs: 5050, profit: 4050 },
])

const columns: ColumnDef<Month>[] = [
	rowNumberColumn<Month>(),
	{ id: 'month', header: 'Month', editable: false },
	{ id: 'income', header: 'Income', format: 'integer' },
	{ id: 'costs', header: 'Costs', format: 'integer' },
	{ id: 'profit', header: 'Profit', format: 'integer' },
]

const formulas = shallowRef<CellFormulas>({
	cells: {
		m1: { profit: '=[income]-[costs]' },
		m2: { profit: '=[income]-[costs]' },
		m3: { profit: '=[income]-[costs]' },
	},
})

const engine = createFormulaEngine()
const controller = createTableController()

async function download() {
	const { downloadXlsx } = await import('ui-sdk-table-vue/export')
	// `excelFormulas()` writes a formula into the file where it means the same in Excel.
	await downloadXlsx(controller.exportData(), 'profit', { formula: excelFormulas() })
}
</script>

<template>
	<div>
		<Button @click="download">Download Excel</Button>
	</div>
	<Table
		v-model:cell-formulas="formulas"
		:formulas="engine"
		:rows="rows"
		:columns="columns"
		:controller="controller"
		locale="en-US"
		sheet
		column-letters
		aria-label="Profit by month"
		@cell-edit="(edits: readonly CellEdit<Month>[]) => (rows = applyEdits(rows, edits))"
	/>
</template>
