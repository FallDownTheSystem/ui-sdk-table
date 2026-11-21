<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef, type ColumnWidths } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { euro, orders, type Order } from '../../data'

// A few orders, so the table stands whole in its tile.
const rows = orders.slice(0, 4)

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer', width: 200, minWidth: 80, maxWidth: 320 },
	{ id: 'city', header: 'City', width: 150 },
	// A status is one short word, so its column keeps its width.
	{ id: 'status', header: 'Status', width: 100, resizable: false },
	{ id: 'total', header: 'Total', width: 150, format: 'currency', formatOptions: euro },
]
const controller = createTableController()
const widths = shallowRef<ColumnWidths>({})
// A drag reports each step, and its end once: the moment to save the widths.
const saved = shallowRef(0)
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button :disabled="!Object.keys(widths).length" @click="controller.resetColumnWidths()">
				Reset the widths
			</Button>
			<p class="demo-note end" data-testid="column-widths">
				Customer {{ widths.customer ?? 200 }} px, saved {{ saved }} times
			</p>
		</div>
		<div class="sink-frame">
			<Table
				v-model:column-widths="widths"
				:rows="rows"
				:columns="columns"
				:controller="controller"
				:column-min-width="60"
				resizable
				sticky-header
				aria-label="Orders, with columns of any width"
				@column-widths-commit="saved++"
			/>
		</div>
	</div>
</template>
