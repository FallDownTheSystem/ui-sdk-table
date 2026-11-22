<script setup lang="ts">
import { Checkbox, CheckboxIndicator } from '@ui-sdk/vue/checkbox'
import { createTableController, Table, useTableView, type ColumnDef } from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'

type Mail = { id: string; from: string; subject: string; locked: boolean }

const mails: Mail[] = [
	{ id: 'm1', from: 'Ada', subject: 'The plan for May', locked: false },
	{ id: 'm2', from: 'Tomas', subject: 'Invoice 1042', locked: true },
	{ id: 'm3', from: 'Maya', subject: 'Photos of the trip', locked: false },
	{ id: 'm4', from: 'Leo', subject: 'Lunch on Friday?', locked: false },
]

const columns: ColumnDef<Mail>[] = [
	// A lead column stays first, and holds the checkbox of its row.
	{ id: 'pick', header: 'Pick', lead: true, hideable: false, searchable: false },
	{ id: 'from', header: 'From' },
	{ id: 'subject', header: 'Subject' },
]

// A locked mail cannot be picked.
const canSelect = (mail: Mail) => !mail.locked
const controller = createTableController()
const view = useTableView(controller)
const selected = shallowRef<string[]>([])

const all = computed(() => {
	const open = view.value?.selectable.length ?? 0
	if (selected.value.length === 0) return false
	return selected.value.length === open ? true : 'indeterminate'
})
</script>

<template>
	<p role="status">{{ selected.length }} picked</p>
	<Table
		v-model:selected="selected"
		:rows="mails"
		:columns="columns"
		:controller="controller"
		:can-select="canSelect"
		selection="multiple"
		aria-label="Inbox"
	>
		<template #header-pick>
			<Checkbox
				:checked="all"
				aria-label="Pick every mail"
				@checked-change="
					(on) => (on === true ? controller.selectAll() : controller.clearSelection())
				"
			>
				<CheckboxIndicator>✓</CheckboxIndicator>
			</Checkbox>
		</template>
		<template #col-pick="{ row, selected: on, toggleSelected }">
			<Checkbox
				v-if="canSelect(row)"
				:checked="on"
				:aria-label="`Pick the mail from ${row.from}`"
				@checked-change="toggleSelected()"
			>
				<CheckboxIndicator>✓</CheckboxIndicator>
			</Checkbox>
		</template>
	</Table>
</template>
