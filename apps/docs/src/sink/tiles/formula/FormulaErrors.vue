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
import { createFormulaEngine } from 'ui-sdk-table-vue/formulas'
import { computed, shallowRef } from 'vue'

type Row = { id: string; team: string; spent: number; heads: number; each?: unknown }

const rows = shallowRef<Row[]>([
	{ id: 'a', team: 'Design', spent: 1200, heads: 4, each: 300 },
	{ id: 'b', team: 'Sales', spent: 900, heads: 0, each: '#DIV/0!' },
	{ id: 'c', team: 'Support', spent: 640, heads: 2, each: 320 },
])
const columns: ColumnDef<Row>[] = [
	rowNumberColumn<Row>(),
	{ id: 'team', header: 'Team', editable: false },
	{ id: 'spent', header: 'Spent', format: 'integer' },
	{ id: 'heads', header: 'Heads', format: 'integer' },
	{ id: 'each', header: 'Each', format: 'integer' },
]
const START: CellFormulas = {
	cells: Object.fromEntries(['a', 'b', 'c'].map((id) => [id, { each: '=[spent]/[heads]' }])),
}

const engine = createFormulaEngine()
const controller = createTableController()
const view = useTableView(controller)
const said = shallowRef('Sales has no heads, so its share is #DIV/0!.')
// The address of a cell is its place in the document: the letter of its column and the number of its row.
const spent = computed(() => (view.value ? controller.getAddress('a', 'spent') : null))

// B1 would read D1, which reads B1: the table refuses it and names the path.
function circle() {
	try {
		controller.setCellFormula('a', 'spent', '=D1*2')
		said.value = 'Set.'
	} catch (error) {
		said.value = error instanceof Error ? error.message : String(error)
	}
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="circle">Make {{ spent ?? 'B1' }} read D1</Button>
		</div>
		<p class="demo-note formula-issue" role="status" :title="said">{{ said }}</p>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:controller="controller"
				:formulas="engine"
				:default-cell-formulas="START"
				editable
				column-letters
				aria-label="Spending of each team, with an error"
				@cell-edit="(edits: readonly CellEdit<Row>[]) => (rows = applyEdits(rows, edits))"
			/>
		</div>
	</div>
</template>
