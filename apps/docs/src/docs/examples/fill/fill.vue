<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	applyEdits,
	createTableController,
	Table,
	type CellEdit,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Lesson = { id: string; week: number | null; day: string; room: string }

const columns: ColumnDef<Lesson>[] = [
	{ id: 'week', header: 'Week', format: 'integer' },
	{ id: 'day', header: 'Day' },
	{ id: 'room', header: 'Room' },
]

const rows = shallowRef<Lesson[]>([
	{ id: 'l1', week: 1, day: '2027-01-04', room: 'A1' },
	{ id: 'l2', week: 2, day: '2027-01-11', room: 'B2' },
	{ id: 'l3', week: null, day: '', room: '' },
	{ id: 'l4', week: null, day: '', room: '' },
	{ id: 'l5', week: null, day: '', room: '' },
])

const controller = createTableController()

// The first two rows are the source: numbers and days with one step go on as a series.
function fillDown() {
	controller.selectCells({ rowId: 'l1', columnId: 'week' }, { rowId: 'l5', columnId: 'room' })
	void controller.fillCells('down', 2)
}
</script>

<template>
	<div>
		<Button @click="fillDown">Fill down from two rows</Button>
	</div>
	<Table
		:rows="rows"
		:columns="columns"
		:controller="controller"
		sheet
		aria-label="Lessons of a course"
		@cell-edit="(edits: readonly CellEdit<Lesson>[]) => (rows = applyEdits(rows, edits))"
	/>
</template>
