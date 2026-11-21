<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createAgent } from '@ui-sdk/vue/agent'
import { Table, type ColumnDef, type TableChangeDetails } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { euro, orders, type Order } from '../../data'

// A few orders, so the table stands whole in its tile.
const rows = orders.slice(0, 4)

const NAME = 'Orders for the agent'

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer', sortable: true },
	{ id: 'city', header: 'City', sortable: true },
	{ id: 'total', header: 'Total', sortable: true, format: 'currency', formatOptions: euro },
]
const log = shallowRef<string[]>(['The agent has done nothing yet.'])
const say = (line: string) => (log.value = [line, ...log.value].slice(0, 2))

// The agent of UI SDK sees every component of the page that has a name, and the actions of each.
const agent = createAgent()

async function act(action: string, args: unknown[]) {
	const result = await agent.act({ steps: [{ ref: NAME, action, args }] })
	if (!result.ok) say(`${action} failed: ${result.error?.message ?? 'no reason given'}`)
}

function seen() {
	const table = agent.snapshot().find((component) => component.label === NAME)
	say(`It sees "${NAME}" with ${table?.actions.length ?? 0} actions.`)
}

// A change that the agent made says so: the table reports its source.
function changed(key: string, details: TableChangeDetails) {
	say(`${key} changed, source: ${details.source}`)
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button class="primary" @click="act('sortBy', ['total', 'desc'])">Sort by total</Button>
			<Button @click="act('setSearch', ['oslo'])">Search "oslo"</Button>
			<Button @click="act('sortBy', ['price'])">Sort by a wrong name</Button>
			<Button @click="seen">What it sees</Button>
		</div>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:aria-label="NAME"
				sticky-header
				@sort-change="(_value: unknown, details: TableChangeDetails) => changed('sort', details)"
				@filter-change="
					(_value: unknown, details: TableChangeDetails) => changed('filter', details)
				"
			/>
		</div>
		<ol class="demo-log" aria-label="What the agent did" data-testid="agent-log">
			<li v-for="(line, index) in log" :key="log.length - index" :title="line">{{ line }}</li>
		</ol>
	</div>
</template>
