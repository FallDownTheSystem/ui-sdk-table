<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { count, createOrders, euro, type Order } from '../../data'
import SinkIcon from '../../parts/SinkIcon.vue'

const orders = createOrders(22)
const columns: ColumnDef<Order>[] = [
	// The column of the groups is in the table and out of view: the group rows say its values.
	{ id: 'city', header: 'City' },
	{ id: 'customer', header: 'Customer', sortable: true },
	{ id: 'status', header: 'Status' },
	{ id: 'items', header: 'Items', aggregate: 'sum', format: 'integer', sortable: true },
	{
		id: 'total',
		header: 'Total',
		aggregate: 'sum',
		format: 'currency',
		formatOptions: euro,
		sortable: true,
	},
]
</script>

<template>
	<div class="demo">
		<div class="scene">
			<p class="scene-title">Orders by city</p>
			<p class="scene-sub">{{ count(orders.length, 'order', 'orders') }}, a total for each city</p>
		</div>
		<div class="sink-frame">
			<Table
				:rows="orders"
				:columns="columns"
				:group-by="['city']"
				:default-expanded="['group/city=Helsinki', 'group/city=Tallinn']"
				:default-column-visibility="{ city: false }"
				group-totals
				sticky-header
				sticky-footer
				aria-label="Orders by city, with totals"
			>
				<template #group="{ group, text, expanded, toggleExpanded }">
					<Button
						class="twist"
						:aria-expanded="expanded"
						:aria-label="text"
						@click="toggleExpanded"
					>
						<SinkIcon name="chevron" />
					</Button>
					{{ text }}
					<span class="cell-sub">{{ count(group.leaves.length, 'order', 'orders') }}</span>
				</template>
				<template #group-total-items="{ text }">{{ text }}</template>
				<template #foot-customer>All cities</template>
			</Table>
		</div>
	</div>
</template>
