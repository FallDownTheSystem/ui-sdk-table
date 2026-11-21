<script setup lang="ts">
import { Table, type ColumnDef, type SortRule } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { euro, orders, type Order } from '../../data'

// A few orders, so the table stands whole in its tile.
const rows = orders.slice(0, 5)

const columns: ColumnDef<Order>[] = [
	{ id: 'city', header: 'City', sortable: true },
	{ id: 'customer', header: 'Customer', sortable: true },
	{ id: 'status', header: 'Status', sortable: true },
	{ id: 'total', header: 'Total', sortable: true, format: 'currency', formatOptions: euro },
]
const sort = shallowRef<readonly SortRule[]>([{ id: 'city' }, { id: 'total', desc: true }])
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				v-model:sort="sort"
				:rows="rows"
				:columns="columns"
				sticky-header
				aria-label="Orders by city, then by total"
			/>
		</div>
	</div>
</template>
