<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	applyEdits,
	createTableController,
	Table,
	type CellEdit,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { check, products, type Product } from '../../data'

const columns: ColumnDef<Product>[] = [
	{ id: 'name', header: 'Product', editable: false },
	{
		id: 'price',
		header: 'Price',
		format: 'decimal',
		schema: check((value) => (Number(value) >= 0 ? undefined : 'A price is zero or more.')),
	},
	{ id: 'stock', header: 'Stock', format: 'integer' },
]
const controller = createTableController()
const rows = shallowRef(products.slice(0, 3))
const said = shallowRef('Or press Ctrl+V on a cell.')

// Three rows of two cells, as a spreadsheet writes them: tabs between cells, line ends between rows.
const BLOCK = '13.00\t40\n11.50\t20\n12.00\t9'

async function paste(text: string) {
	controller.selectCells({ rowId: 'p1', columnId: 'price' })
	try {
		await controller.pasteCells(text)
		said.value = 'Pasted from the first price on.'
	} catch (error) {
		// One refused value refuses the whole block, and no cell changes.
		said.value = error instanceof Error ? error.message : String(error)
	}
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="paste(BLOCK)">Paste 6 cells</Button>
			<Button @click="paste('9.90\t5\n-1\t3')">Paste a bad block</Button>
		</div>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:controller="controller"
				editable
				cell-selection
				aria-label="Products that take a pasted block"
				@cell-edit="(edits: readonly CellEdit<Product>[]) => (rows = applyEdits(rows, edits))"
			/>
		</div>
		<p class="demo-note" role="status" :title="said">{{ said }}</p>
	</div>
</template>
