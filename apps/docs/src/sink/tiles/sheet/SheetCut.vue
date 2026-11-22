<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	applyEdits,
	createTableController,
	Table,
	useTableView,
	type CellEdit,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Shift = { id: string; day: string; early: string | null; late: string | null }

const columns: ColumnDef<Shift>[] = [
	{ id: 'day', header: 'Day', editable: false },
	{ id: 'early', header: 'Early' },
	{ id: 'late', header: 'Late' },
]
const controller = createTableController()
const view = useTableView(controller)
const rows = shallowRef<Shift[]>([
	{ id: 'd1', day: 'Mon', early: 'Ada', late: 'Bo' },
	{ id: 'd2', day: 'Tue', early: 'Cleo', late: 'Dag' },
	{ id: 'd3', day: 'Wed', early: null, late: null },
	{ id: 'd4', day: 'Thu', early: null, late: null },
])
const said = shallowRef('Or press Ctrl+X, then Ctrl+V.')

async function move() {
	try {
		controller.selectCells({ rowId: 'd1', columnId: 'early' }, { rowId: 'd2', columnId: 'late' })
		// A cut answers with the text for the clipboard, and its cells are empty after it.
		const text = await controller.cutCells()
		controller.selectCells({ rowId: 'd3', columnId: 'early' })
		await controller.pasteCells(text)
		said.value = 'Monday and Tuesday moved two days on.'
	} catch (error) {
		said.value = error instanceof Error ? error.message : String(error)
	}
}

async function empty() {
	controller.selectAllCells()
	await controller.clearCells()
	said.value = 'Every cell that can be edited is empty.'
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="move">Move two days</Button>
			<Button @click="empty">Empty</Button>
			<Button :disabled="!view?.canUndo" @click="controller.undo()">Undo</Button>
		</div>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:controller="controller"
				sheet
				aria-label="Shifts of a week that can be cut and pasted"
				@cell-edit="(edits: readonly CellEdit<Shift>[]) => (rows = applyEdits(rows, edits))"
			/>
		</div>
		<p class="demo-note" role="status" :title="said">{{ said }}</p>
	</div>
</template>
