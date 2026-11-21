<script setup lang="ts" generic="Row">
import { linkOf, type CellSlotProps } from 'ui-sdk-table-vue'
import { computed } from 'vue'
import { focusRingClass } from './DataTableClasses'

/** The cell of a column with the format `url` or `email`: a link, or its text when the value is no address. */
const props = defineProps<{ cell: CellSlotProps<Row> }>()

const link = computed(() => {
	const { column, value, row } = props.cell
	if (column.format !== 'url' && column.format !== 'email') return null
	return linkOf(value, column.format, column.formatOptions, { row })
})
</script>

<template>
	<a
		v-if="link"
		:href="link.href"
		:target="link.newTab ? '_blank' : undefined"
		:rel="link.newTab ? 'noopener noreferrer' : undefined"
		:class="['rounded-sm underline underline-offset-4', focusRingClass]"
	>
		{{ link.text }}
	</a>
	<template v-else>{{ cell.text }}</template>
</template>
