<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { count, euro, orders, type Order } from '../../data'

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer', sortable: true },
	// A file says the city with its country, which the screen has no room for.
	{ id: 'city', header: 'City', exportValue: (order) => `${order.city}, Nordics` },
	{ id: 'total', header: 'Total', format: 'currency', formatOptions: euro, aggregate: 'sum' },
	// The id of a row is for the screen only.
	{ id: 'id', header: 'Id', exportable: false },
]
const controller = createTableController()
const said = shallowRef('No file written yet')

async function write(kind: 'csv' | 'xlsx') {
	// The writers are a chunk of their own, so a page that never exports does not carry them.
	const { downloadCsv, downloadXlsx } = await import('ui-sdk-table-vue/export')
	const data = controller.exportData()
	if (kind === 'csv') downloadCsv(data, 'orders')
	else await downloadXlsx(data, 'orders')
	said.value = `orders.${kind}: ${count(data.rows.length, 'row', 'rows')}, ${count(data.columns.length, 'column', 'columns')}`
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="write('csv')">CSV</Button>
			<Button @click="write('xlsx')">Excel</Button>
			<p class="demo-note" role="status" data-testid="export-said">{{ said }}</p>
		</div>
		<div class="sink-frame">
			<Table
				:rows="orders"
				:columns="columns"
				:controller="controller"
				:default-sort="[{ id: 'customer' }]"
				sticky-header
				aria-label="Orders to export"
			/>
		</div>
	</div>
</template>
