<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { Toggle, ToggleGroup } from '@ui-sdk/vue/toggle'
import {
	createTableController,
	Table,
	useTableView,
	type ColumnDef,
	type ColumnVisibility,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { euro, orders, type Order } from '../../data'

// A few orders, so the table stands whole in its tile.
const rows = orders.slice(0, 3)

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer', hideable: false },
	{ id: 'city', header: 'City' },
	{ id: 'status', header: 'Status' },
	{ id: 'total', header: 'Total', format: 'currency', formatOptions: euro },
]
const controller = createTableController()
const view = useTableView(controller)
const visibility = shallowRef<ColumnVisibility>({ status: false })

const inView = computed(() => view.value?.visibleColumns.map((column) => column.id) ?? [])

function show(ids: string[]) {
	for (const column of view.value?.columns ?? []) {
		const visible = ids.includes(column.id)
		if (visible !== inView.value.includes(column.id)) {
			controller.setColumnVisibility(column.id, visible)
		}
	}
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<ToggleGroup
				class="facet"
				multiple
				aria-label="Columns in view"
				:value="inView"
				@value-change="show"
			>
				<Toggle
					v-for="column in view?.columns"
					:key="column.id"
					class="tile-use"
					:value="column.id"
					:disabled="column.hideable === false"
				>
					{{ column.header }}
				</Toggle>
			</ToggleGroup>
		</div>
		<div class="demo-bar">
			<Button @click="controller.hideAllColumns()">Hide all</Button>
			<Button @click="controller.showAllColumns()">Show all</Button>
			<Button @click="controller.resetColumnVisibility()">Reset</Button>
		</div>
		<div class="sink-frame">
			<Table
				v-model:column-visibility="visibility"
				:rows="rows"
				:columns="columns"
				:controller="controller"
				:default-column-visibility="{ status: false }"
				sticky-header
				aria-label="Orders, with columns that hide"
			/>
		</div>
	</div>
</template>
