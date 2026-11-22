<script setup lang="ts">
import { createTableController, Table, type ColumnDef, type RowPinning } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Product = { id: string; name: string; stock: number }

const products: Product[] = [
	{ id: 'p1', name: 'Oat milk', stock: 42 },
	{ id: 'p2', name: 'Rye bread', stock: 8 },
	{ id: 'p3', name: 'Green tea', stock: 120 },
	{ id: 'p4', name: 'Dark coffee', stock: 3 },
	{ id: 'p5', name: 'Honey', stock: 27 },
]

const columns: ColumnDef<Product>[] = [
	{ id: 'name', header: 'Product', sortable: true },
	{ id: 'stock', header: 'In stock', sortable: true, format: 'integer' },
]

const controller = createTableController()
const pinning = shallowRef<RowPinning>({ top: ['p4'] })
</script>

<template>
	<Table
		v-model:row-pinning="pinning"
		:rows="products"
		:columns="columns"
		:controller="controller"
		aria-label="Products, the pinned ones on top"
	>
		<template #col-name="{ row, text, pinned }">
			<button
				type="button"
				:aria-pressed="!!pinned"
				:aria-label="`Pin ${text} to the top`"
				@click="controller.pinRow(row.id, pinned ? null : 'top')"
			>
				{{ pinned ? '★' : '☆' }}
			</button>
			{{ text }}
		</template>
	</Table>
</template>
