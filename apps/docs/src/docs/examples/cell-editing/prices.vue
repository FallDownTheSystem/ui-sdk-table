<script setup lang="ts">
import {
	applyEdits,
	Table,
	type CellEdit,
	type ColumnDef,
	type StandardSchemaV1,
	type TableEditDetails,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Product = { id: string; name: string; price: number; stock: number }

// Any Standard Schema works: Zod, Valibot, ArkType. This one is written by hand.
function check(test: (value: unknown) => string | undefined): StandardSchemaV1 {
	return {
		'~standard': {
			version: 1,
			vendor: 'example',
			validate: (value) => {
				const message = test(value)
				return message === undefined ? { value } : { issues: [{ message }] }
			},
		},
	}
}

const columns: ColumnDef<Product>[] = [
	{ id: 'name', header: 'Product', editable: false },
	{
		id: 'price',
		header: 'Price',
		format: 'decimal',
		numberKeyboard: true,
		schema: check((value) =>
			typeof value === 'number' && value >= 0 ? undefined : 'A price is a number, zero or more.',
		),
	},
	{
		id: 'stock',
		header: 'In stock',
		format: 'integer',
		numberKeyboard: true,
		schema: check((value) =>
			Number.isInteger(value) && Number(value) >= 0 ? undefined : 'Stock is a whole number.',
		),
	},
]

// The rows are yours. The table reports an edit and never writes a row.
const rows = shallowRef<Product[]>([
	{ id: 'p1', name: 'Green tea', price: 6.5, stock: 40 },
	{ id: 'p2', name: 'Dark coffee', price: 9.9, stock: 12 },
	{ id: 'p3', name: 'Oat cookies', price: 3.2, stock: 75 },
])
const last = shallowRef('Nothing edited yet.')

function onCellEdit(edits: readonly CellEdit<Product>[], details: TableEditDetails) {
	rows.value = applyEdits(rows.value, edits)
	const [edit] = edits
	if (edit)
		last.value = `${edit.row.name}: ${edit.column.header} ${edit.previous} to ${edit.value}, by ${details.reason}`
}
</script>

<template>
	<Table :rows="rows" :columns="columns" editable aria-label="Prices" @cell-edit="onCellEdit" />
	<p role="status">{{ last }}</p>
</template>
