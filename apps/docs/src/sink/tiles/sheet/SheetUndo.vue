<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	applyEdits,
	createTableController,
	Table,
	useTableView,
	type CellEdit,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { products, type Product } from '../../data'

const columns: ColumnDef<Product>[] = [
	{ id: 'name', header: 'Product', editable: false },
	{ id: 'price', header: 'Price', format: 'decimal' },
	{ id: 'stock', header: 'Stock', format: 'integer' },
]
const controller = createTableController()
const view = useTableView(controller)
const rows = shallowRef(products.slice(0, 4))

// The steps are no state of the view, so they are read again after each change of the table.
const steps = computed(() => {
	if (!view.value) return 'Edit a price or a stock'
	const { entries, position } = controller.getHistory()
	return entries.length ? `Step ${position} of ${entries.length}` : 'Edit a price or a stock'
})

function raise() {
	const [first] = rows.value
	if (first) controller.editCell(first.id, 'price', first.price + 1)
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="raise">Price + 1</Button>
			<Button :disabled="!view?.canUndo" @click="controller.undo()">Undo</Button>
			<Button :disabled="!view?.canRedo" @click="controller.redo()">Redo</Button>
			<Button :disabled="!view?.canUndo && !view?.canRedo" @click="controller.clearHistory()">
				Forget
			</Button>
		</div>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:controller="controller"
				:history="{ limit: 20 }"
				editable
				aria-label="Products with edits that can be taken back"
				@cell-edit="(edits: readonly CellEdit<Product>[]) => (rows = applyEdits(rows, edits))"
			/>
		</div>
		<p class="demo-note" role="status" data-testid="undo-steps">{{ steps }}</p>
	</div>
</template>
