<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef } from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { createOrders, euro, type Order } from '../../data'
import SinkSegment from '../../parts/SinkSegment.vue'

const BY = [
	{ value: 'city', label: 'City' },
	{ value: 'status', label: 'Status' },
	{ value: 'none', label: 'No groups' },
] as const

const orders = createOrders(18)
const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer' },
	{ id: 'city', header: 'City' },
	{ id: 'status', header: 'Status' },
	// A total makes no group worth reading, so this column cannot make groups.
	{
		id: 'total',
		header: 'Total',
		groupable: false,
		aggregate: 'sum',
		format: 'currency',
		formatOptions: euro,
	},
]
const controller = createTableController()
const by = shallowRef<(typeof BY)[number]['value']>('status')
const groupBy = computed(() => (by.value === 'none' ? [] : [by.value]))

function regroup(columnIds: readonly string[]) {
	by.value = columnIds[0] === 'city' || columnIds[0] === 'status' ? columnIds[0] : 'none'
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<SinkSegment
				label="Group the orders by"
				:items="BY"
				:model-value="by"
				@update:model-value="(next) => controller.setGroupBy(next === 'none' ? [] : [next])"
			/>
			<Button class="end" :disabled="by === 'none'" @click="controller.expandAll()"
				>Open all</Button
			>
			<Button :disabled="by === 'none'" @click="controller.collapseAll()">Close all</Button>
		</div>
		<div class="sink-frame">
			<Table
				:rows="orders"
				:columns="columns"
				:controller="controller"
				:group-by="groupBy"
				sticky-header
				aria-label="Orders in groups of your choice"
				@update:group-by="regroup"
			>
				<template #foot-customer>All orders</template>
			</Table>
		</div>
	</div>
</template>
