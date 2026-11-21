<script setup lang="ts">
import { computed } from 'vue'
import DataTableCheckbox from './DataTableCheckbox.vue'
import { useDataTable } from './types'

const props = defineProps<{
	/** The name of the checkbox. Without it, the checkbox is named for all rows of its table. */
	label?: string
	/**
	 * The rows that the checkbox stands for, such as the rows of a group.
	 * Without it, the checkbox stands for every row that passes the filters.
	 */
	ids?: readonly string[]
}>()

const { controller, view, selected, messages, label: table } = useDataTable()

const rows = computed(() => props.ids ?? view.value?.selectable ?? [])

// The checkbox of all rows selects the rows of every page, and child rows that
// are closed. Its name says how many, so nobody takes it for the rows in view.
const name = computed(
	() =>
		props.label ?? messages.value.selectAllRows({ count: rows.value.length, table: table.value }),
)

const checked = computed<boolean | 'indeterminate'>(() => {
	let count = 0
	for (const id of rows.value) if (selected.value.has(id)) count++
	if (count === 0) return false
	return count === rows.value.length ? true : 'indeterminate'
})

function change(next: boolean) {
	// Rows that a filter hides keep their selection, in both directions.
	if (!next) controller.deselectRows(rows.value)
	else if (props.ids) controller.selectRows(props.ids)
	else controller.selectAll()
}
</script>

<template>
	<DataTableCheckbox
		:checked="checked"
		:disabled="rows.length === 0"
		:label="name"
		@change="change"
	/>
</template>
