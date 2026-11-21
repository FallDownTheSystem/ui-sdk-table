<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	applyEdits,
	createTableController,
	rowNumberColumn,
	Table,
	useTableView,
	type CellEdit,
	type CellFormulas,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { createFormulaEngine, excelFormulas } from 'ui-sdk-table-vue/formulas'
import { computed, shallowRef } from 'vue'

type Month = { id: string; month: string; income: number; costs: number; profit?: unknown }

// A document as another program saved it: the formulas, and results that are out of date.
const rows = shallowRef<Month[]>([
	{ id: 'm1', month: 'January', income: 8200, costs: 5100, profit: 3100 },
	{ id: 'm2', month: 'February', income: 7600, costs: 5400, profit: 1900 },
	{ id: 'm3', month: 'March', income: 9100, costs: 5050, profit: 3900 },
	{ id: 'm4', month: 'April', income: 9800, costs: 6200, profit: 3600 },
	{ id: 'm5', month: 'May', income: 10400, costs: 6600, profit: 3800 },
	{ id: 'm6', month: 'June', income: 9900, costs: 6300, profit: 3600 },
	{ id: 'm7', month: 'July', income: 8800, costs: 5900, profit: 2900 },
	{ id: 'm8', month: 'August', income: 8100, costs: 5600, profit: 2500 },
	{ id: 'm9', month: 'September', income: 9600, costs: 6100, profit: 3500 },
	{ id: 'm10', month: 'October', income: 10200, costs: 6400, profit: 3800 },
	{ id: 'm11', month: 'November', income: 11000, costs: 6900, profit: 4100 },
	{ id: 'm12', month: 'December', income: 12400, costs: 7300, profit: 5100 },
	{ id: 'y', month: 'Year', income: 55000, costs: 34650, profit: 18000 },
])
const SAVED: CellFormulas = {
	cells: {
		...Object.fromEntries(
			['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'].map((id) => [
				id,
				{ profit: '=[income]-[costs]' },
			]),
		),
		y: {
			income: '=SUM([income@m1]:[income@m12])',
			costs: '=SUM([costs@m1]:[costs@m12])',
			profit: '=SUM([profit@m1]:[profit@m12])',
		},
	},
}
const columns: ColumnDef<Month>[] = [
	rowNumberColumn<Month>(),
	{ id: 'month', header: 'Month', editable: false },
	{ id: 'income', header: 'Income', format: 'integer' },
	{ id: 'costs', header: 'Costs', format: 'integer' },
	{ id: 'profit', header: 'Profit', format: 'integer' },
]

const engine = createFormulaEngine()
const controller = createTableController()
const view = useTableView(controller)
const formulas = shallowRef<CellFormulas>(SAVED)
const fixed = shallowRef<number | null>(null)

// Each formula once, with how many cells hold it: what an agent reads in place of every cell.
const summary = computed(() => {
	if (!view.value) return ''
	const { lines } = controller.getFormulaSummary(3)
	return lines.map((line) => `${line.cells}× ${line.formula}`).join(' · ')
})

function check() {
	fixed.value = controller.recalculate()
}
function goToTotal() {
	const cell = controller.cellAt('D13')
	controller.selectCells(cell)
}
async function download() {
	const { downloadXlsx } = await import('ui-sdk-table-vue/export')
	await downloadXlsx(controller.exportData(), 'year', { formula: excelFormulas() })
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button class="primary" @click="check">Check the formulas</Button>
			<Button @click="goToTotal">Go to D13</Button>
			<Button class="end" @click="download">Excel</Button>
		</div>
		<p class="readout" role="status">
			<strong class="display" data-testid="file-fixed">{{
				fixed === null ? 'Saved' : `${fixed} fixed`
			}}</strong>
			<span class="readout-label" :title="summary">{{
				fixed === null ? 'The totals as the file had them' : summary
			}}</span>
		</p>
		<div class="sink-frame">
			<Table
				v-model:cell-formulas="formulas"
				:rows="rows"
				:columns="columns"
				:controller="controller"
				:formulas="engine"
				locale="en-US"
				sheet
				column-letters
				aria-label="A year of income and costs, as it was saved"
				@cell-edit="(edits: readonly CellEdit<Month>[]) => (rows = applyEdits(rows, edits))"
			/>
		</div>
	</div>
</template>
