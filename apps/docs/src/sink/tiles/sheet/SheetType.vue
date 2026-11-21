<script setup lang="ts">
import {
	applyEdits,
	Table,
	type CellEdit,
	type ColumnDef,
	type TableEditDetails,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Line = {
	id: string
	item: string
	jan: number | null
	feb: number | null
	mar: number | null
}

const columns: ColumnDef<Line>[] = [
	{ id: 'item', header: 'Budget' },
	{ id: 'jan', header: 'Jan', format: 'integer', aggregate: 'sum' },
	{ id: 'feb', header: 'Feb', format: 'integer', aggregate: 'sum' },
	{ id: 'mar', header: 'Mar', format: 'integer', aggregate: 'sum' },
]
const rows = shallowRef<Line[]>([
	{ id: 'l1', item: 'Rent', jan: 1200, feb: 1200, mar: 1200 },
	{ id: 'l2', item: 'Power', jan: 96, feb: 88, mar: 71 },
	{ id: 'l3', item: 'Food', jan: 410, feb: 385, mar: null },
	{ id: 'l4', item: 'Train', jan: 64, feb: 64, mar: null },
])
const last = shallowRef('Press a cell and type')

function onCellEdit(edits: readonly CellEdit<Line>[], details: TableEditDetails) {
	rows.value = applyEdits(rows.value, edits)
	const [edit] = edits
	if (!edit) return
	last.value =
		edits.length > 1
			? `${edits.length} cells, by ${details.reason}`
			: `${edit.row.item}, ${edit.column.header}: ${edit.value ?? 'empty'}, by ${details.reason}`
}
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				sheet
				sticky-header
				sticky-footer
				aria-label="Budget of three months, as a sheet"
				@cell-edit="onCellEdit"
			>
				<template #foot-item>Total</template>
			</Table>
		</div>
		<p class="demo-note" role="status" data-testid="sheet-last">{{ last }}</p>
	</div>
</template>
