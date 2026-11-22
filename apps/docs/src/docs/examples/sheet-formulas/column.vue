<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { formulaColumn } from 'ui-sdk-table-vue/formulas'

type Order = { id: string; product: string; price: number; qty: number }

const orders: Order[] = [
	{ id: 'o1', product: 'Desk lamp', price: 39, qty: 4 },
	{ id: 'o2', product: 'Chair', price: 249, qty: 1 },
	{ id: 'o3', product: 'Cable', price: 6, qty: 10 },
]

const base: ColumnDef<Order>[] = [
	{ id: 'product', header: 'Product' },
	{ id: 'price', header: 'Price', format: 'decimal', sortable: true },
	{ id: 'qty', header: 'Quantity', format: 'integer' },
]

// A computed column: each row gets the value of the formula of its own row.
const columns: ColumnDef<Order>[] = [
	...base,
	formulaColumn(
		{
			id: 'total',
			header: 'Total',
			format: 'decimal',
			aggregate: 'sum',
			sortable: true,
			formula: '=[price]*[qty]',
		},
		base,
	),
	formulaColumn(
		{
			id: 'band',
			header: 'Band',
			formula: '=IFS([price]<10, "small", [price]<100, "medium", TRUE, "large")',
		},
		base,
	),
]
</script>

<template>
	<Table :rows="orders" :columns="columns" locale="en-US" aria-label="Orders" />
</template>
