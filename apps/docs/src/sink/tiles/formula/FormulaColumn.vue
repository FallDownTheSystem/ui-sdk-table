<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { formulaColumn } from 'ui-sdk-table-vue/formulas'
import { computed, shallowRef } from 'vue'
import SinkSwitch from '../../parts/SinkSwitch.vue'

type Item = { id: string; product: string; price: number; qty: number }

const items: Item[] = [
	{ id: 'i1', product: 'Pencils', price: 2.4, qty: 30 },
	{ id: 'i3', product: 'Desk chair', price: 189, qty: 2 },
	{ id: 'i4', product: 'Stapler', price: 14, qty: 5 },
	{ id: 'i5', product: 'Standing desk', price: 420, qty: 1 },
]

const base: ColumnDef<Item>[] = [
	{ id: 'product', header: 'Product' },
	{
		id: 'price',
		header: 'Price',
		format: 'currency',
		formatOptions: { showUnit: true, currency: 'USD' },
	},
	{ id: 'qty', header: 'Qty', format: 'integer' },
]
// Each computed column is a column with a value function: no engine, no option of the table.
const total = formulaColumn(
	{
		id: 'total',
		header: 'Total',
		format: 'currency',
		formatOptions: { showUnit: true, currency: 'USD' },
		aggregate: 'sum',
		sortable: true,
		formula: '=[price]*[qty]',
	},
	base,
)
const band = formulaColumn(
	{
		id: 'band',
		header: 'Band',
		groupable: true,
		formula: '=IFS([price]<10, "small", [price]<100, "medium", TRUE, "large")',
	},
	base,
)
const columns = [...base, total, band]

const byBand = shallowRef(false)
const groupBy = computed(() => (byBand.value ? ['band'] : []))
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<SinkSwitch v-model="byBand">Group by band</SinkSwitch>
			<code class="formula-code end">=IFS([price]&lt;10, "small", …)</code>
		</div>
		<div class="sink-frame">
			<Table
				:rows="items"
				:columns="columns"
				:group-by="groupBy"
				:default-expanded="['group/band=small', 'group/band=medium', 'group/band=large']"
				locale="en-US"
				aria-label="Items with a computed total and band"
			/>
		</div>
	</div>
</template>
