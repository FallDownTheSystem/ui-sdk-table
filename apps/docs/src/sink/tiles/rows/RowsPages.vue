<script setup lang="ts">
import {
	createTableController,
	Table,
	useTableView,
	type ColumnDef,
	type PageState,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { createOrders, euro, type Order } from '../../data'
import SinkPages from '../../parts/SinkPages.vue'
import SinkSegment from '../../parts/SinkSegment.vue'

const SIZES = [
	{ value: '5', label: '5 rows' },
	{ value: '10', label: '10 rows' },
] as const

const orders = createOrders(42)
const columns: ColumnDef<Order>[] = [
	{ id: 'id', header: 'Order' },
	{ id: 'customer', header: 'Customer', sortable: true },
	{ id: 'total', header: 'Total', sortable: true, format: 'currency', formatOptions: euro },
]
const controller = createTableController()
const view = useTableView(controller)
const page = shallowRef<PageState | undefined>({ page: 1, pageSize: 5 })
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				v-model:page="page"
				:rows="orders"
				:columns="columns"
				:controller="controller"
				aria-label="Orders, a page at a time"
			/>
		</div>
		<div v-if="view && page" class="demo-bar">
			<SinkSegment
				label="Rows on a page"
				:items="SIZES"
				:model-value="String(page.pageSize) as '5' | '10'"
				@update:model-value="(size) => controller.setPageSize(Number(size))"
			/>
			<p class="demo-note end" role="status">
				{{ (view.page - 1) * page.pageSize + 1 }} to
				{{ Math.min(view.page * page.pageSize, view.rowCount) }} of {{ view.rowCount }}
			</p>
			<SinkPages
				label="Pages of the orders"
				:page="view.page"
				:page-count="view.pageCount"
				@change="(next) => controller.setPage(next)"
			/>
		</div>
	</div>
</template>
