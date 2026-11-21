<script setup lang="ts">
import { Table, type CellAttrsContext, type ColumnDef } from 'ui-sdk-table-vue'

type Task = {
	id: string
	task: string
	owner: string
	state: 'Todo' | 'Doing' | 'Done'
	points: number
}

const tasks: Task[] = [
	{ id: 't1', task: 'Ship the new pricing', owner: 'Aino', state: 'Doing', points: 8 },
	{ id: 't2', task: 'Fix the login loop', owner: 'Eero', state: 'Done', points: 3 },
	{ id: 't3', task: 'Write the release notes', owner: 'Helmi', state: 'Todo', points: 2 },
	{ id: 't4', task: 'Move the old invoices', owner: 'Onni', state: 'Todo', points: 5 },
]
const columns: ColumnDef<Task>[] = [
	{ id: 'task', header: 'Task', sortable: true },
	{ id: 'owner', header: 'Owner', sortable: true },
	{ id: 'state', header: 'State', sortable: true },
	{ id: 'points', header: 'Points', sortable: true, format: 'integer' },
]
// The state of a task is a value of the row; the page turns it into an attribute that its style reads.
const cellAttrs = (context: CellAttrsContext<Task>) =>
	context.kind === 'cell' && context.column.id === 'state'
		? { 'data-state': String(context.value).toLowerCase() }
		: undefined
</script>

<template>
	<div class="demo look-brutal">
		<div class="sink-frame">
			<Table
				:rows="tasks"
				:columns="columns"
				:cell-attrs="cellAttrs"
				aria-label="Tasks of the sprint, in a loud style"
			/>
		</div>
	</div>
</template>
