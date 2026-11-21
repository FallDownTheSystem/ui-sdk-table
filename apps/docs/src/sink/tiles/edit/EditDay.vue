<script setup lang="ts">
import { Input } from '@ui-sdk/vue/input'
import { applyEdits, Table, type CellEdit, type ColumnDef } from 'ui-sdk-table-vue'
import { shallowRef, type VNode } from 'vue'
import { check } from '../../data'

type Task = { id: string; task: string; due: string }

const rows = shallowRef<Task[]>([
	{ id: 't1', task: 'Send the offer', due: '2026-12-01' },
	{ id: 't2', task: 'Book the venue', due: '2026-12-09' },
	{ id: 't3', task: 'Print the badges', due: '2026-12-14' },
	{ id: 't4', task: 'Brief the speakers', due: '2026-12-18' },
])
const columns: ColumnDef<Task>[] = [
	{ id: 'task', header: 'Task', editable: false },
	{
		id: 'due',
		header: 'Due',
		format: 'date',
		formatOptions: { dateStyle: 'medium', timeZone: 'UTC' },
		schema: check((value) =>
			/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? undefined : 'Pick a day.',
		),
	},
]

// The editor of a slot takes the focus itself, when the table shows it.
const focus = (vnode: VNode) => (vnode.el as HTMLElement | null)?.focus()
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				editable
				locale="en"
				aria-label="Tasks with a day that a date field edits"
				@cell-edit="(edits: readonly CellEdit<Task>[]) => (rows = applyEdits(rows, edits))"
			>
				<template #edit-due="{ row, value, error, save, cancel }">
					<Input
						type="date"
						class="own-editor"
						:aria-label="`Due day of ${row.task}`"
						:aria-invalid="error ? 'true' : undefined"
						:default-value="String(value)"
						@vue:mounted="focus"
						@keydown.enter.stop.prevent="save(($event.target as HTMLInputElement).value, $event)"
						@keydown.escape.stop.prevent="cancel()"
						@keydown.stop
						@blur="save(($event.target as HTMLInputElement).value, $event)"
					/>
				</template>
			</Table>
		</div>
		<p class="demo-note">Enter on a day opens the field. Enter saves, Escape leaves it.</p>
	</div>
</template>
