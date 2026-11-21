<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { onBeforeUnmount, shallowRef } from 'vue'
import { orders, type Order } from '../../data'

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer' },
	{ id: 'city', header: 'City' },
	{ id: 'status', header: 'Status' },
]
// The widths of the bars of a row that waits, in percent of its cell.
const BARS = [72, 48, 36]

const rows = shallowRef<Order[]>([])
const loading = shallowRef(true)
let timer: ReturnType<typeof setTimeout> | undefined

function load() {
	rows.value = []
	loading.value = true
	clearTimeout(timer)
	timer = setTimeout(() => {
		rows.value = orders
		loading.value = false
	}, 1600)
}
load()
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button :disabled="loading" @click="load">Load again</Button>
			<p class="demo-note" role="status">
				{{ loading ? 'Loading the orders' : `${rows.length} orders` }}
			</p>
		</div>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:loading="loading"
				sticky-header
				aria-label="Orders that take a moment to load"
			>
				<template #loading>
					<span class="sr-only">Loading the orders</span>
					<span class="skeleton-rows" aria-hidden="true">
						<span v-for="row in 6" :key="row" class="skeleton-row">
							<span v-for="bar in BARS" :key="bar" :class="`skeleton w${bar}`" />
						</span>
					</span>
				</template>
			</Table>
		</div>
	</div>
</template>
