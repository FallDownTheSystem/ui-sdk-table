<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Sale = { id: string; region: string; rep: string; deals: number; amount: number }

const sales: Sale[] = [
	{ id: 's1', region: 'North', rep: 'Ada Lindqvist', deals: 4, amount: 12400 },
	{ id: 's2', region: 'North', rep: 'Leo Brandt', deals: 2, amount: 5300 },
	{ id: 's3', region: 'South', rep: 'Tomas Reyes', deals: 6, amount: 18750 },
	{ id: 's4', region: 'South', rep: 'Maya Okafor', deals: 3, amount: 9100 },
	{ id: 's5', region: 'South', rep: 'Nina Sato', deals: 1, amount: 2200 },
]

const columns: ColumnDef<Sale>[] = [
	{ id: 'region', header: 'Region' },
	{ id: 'rep', header: 'Rep', sortable: true },
	{ id: 'deals', header: 'Deals', format: 'integer', aggregate: 'sum' },
	{
		id: 'amount',
		header: 'Amount',
		format: 'currency',
		formatOptions: { currency: 'EUR', showUnit: true },
		aggregate: 'sum',
	},
]
</script>

<template>
	<Table
		:rows="sales"
		:columns="columns"
		:group-by="['region']"
		:default-expanded="['group/region=North']"
		:default-column-visibility="{ region: false }"
		locale="en-US"
		aria-label="Sales by region"
	>
		<template #group="{ text, expanded, toggleExpanded, group }">
			<button type="button" :aria-expanded="expanded" @click="toggleExpanded">
				{{ expanded ? '▾' : '▸' }} {{ text }}
			</button>
			({{ group.leaves.length }} reps)
		</template>
		<template #foot-rep>All regions</template>
	</Table>
</template>
