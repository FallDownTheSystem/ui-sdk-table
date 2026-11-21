<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createAgent } from '@ui-sdk/vue/agent'
import { Table, type ColumnDef, type TableChangeDetails } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { euro, orders, type Order } from '../../data'

const rows = orders.slice(0, 4)

const NAME = 'Orders for the agent'

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer', sortable: true },
	{ id: 'city', header: 'City', sortable: true },
	{ id: 'total', header: 'Total', sortable: true, format: 'currency', formatOptions: euro },
]

type Step = { action: string; args: unknown[] }
type Ask = { label: string; steps: Step[]; done: string }

// What a person asks the agent, and the calls the agent makes on the table for it.
const ASKS: Ask[] = [
	{
		label: 'Biggest orders first',
		steps: [{ action: 'sortBy', args: ['total', 'desc'] }],
		done: 'Sorted by total, the largest first.',
	},
	{
		label: 'Only Oslo',
		steps: [{ action: 'setSearch', args: ['oslo'] }],
		done: 'Searched for “oslo”.',
	},
	{
		// No column has this name: the table refuses, and its message names the right ones.
		label: 'Sort by price',
		steps: [{ action: 'sortBy', args: ['price', 'desc'] }],
		done: 'Sorted by price.',
	},
	{
		label: 'Start over',
		steps: [
			{ action: 'clearFilters', args: [] },
			{ action: 'sortBy', args: ['customer', 'asc'] },
		],
		done: 'Cleared the search and sorted by customer.',
	},
]

const call = shallowRef('Ask the agent something.')
const answer = shallowRef('It finds the table by its name and calls its actions.')
const failed = shallowRef(false)
const source = shallowRef('')

// The agent of UI SDK sees every component of the page that has a name, and the actions of each.
const agent = createAgent()

async function ask(item: Ask) {
	call.value = item.steps
		.map((step) => `${step.action}(${step.args.map((arg) => JSON.stringify(arg)).join(', ')})`)
		.join('; ')
	source.value = ''
	const result = await agent.act({ steps: item.steps.map((step) => ({ ref: NAME, ...step })) })
	failed.value = !result.ok
	answer.value = result.ok
		? item.done
		: `The table said no: ${result.error?.message ?? 'no reason given'}`
}

// A change that the agent made says so: the table reports its source.
function changed(details: TableChangeDetails) {
	source.value = details.source ?? ''
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar" role="group" aria-label="Ask the agent">
			<Button v-for="item in ASKS" :key="item.label" @click="ask(item)">{{ item.label }}</Button>
		</div>
		<div
			class="agent-reply"
			aria-live="polite"
			data-testid="agent-log"
			:data-failed="failed || undefined"
		>
			<p class="agent-call">{{ call }}</p>
			<p class="agent-answer">
				{{ answer
				}}<span v-if="source" class="agent-source">
					The table reports the change with source “{{ source }}”.</span
				>
			</p>
		</div>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:aria-label="NAME"
				@sort-change="(_value: unknown, details: TableChangeDetails) => changed(details)"
				@filter-change="(_value: unknown, details: TableChangeDetails) => changed(details)"
			/>
		</div>
	</div>
</template>
