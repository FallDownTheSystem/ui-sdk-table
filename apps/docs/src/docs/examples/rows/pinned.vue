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
	{ id: 'p6', name: 'Rice', stock: 64 },
	{ id: 'p7', name: 'Lentils', stock: 15 },
	{ id: 'p8', name: 'Olive oil', stock: 22 },
	{ id: 'p9', name: 'Sea salt', stock: 90 },
	{ id: 'p10', name: 'Oats', stock: 37 },
]

const columns: ColumnDef<Product>[] = [
	{ id: 'name', header: 'Product', sortable: true },
	{ id: 'stock', header: 'In stock', sortable: true, format: 'integer' },
]

const controller = createTableController()
const pinning = shallowRef<RowPinning>({ top: ['p4'] })
</script>

<template>
	<!-- The frame scrolls. The header and the pinned rows stay at its top. -->
	<div class="frame">
		<Table
			v-model:row-pinning="pinning"
			:rows="products"
			:columns="columns"
			:controller="controller"
			sticky-header
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
	</div>
</template>

<style scoped>
.frame {
	max-block-size: 230px;
	overflow: auto;
	border: 1px solid #e4e4e7;
}

/* What sticks needs a background of its own, so the rows that scroll under it do not show through. */
.frame :deep(tr[data-sticky] > *) {
	background: #fff;
}
</style>
