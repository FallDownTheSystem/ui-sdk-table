<script setup lang="ts">
import {
	applyEdits,
	createTableController,
	Table,
	useSelectionSummary,
	type CellEdit,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Week = { id: string; name: string; mon: number; tue: number; wed: number }

const columns: ColumnDef<Week>[] = [
	{ id: 'name', header: 'Name', editable: false },
	{ id: 'mon', header: 'Mon', format: 'decimal' },
	{ id: 'tue', header: 'Tue', format: 'decimal' },
	{ id: 'wed', header: 'Wed', format: 'decimal' },
]

const rows = shallowRef<Week[]>([
	{ id: 'w1', name: 'Ada', mon: 7.5, tue: 8, wed: 6 },
	{ id: 'w2', name: 'Ben', mon: 8, tue: 7.5, wed: 8 },
	{ id: 'w3', name: 'Cleo', mon: 6, tue: 6, wed: 7.5 },
])

const controller = createTableController()
// Counts once the selection rests, so a long drag counts one time.
const summary = useSelectionSummary(controller)
</script>

<template>
	<Table
		:rows="rows"
		:columns="columns"
		:controller="controller"
		cell-selection
		editable
		aria-label="Hours of the week"
		@cell-edit="(edits: readonly CellEdit<Week>[]) => (rows = applyEdits(rows, edits))"
	/>
	<p data-testid="summary">
		<template v-if="summary && summary.numbers > 1">
			{{ summary.numbers }} cells, sum {{ summary.texts.sum }}, average {{ summary.texts.mean }}
		</template>
		<template v-else>Select two cells or more.</template>
	</p>
</template>
