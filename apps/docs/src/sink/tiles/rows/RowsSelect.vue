<script setup lang="ts">
import { createTableController, Table, useTableView, type ColumnDef } from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { count, orders, type Order } from '../../data'

// A few orders, so the table stands whole in its tile.
const rows = orders.slice(0, 4)
import SinkCheck from '../../parts/SinkCheck.vue'
import SinkIcon from '../../parts/SinkIcon.vue'

const columns: ColumnDef<Order>[] = [
	{ id: 'pick', header: 'Pick', lead: true, hideable: false, searchable: false },
	{ id: 'customer', header: 'Customer' },
	{ id: 'status', header: 'Status' },
]
const controller = createTableController()
const view = useTableView(controller)
const selected = shallowRef<string[]>(['o2'])

// A paid order is closed: nothing can be done with it, so it cannot be picked.
const canSelect = (order: Order) => order.status !== 'Paid'

// "All" is every row that can be picked, which the table knows.
const all = computed(() => {
	const open = view.value?.selectable.length ?? 0
	return selected.value.length === 0
		? false
		: selected.value.length === open
			? true
			: 'indeterminate'
})
</script>

<template>
	<div class="demo">
		<p class="demo-note" role="status">
			<strong>{{ count(selected.length, 'order', 'orders') }}</strong> picked
		</p>
		<div class="sink-frame">
			<Table
				v-model:selected="selected"
				:rows="rows"
				:columns="columns"
				:controller="controller"
				:can-select="canSelect"
				selection="multiple"
				sticky-header
				aria-label="Orders, of which the open and the late ones can be picked"
			>
				<template #header-pick>
					<SinkCheck
						:checked="all"
						label="Pick every order that is not paid"
						@change="(on) => (on ? controller.selectAll() : controller.clearSelection())"
					/>
				</template>
				<template #col-pick="{ row, selected: on, toggleSelected }">
					<SinkCheck
						v-if="canSelect(row)"
						:checked="on"
						:label="`Pick the order of ${row.customer}`"
						@change="toggleSelected()"
					/>
					<SinkIcon v-else name="lock" />
				</template>
			</Table>
		</div>
	</div>
</template>
