<script setup lang="ts">
import {
	createTableController,
	Table,
	type AggregateName,
	type ColumnAggregates,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { createOrders, euro, type Order } from '../../data'
import SinkSegment from '../../parts/SinkSegment.vue'

const KINDS = [
	{ value: 'sum', label: 'Sum' },
	{ value: 'mean', label: 'Average' },
	{ value: 'max', label: 'Largest' },
] as const satisfies readonly { value: AggregateName; label: string }[]

const orders = createOrders(18)
const columns: ColumnDef<Order>[] = [
	{ id: 'city', header: 'City' },
	{ id: 'customer', header: 'Customer' },
	{ id: 'items', header: 'Items', aggregate: 'sum', format: 'integer' },
	{ id: 'total', header: 'Total', aggregate: 'sum', format: 'currency', formatOptions: euro },
]
const controller = createTableController()
// The function of each total is state of the owner, saved with the document as the rows are.
const aggregates = shallowRef<ColumnAggregates | undefined>({})
const kind = computed(() => {
	const now = aggregates.value?.total
	return now === 'mean' || now === 'max' ? now : 'sum'
})
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<SinkSegment
				label="The total of the Total column"
				:items="KINDS"
				:model-value="kind"
				@update:model-value="(name) => controller.setColumnAggregate('total', name)"
			/>
			<p class="demo-note end" role="status" data-testid="totals-kind">
				{{ KINDS.find((item) => item.value === kind)?.label }} of each city
			</p>
		</div>
		<div class="sink-frame">
			<Table
				v-model:column-aggregates="aggregates"
				:rows="orders"
				:columns="columns"
				:controller="controller"
				:group-by="['city']"
				:default-column-visibility="{ city: false }"
				group-totals
				sticky-header
				sticky-footer
				aria-label="Orders by city, with a total that can change its function"
			>
				<template #foot-customer>All cities</template>
			</Table>
		</div>
	</div>
</template>
