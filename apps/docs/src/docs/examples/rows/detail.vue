<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Order = { id: string; customer: string; state: string; note: string }

const orders: Order[] = [
	{ id: 'o1', customer: 'Northway', state: 'Paid', note: '' },
	{ id: 'o2', customer: 'Sola', state: 'Late', note: 'Ten days late. Send a reminder today.' },
	{ id: 'o3', customer: 'Arc', state: 'Open', note: 'Waits for the signed contract.' },
]

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer' },
	{ id: 'state', header: 'State' },
]

// A paid order has nothing more to say. Pass the same function at each render.
const hasDetail = (order: Order) => order.state !== 'Paid'
const open = shallowRef<readonly string[]>([])
</script>

<template>
	<Table
		v-model:expanded="open"
		:rows="orders"
		:columns="columns"
		:has-detail="hasDetail"
		aria-label="Orders with notes"
	>
		<template #col-customer="{ text, expandable, expanded, toggleExpanded }">
			<button
				v-if="expandable"
				type="button"
				:aria-expanded="expanded"
				:aria-label="`Note of ${text}`"
				@click="toggleExpanded"
			>
				{{ expanded ? '▾' : '▸' }}
			</button>
			{{ text }}
		</template>
		<template #detail="{ row }">{{ row.note }}</template>
	</Table>
</template>
