<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	applyEdits,
	createTableController,
	Table,
	useTableView,
	type CellEdit,
	type ColumnDef,
	type TableEditDetails,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'

type Room = { id: string; room: string; seats: number }

const columns: ColumnDef<Room>[] = [
	{ id: 'room', header: 'Room', editable: false },
	{ id: 'seats', header: 'Seats', format: 'integer' },
]

const rows = shallowRef<Room[]>([
	{ id: 'r1', room: 'Oak', seats: 8 },
	{ id: 'r2', room: 'Pine', seats: 12 },
	{ id: 'r3', room: 'Birch', seats: 4 },
])
const last = shallowRef('Nothing yet.')

const controller = createTableController()
const view = useTableView(controller)
// The steps are no state of the view, so they are read again when the view changes.
const steps = computed(() => {
	if (!view.value) return ''
	const { entries, position } = controller.getHistory()
	return `Step ${position} of ${entries.length}`
})

// An undo comes as an edit with the reason `undo`: `applyEdits` needs no other code for it.
function onCellEdit(edits: readonly CellEdit<Room>[], details: TableEditDetails) {
	rows.value = applyEdits(rows.value, edits)
	last.value = `${details.reason}: ${edits.map((edit) => `${edit.row.room} ${edit.value}`).join(', ')}`
}

function addSeat() {
	for (const row of rows.value) controller.editCell(row.id, 'seats', row.seats + 1)
}
</script>

<template>
	<div>
		<Button @click="addSeat">One seat more in each room</Button>
		<Button :disabled="!view?.canUndo" @click="controller.undo()">Undo</Button>
		<Button :disabled="!view?.canRedo" @click="controller.redo()">Redo</Button>
	</div>
	<Table
		:rows="rows"
		:columns="columns"
		:controller="controller"
		editable
		history
		aria-label="Meeting rooms"
		@cell-edit="onCellEdit"
	/>
	<p role="status">{{ steps }}. Last report: {{ last }}</p>
</template>
