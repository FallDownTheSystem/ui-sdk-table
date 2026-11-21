<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { euro, orders, type Order } from '../../data'

// A few orders, so the table stands whole in its tile.
const rows = orders.slice(0, 4)

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer', width: 150 },
	{ id: 'city', header: 'City', width: 110 },
	{ id: 'status', header: 'Status', width: 90 },
	{ id: 'total', header: 'Total', width: 110, format: 'currency', formatOptions: euro },
	// The number of the order keeps its place at the end.
	{ id: 'id', header: 'Order', width: 70, reorderable: false },
]
const controller = createTableController()
const order = shallowRef<readonly string[]>([])
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="controller.moveColumn('total', 0)">Total first</Button>
			<Button :disabled="!order.length" @click="controller.resetColumnOrder()">Reset</Button>
			<p class="demo-note end" data-testid="column-order">
				{{ order.length ? order.join(', ') : 'The order of the definitions' }}
			</p>
		</div>
		<div class="sink-frame">
			<Table
				v-model:column-order="order"
				:rows="rows"
				:columns="columns"
				:controller="controller"
				reorderable
				sticky-header
				aria-label="Orders, with columns that move"
			/>
		</div>
	</div>
</template>
