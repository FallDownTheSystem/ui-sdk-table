<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { euro } from '../../data'

type Expense = { id: string; what: string; amount: number }

const WHAT = [
	'Train to Tampere',
	'Hotel, two nights',
	'Lunch with the client',
	'Taxi',
	'Fair ticket',
]
const expenses: Expense[] = Array.from({ length: 20 }, (_, index) => ({
	id: `x${index + 1}`,
	what: WHAT[index % WHAT.length] ?? 'Taxi',
	amount: 18 + ((index * 37) % 240) + (index % 2) * 0.5,
}))
const columns: ColumnDef<Expense>[] = [
	{ id: 'what', header: 'Expense' },
	{ id: 'amount', header: 'Amount', aggregate: 'sum', format: 'currency', formatOptions: euro },
]
</script>

<template>
	<div class="demo">
		<div class="sink-frame scrolls">
			<Table
				:rows="expenses"
				:columns="columns"
				sticky-header
				sticky-footer
				aria-label="Expenses of a trip, with their sum"
			>
				<template #foot-what>Sum of {{ expenses.length }} expenses</template>
			</Table>
		</div>
	</div>
</template>
