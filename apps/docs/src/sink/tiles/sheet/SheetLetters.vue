<script setup lang="ts">
import {
	createTableController,
	rowNumberColumn,
	Table,
	useTableView,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { computed } from 'vue'
import { orders, type Order } from '../../data'

// A few orders, so the table stands whole in its tile.
const rows = orders.slice(0, 3)

const columns: ColumnDef<Order>[] = [
	rowNumberColumn<Order>({ width: 36 }),
	{ id: 'customer', header: 'Customer' },
	{ id: 'city', header: 'City' },
	// A header group: its two columns keep a letter each.
	{
		id: 'order',
		header: 'Order',
		columns: [
			{ id: 'items', header: 'Items', format: 'integer' },
			{ id: 'total', header: 'Total', format: 'currency', formatOptions: { currency: 'EUR' } },
		],
	},
]
const controller = createTableController()
const view = useTableView(controller)

const said = computed(() => {
	const cells = view.value?.cellSelection
	if (!cells || cells.rows * cells.columns === 1) return 'Press a letter'
	return `${cells.rows} by ${cells.columns} cells`
})
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<p class="demo-note end" role="status" data-testid="letters-said">{{ said }}</p>
		</div>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:controller="controller"
				cell-selection
				column-letters
				sticky-header
				aria-label="Orders with a letter for each column"
			>
				<template #letter="{ letter }">{{ letter }}</template>
			</Table>
		</div>
	</div>
</template>
