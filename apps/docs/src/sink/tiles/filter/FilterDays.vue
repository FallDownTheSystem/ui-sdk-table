<script setup lang="ts">
import { Input } from '@ui-sdk/vue/input'
import {
	createTableController,
	Table,
	useTableView,
	type ColumnDef,
	type FilterState,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { orders, type Order } from '../../data'

// The first eight orders: four of them fall in the days of the start.
const rows = orders.slice(0, 8)

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer' },
	{
		id: 'placed',
		header: 'Placed',
		sortable: true,
		filter: 'dateRange',
		format: 'date',
		formatOptions: { dateStyle: 'medium', timeZone: 'UTC' },
	},
]
const controller = createTableController()
const view = useTableView(controller)
const filter = shallowRef<FilterState>({
	columns: { placed: { from: '2026-03-01', to: '2026-08-31' } },
})

// The first and the last day that the column holds, in the time zone of the column.
const days = computed(() =>
	view.value ? controller.getFacets('placed', { rows: 'all' }).days : undefined,
)
const range = computed(() => (filter.value.columns?.placed ?? {}) as { from?: string; to?: string })

function bound(end: 'from' | 'to', day: string) {
	controller.setColumnFilter('placed', { ...range.value, [end]: day || undefined })
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Input
				type="date"
				aria-label="First day"
				:min="days?.from"
				:max="days?.to"
				:value="range.from ?? ''"
				@value-change="(day) => bound('from', day)"
			/>
			<Input
				type="date"
				aria-label="Last day"
				:min="days?.from"
				:max="days?.to"
				:value="range.to ?? ''"
				@value-change="(day) => bound('to', day)"
			/>
		</div>
		<div class="sink-frame">
			<Table
				v-model:filter="filter"
				:rows="rows"
				:columns="columns"
				:controller="controller"
				:default-sort="[{ id: 'placed' }]"
				locale="en"
				sticky-header
				aria-label="Orders placed between two days"
			>
				<template #empty>No order was placed in these days.</template>
			</Table>
		</div>
	</div>
</template>
