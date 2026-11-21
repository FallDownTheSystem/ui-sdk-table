<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	applyEdits,
	createTableController,
	rowNumberColumn,
	Table,
	type CellEdit,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Week = { id: string; week: number | null; due: string | null; owner: string | null }

const columns: ColumnDef<Week>[] = [
	rowNumberColumn<Week>({ width: 36 }),
	{ id: 'week', header: 'Week', format: 'integer' },
	{ id: 'due', header: 'Due', format: 'date' },
	{ id: 'owner', header: 'Owner' },
]
const START: Week[] = [
	{ id: 'w1', week: 14, due: '2028-02-22', owner: 'Aino' },
	{ id: 'w2', week: 16, due: '2028-02-29', owner: null },
	...Array.from({ length: 12 }, (_, index) => ({
		id: `w${index + 3}`,
		week: null,
		due: null,
		owner: null,
	})),
]
const controller = createTableController()
const rows = shallowRef(START)

// Two lines are the pattern: 14, 16 goes on to 18, and the days go on by a week, over the leap day.
async function fill() {
	controller.selectCells({ rowId: 'w1', columnId: 'week' }, { rowId: 'w14', columnId: 'due' })
	await controller.fillCells('down', 2)
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="fill">Fill weeks and days</Button>
			<Button @click="rows = START">Start again</Button>
		</div>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:controller="controller"
				editable
				cell-selection
				fill-handle
				sticky-header
				aria-label="Weeks of a plan, filled from the first two"
				@cell-edit="(edits: readonly CellEdit<Week>[]) => (rows = applyEdits(rows, edits))"
			/>
		</div>
		<p class="demo-note">Or drag the square at the corner of the selected cells.</p>
	</div>
</template>
