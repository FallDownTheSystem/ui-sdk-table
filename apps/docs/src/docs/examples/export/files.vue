<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Order = { id: string; customer: string; city: string; total: number }

const orders: Order[] = [
	{ id: 'o1', customer: 'Northway', city: 'Oslo', total: 1240 },
	{ id: 'o2', customer: 'Sola', city: 'Seville', total: 860.5 },
	{ id: 'o3', customer: 'Arc', city: 'Lyon', total: 2310 },
]

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer', sortable: true },
	{ id: 'city', header: 'City' },
	{ id: 'total', header: 'Total', format: 'decimal', aggregate: 'sum' },
	// The id is for the screen only.
	{ id: 'id', header: 'Id', exportable: false },
]

const controller = createTableController()
const csv = shallowRef('')

async function preview() {
	// The writers are an entry of their own: they load at the first export.
	const { toCsv } = await import('ui-sdk-table-vue/export')
	csv.value = toCsv(controller.exportData({ totals: true }))
}

async function download() {
	const { downloadXlsx } = await import('ui-sdk-table-vue/export')
	await downloadXlsx(controller.exportData(), 'orders')
}
</script>

<template>
	<div>
		<Button @click="preview">Show the CSV</Button>
		<Button @click="download">Download Excel</Button>
	</div>
	<Table
		:rows="orders"
		:columns="columns"
		:controller="controller"
		locale="en-US"
		aria-label="Orders to export"
	/>
	<pre v-if="csv" data-testid="csv">{{ csv }}</pre>
</template>
