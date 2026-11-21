<script setup lang="ts">
import { Table, useTableView, createTableController, type ColumnDef } from 'ui-sdk-table-vue'
import { formulaColumn } from 'ui-sdk-table-vue/formulas'
import { computed, shallowRef } from 'vue'
import { euro } from '../../data'
import SinkSegment from '../../parts/SinkSegment.vue'

type Sale = { id: string; customer: string; placed: string; amount: number }

const CUSTOMERS = ['Acme', 'Bolt', 'Cedar', 'Delta', 'Ember', 'Fern', 'Glow', 'Hive']

// Sales of one autumn, the same on every load.
let seed = 11
const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
const start = Date.UTC(2026, 8, 7)
const sales: Sale[] = Array.from({ length: 36 }, (_, index) => ({
	id: `s${index + 1}`,
	customer: CUSTOMERS[Math.floor(random() * CUSTOMERS.length)] ?? 'Acme',
	placed: new Date(start + Math.floor(random() * 77) * 86_400_000).toISOString().slice(0, 10),
	amount: Math.round(200 + random() * 2400),
}))

const PERIODS = [
	{ value: 'week', label: 'Week', formula: '=WEEKOF([placed], 2)', name: 'weeks' },
	{ value: 'month', label: 'Month', formula: '=MONTHOF([placed])', name: 'months' },
	{ value: 'quarter', label: 'Quarter', formula: '=QUARTEROF([placed])', name: 'quarters' },
] as const
type Period = (typeof PERIODS)[number]['value']

const base: ColumnDef<Sale>[] = [
	{ id: 'customer', header: 'Customer' },
	{ id: 'placed', header: 'Placed', format: 'date', formatOptions: { dateStyle: 'medium' } },
	{
		id: 'amount',
		header: 'Amount',
		format: 'currency',
		formatOptions: euro,
		aggregate: 'sum',
	},
]
const period = shallowRef<Period>('week')
const chosen = computed(() => PERIODS.find((item) => item.value === period.value) ?? PERIODS[0])
// The formula gives the first day of each period; the column gets the format `period` by itself.
const columns = computed(() => [
	formulaColumn(
		{
			id: 'period',
			header: 'Period',
			groupable: true,
			sortable: true,
			formula: chosen.value.formula,
		},
		base,
	),
	...base,
])
const controller = createTableController()
const view = useTableView(controller)
const groups = computed(() => (view.value ? view.value.rowCount : 0))
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<SinkSegment v-model="period" label="Group the sales by" :items="PERIODS" />
		</div>
		<p class="readout" role="status">
			<strong class="display">{{ groups }} {{ chosen.name }}</strong>
			<span class="readout-label">{{ chosen.formula }}</span>
		</p>
		<div class="sink-frame">
			<Table
				:key="period"
				:rows="sales"
				:columns="columns"
				:controller="controller"
				:group-by="['period']"
				:default-sort="[{ id: 'period' }]"
				:default-column-visibility="{ period: false }"
				locale="en-GB"
				sticky-header
				aria-label="Sales of the autumn, by period"
			/>
		</div>
	</div>
</template>
