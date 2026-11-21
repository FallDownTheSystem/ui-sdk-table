<script setup lang="ts">
import {
	applyEdits,
	Table,
	type CellEdit,
	type ColumnDef,
	type TableEditDetails,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { check, euro, products, type Product } from '../../data'

const columns: ColumnDef<Product>[] = [
	// The name is not for sale: this column cannot be edited.
	{ id: 'name', header: 'Product', editable: false },
	{
		id: 'price',
		header: 'Price',
		format: 'currency',
		formatOptions: euro,
		aggregate: 'mean',
		schema: check((value) =>
			typeof value === 'number' && value >= 0 ? undefined : 'A price is a number, zero or more.',
		),
	},
	{
		id: 'stock',
		header: 'In stock',
		format: 'integer',
		aggregate: 'sum',
		schema: check((value) =>
			Number.isInteger(value) && Number(value) >= 0 ? undefined : 'Stock is a whole number.',
		),
	},
]
// The table reports an edit and never writes a row: the rows are yours.
const rows = shallowRef(products)
const last = shallowRef('Nothing edited yet')

function onCellEdit(edits: readonly CellEdit<Product>[], details: TableEditDetails) {
	rows.value = applyEdits(rows.value, edits)
	const [edit] = edits
	if (edit)
		last.value = `${edit.row.name}: ${edit.column.header} ${edit.previous} to ${edit.value}, by ${details.reason}`
}
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				editable
				sticky-header
				sticky-footer
				aria-label="Products with prices that can be edited"
				@cell-edit="onCellEdit"
			>
				<template #foot-name>Mean price, all stock</template>
			</Table>
		</div>
		<p class="demo-note" role="status" data-testid="last-edit">{{ last }}</p>
	</div>
</template>
