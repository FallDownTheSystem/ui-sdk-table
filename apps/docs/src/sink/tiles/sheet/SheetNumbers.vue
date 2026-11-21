<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, useTableView, type ColumnDef } from 'ui-sdk-table-vue'
import { computed } from 'vue'
import { orders, type Order } from '../../data'

// A few orders, so the table stands whole in its tile.
const rows = orders.slice(0, 4)

const columns: ColumnDef<Order>[] = [
	// The number of a row is its header: it leads the table, and no range holds it.
	{ id: 'n', header: '', lead: true, rowHeader: true },
	{ id: 'customer', header: 'Customer', sortable: true },
	{ id: 'city', header: 'City' },
	{ id: 'items', header: 'Items', format: 'integer' },
]
const controller = createTableController()
const view = useTableView(controller)

const said = computed(() => {
	const cells = view.value?.cellSelection
	if (!cells) return 'Press a number'
	return `${cells.rows} by ${cells.columns} cells`
})
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="controller.selectCellRows('o2', 'o4')">Rows 2 to 4</Button>
			<Button @click="controller.selectCellColumns('city')">City</Button>
			<p class="demo-note end" role="status" data-testid="numbers-said">{{ said }}</p>
		</div>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:controller="controller"
				cell-selection
				sticky-header
				aria-label="Orders with a number for each row"
			>
				<template #row-header="{ number }">{{ number }}</template>
			</Table>
		</div>
	</div>
</template>
