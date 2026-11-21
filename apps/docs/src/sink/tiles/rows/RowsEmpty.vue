<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef } from 'ui-sdk-table-vue'
import { orders, type Order } from '../../data'

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer' },
	{ id: 'city', header: 'City' },
	{ id: 'status', header: 'Status' },
]
const controller = createTableController()
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="controller.setSearch('Reykjavik')">Search "Reykjavik"</Button>
		</div>
		<div class="sink-frame">
			<Table
				:rows="orders"
				:columns="columns"
				:controller="controller"
				:default-filter="{ search: 'Reykjavik' }"
				sticky-header
				aria-label="Orders from a city that has none"
			>
				<template #empty>
					<div class="empty-state">
						<strong>No order ships to Reykjavik.</strong>
						<Button class="primary" @click="controller.clearFilters()">Show every order</Button>
					</div>
				</template>
			</Table>
		</div>
	</div>
</template>
