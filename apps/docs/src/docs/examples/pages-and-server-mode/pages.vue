<script setup lang="ts">
import {
	Pagination,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationList,
	PaginationNext,
	PaginationPrevious,
} from '@ui-sdk/vue/pagination'
import {
	createTableController,
	Table,
	useTableView,
	type ColumnDef,
	type PageState,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Invoice = { id: string; number: string; client: string; amount: number }

const CLIENTS = ['Northway', 'Sola', 'Arc', 'Brightline', 'Kestrel']
const invoices: Invoice[] = Array.from({ length: 23 }, (_, index) => ({
	id: `i${index + 1}`,
	number: `INV-${String(1001 + index)}`,
	client: CLIENTS[index % CLIENTS.length] ?? '',
	amount: 400 + ((index * 137) % 900),
}))

const columns: ColumnDef<Invoice>[] = [
	{ id: 'number', header: 'Invoice' },
	{ id: 'client', header: 'Client', sortable: true },
	{ id: 'amount', header: 'Amount', sortable: true, format: 'integer' },
]

const controller = createTableController()
const view = useTableView(controller)
const page = shallowRef<PageState | undefined>({ page: 1, pageSize: 5 })
</script>

<template>
	<Table
		v-model:page="page"
		:rows="invoices"
		:columns="columns"
		:controller="controller"
		aria-label="Invoices"
	/>
	<Pagination
		v-if="view"
		aria-label="Pages of the invoices"
		:page="view.page"
		:page-count="view.pageCount"
		@page-change="(next) => controller.setPage(next)"
	>
		<PaginationList v-slot="{ state }">
			<PaginationItem><PaginationPrevious>Previous</PaginationPrevious></PaginationItem>
			<PaginationItem v-for="item in state.items" :key="item">
				<PaginationLink v-if="typeof item === 'number'" :page="item" />
				<PaginationEllipsis v-else />
			</PaginationItem>
			<PaginationItem><PaginationNext>Next</PaginationNext></PaginationItem>
		</PaginationList>
	</Pagination>
	<p v-if="view" role="status">
		Page {{ view.page }} of {{ view.pageCount }}, {{ view.rowCount }} invoices
	</p>
</template>
