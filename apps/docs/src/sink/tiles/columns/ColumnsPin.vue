<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef, type ColumnPinning } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { euro, orders, type Order } from '../../data'

// A few orders, so the table stands whole in its tile.
const rows = orders.slice(0, 3)

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer', width: 130 },
	{ id: 'city', header: 'City', width: 110 },
	{ id: 'status', header: 'Status', width: 90 },
	{ id: 'items', header: 'Items', width: 80, format: 'integer' },
	{ id: 'placed', header: 'Placed', width: 110 },
	{ id: 'total', header: 'Total', width: 110, format: 'currency', formatOptions: euro },
]
const controller = createTableController()
const START: ColumnPinning = { start: ['customer'] }
const pinning = shallowRef(START)

const isPinned = (id: string, side: 'start' | 'end') => pinning.value[side]?.includes(id) ?? false
const toggle = (id: string, side: 'start' | 'end') =>
	controller.pinColumn(id, isPinned(id, side) ? null : side)
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button :aria-pressed="isPinned('customer', 'start')" @click="toggle('customer', 'start')">
				Pin the customer
			</Button>
			<Button :aria-pressed="isPinned('total', 'end')" @click="toggle('total', 'end')">
				Pin the total
			</Button>
			<Button class="end" :disabled="pinning === START" @click="controller.resetColumnPinning()">
				Reset
			</Button>
		</div>
		<div class="sink-frame">
			<Table
				v-model:column-pinning="pinning"
				:default-column-pinning="START"
				:rows="rows"
				:columns="columns"
				:controller="controller"
				sticky-header
				aria-label="Orders, wider than their frame"
			/>
		</div>
	</div>
</template>
