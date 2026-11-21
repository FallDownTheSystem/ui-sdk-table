<script setup lang="ts">
import { computed } from 'vue'
import DataTableCheckbox from './DataTableCheckbox.vue'
import { useDataTable } from './types'

const props = defineProps<{
	/** The name of the checkbox. */
	label: string
	/**
	 * The rows that the checkbox stands for, such as the rows of a group.
	 * Without it, the checkbox stands for every row that passes the filters.
	 */
	ids?: readonly string[]
}>()

const { controller, view } = useDataTable()

const rows = computed(() => props.ids ?? view.value?.selectable ?? [])

const checked = computed<boolean | 'indeterminate'>(() => {
	const selected = new Set(view.value?.selected)
	let count = 0
	for (const id of rows.value) if (selected.has(id)) count++
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
		:label="label"
		@change="change"
	/>
</template>
