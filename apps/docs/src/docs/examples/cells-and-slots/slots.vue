<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Task = {
	id: string
	title: string
	owner: string
	state: 'todo' | 'doing' | 'done'
	hours: number
}

const tasks: Task[] = [
	{ id: 't1', title: 'Write the release notes', owner: 'Ada', state: 'doing', hours: 3 },
	{ id: 't2', title: 'Fix the login page', owner: 'Tomas', state: 'done', hours: 5 },
	{ id: 't3', title: 'Plan the next sprint', owner: 'Maya', state: 'todo', hours: 2 },
]

const STATES = { todo: 'To do', doing: 'Doing', done: 'Done' }

const columns: ColumnDef<Task>[] = [
	{ id: 'title', header: 'Task' },
	{ id: 'owner', header: 'Owner' },
	{ id: 'state', header: 'State' },
	{ id: 'hours', header: 'Hours', format: 'integer', aggregate: 'sum' },
]
</script>

<template>
	<Table
		:rows="tasks"
		:columns="columns"
		:cell-attrs="
			(cell) =>
				cell.kind === 'cell' && cell.column.id === 'state' ? { class: 'state' } : undefined
		"
		aria-label="Tasks of the week"
	>
		<!-- A slot for one column wins over the slot for every cell. -->
		<template #col-state="{ row }">
			<mark :data-state="row.state">{{ STATES[row.state] }}</mark>
		</template>
		<template #header-hours="{ label }">{{ label }} (sum below)</template>
		<template #foot-title>All tasks</template>
		<template #empty>No task this week.</template>
	</Table>
</template>

<style scoped>
mark {
	padding: 2px 8px;
	border-radius: 999px;
	background: #e4e4e7;
	color: #18181b;
	font-size: 13px;
}

mark[data-state='done'] {
	background: #dcfce7;
	color: #14532d;
}

mark[data-state='doing'] {
	background: #e0e7ff;
	color: #1e3a8a;
}
</style>

<style scoped>
/* `cellAttrs` gives the cells of the state column a class. The table renders them, so the rule reaches them through :deep(). */
:deep(.state) {
	text-align: center;
}
</style>
