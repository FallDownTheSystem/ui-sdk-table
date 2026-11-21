<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Ticket = { id: string; subject: string; urgency: string }

const LEVELS = ['Urgent', 'High', 'Medium', 'Low']

const tickets: Ticket[] = [
	{ id: 't1', subject: 'Wrong tax on an invoice', urgency: 'High' },
	{ id: 't2', subject: 'Typo on pricing', urgency: 'Low' },
	{ id: 't3', subject: 'Checkout is down', urgency: 'Urgent' },
	{ id: 't5', subject: 'Slow password mail', urgency: 'High' },
	{ id: 't7', subject: 'Refund sent twice', urgency: 'Urgent' },
]
const columns: ColumnDef<Ticket>[] = [
	{ id: 'subject', header: 'Ticket', sortable: true },
	{
		id: 'urgency',
		header: 'Urgency',
		sortable: true,
		// By the alphabet, High would come before Low and Urgent last.
		compare: (a, b) => LEVELS.indexOf(String(a)) - LEVELS.indexOf(String(b)),
	},
]
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="tickets"
				:columns="columns"
				:default-sort="[{ id: 'urgency' }]"
				aria-label="Support tickets by urgency"
			>
				<template #col-urgency="{ text }">
					<span class="cell-tag" :data-state="text === 'Urgent' ? 'late' : undefined">{{
						text
					}}</span>
				</template>
			</Table>
		</div>
	</div>
</template>
