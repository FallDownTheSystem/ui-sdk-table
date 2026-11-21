<script setup lang="ts">
import { Input } from '@ui-sdk/vue/input'
import { createTableController, Table, type ColumnDef, type FilterState } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { orders, type Order } from '../../data'

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer' },
	{ id: 'city', header: 'City' },
	// The search reads the customer and the city, and not the status.
	{ id: 'status', header: 'Status', searchable: false },
]
const controller = createTableController()
const filter = shallowRef<FilterState>({ search: 'stokholm' })
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Input
				type="search"
				aria-label="Search orders, with typos"
				:value="filter.search ?? ''"
				@value-change="(text) => controller.setSearch(text)"
			/>
		</div>
		<div class="sink-frame">
			<Table
				v-model:filter="filter"
				:rows="orders"
				:columns="columns"
				:controller="controller"
				search-mode="fuzzy"
				:fuzzy-threshold="0.25"
				sticky-header
				aria-label="Orders, found also with a typo"
			>
				<template #empty>No order is near that text.</template>
			</Table>
		</div>
	</div>
</template>
