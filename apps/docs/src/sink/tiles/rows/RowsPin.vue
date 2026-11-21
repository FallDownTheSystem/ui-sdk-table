<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef, type RowPinning } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { products, type Product } from '../../data'
import SinkIcon from '../../parts/SinkIcon.vue'

const columns: ColumnDef<Product>[] = [
	{ id: 'name', header: 'Product' },
	{ id: 'stock', header: 'In stock', format: 'integer' },
]
const controller = createTableController()
const pinning = shallowRef<RowPinning>({ top: ['p5'] })
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				v-model:row-pinning="pinning"
				:rows="products"
				:columns="columns"
				:controller="controller"
				sticky-header
				aria-label="Products, with the pinned ones at the top"
			>
				<template #col-name="{ row, text, pinned }">
					<span class="cell-name">
						<Button
							class="twist"
							:aria-pressed="!!pinned"
							:aria-label="`Pin ${text} to the top`"
							@click="controller.pinRow(row.id, pinned ? null : 'top')"
						>
							<SinkIcon name="pin" />
						</Button>
						{{ text }}
					</span>
				</template>
			</Table>
		</div>
	</div>
</template>
