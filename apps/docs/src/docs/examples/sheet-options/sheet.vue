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
import { shallowRef } from 'vue'

type Item = { id: string; name: string; price: number; stock: number }

const columns: ColumnDef<Item>[] = [
	{ id: 'name', header: 'Item' },
	{ id: 'price', header: 'Price', format: 'decimal' },
	{ id: 'stock', header: 'Stock', format: 'integer' },
]

const rows = shallowRef<Item[]>([
	{ id: 'i1', name: 'Notebook', price: 4.5, stock: 120 },
	{ id: 'i2', name: 'Pencil', price: 0.8, stock: 640 },
	{ id: 'i3', name: 'Eraser', price: 1.2, stock: 310 },
	{ id: 'i4', name: 'Ruler', price: 2.3, stock: 95 },
])

const controller = createTableController()
const view = useTableView(controller)
</script>

<template>
	<div>
		<Button :disabled="!view?.canUndo" @click="controller.undo()">Undo</Button>
		<Button :disabled="!view?.canRedo" @click="controller.redo()">Redo</Button>
	</div>
	<!-- `sheet` turns on editing, ranges of cells, undo and redo, and the fill handle. -->
	<Table
		:rows="rows"
		:columns="columns"
		:controller="controller"
		sheet
		aria-label="Stock of the shop"
		@cell-edit="(edits: readonly CellEdit<Item>[]) => (rows = applyEdits(rows, edits))"
	/>
</template>
