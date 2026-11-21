<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Quarter = { id: string; region: string; q1: number; q2: number; q3: number; q4: number }

const sales: Quarter[] = [
	{ id: 'north', region: 'North', q1: 412, q2: 388, q3: 455, q4: 501 },
	{ id: 'south', region: 'South', q1: 298, q2: 341, q3: 322, q4: 365 },
	{ id: 'east', region: 'East', q1: 187, q2: 205, q3: 240, q4: 233 },
	{ id: 'west', region: 'West', q1: 356, q2: 310, q3: 295, q4: 402 },
]
const number = { format: 'integer', aggregate: 'sum', sortable: true } as const
const columns: ColumnDef<Quarter>[] = [
	{ id: 'region', header: 'Region' },
	{
		id: 'first',
		header: 'First half',
		columns: [
			{ id: 'q1', header: 'Q1', ...number },
			{ id: 'q2', header: 'Q2', ...number },
		],
	},
	{
		id: 'second',
		header: 'Second half',
		columns: [
			{ id: 'q3', header: 'Q3', ...number },
			{ id: 'q4', header: 'Q4', ...number },
		],
	},
]
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table :rows="sales" :columns="columns" reorderable aria-label="Sales by region and quarter">
				<template #foot-region>All regions</template>
			</Table>
		</div>
	</div>
</template>
