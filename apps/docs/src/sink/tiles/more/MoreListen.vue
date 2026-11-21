<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef } from 'ui-sdk-table-vue'
import { onBeforeUnmount, shallowRef } from 'vue'
import { orders, type Order } from '../../data'

// A few orders, so the table stands whole in its tile.
const rows = orders.slice(0, 3)
import SinkCheck from '../../parts/SinkCheck.vue'

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer', sortable: true },
	{ id: 'city', header: 'City', sortable: true },
]
const controller = createTableController()
const line = shallowRef('')
const heard = shallowRef('nothing yet')

// Without Vue: the table calls back after each change with the keys that changed,
// and `getView` answers what it shows now. The listener waits for the table.
const stop = controller.subscribe((changed) => {
	const view = controller.getView()
	const sort = view.sort.map((rule) => `${rule.id} ${rule.desc ? 'down' : 'up'}`).join(', ')
	line.value = `${view.dataRowCount} rows, ${sort || 'not sorted'}, ${view.selected.length} picked`
	if (changed.length) heard.value = changed.join(', ')
})
onBeforeUnmount(stop)
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="controller.toggleSort('city')">Sort by city</Button>
			<Button @click="controller.setSearch(controller.getView().search ? '' : 'oslo')"
				>Oslo only</Button
			>
		</div>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:controller="controller"
				selection="single"
				sticky-header
				aria-label="Orders with a status line"
			>
				<template #col-customer="{ text, selected, toggleSelected }">
					<span class="cell-name">
						<SinkCheck :checked="selected" :label="`Pick ${text}`" @change="toggleSelected()" />
						{{ text }}
					</span>
				</template>
			</Table>
		</div>
		<p class="demo-note" role="status" data-testid="listen-line">
			{{ line }}. Changed: {{ heard }}
		</p>
	</div>
</template>
