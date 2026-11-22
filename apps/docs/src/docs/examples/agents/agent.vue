<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createAgent } from '@ui-sdk/vue/agent'
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Ship = { id: string; name: string; port: string; tons: number }

const ships: Ship[] = [
	{ id: 's1', name: 'Northern Star', port: 'Bergen', tons: 3200 },
	{ id: 's2', name: 'Blue Heron', port: 'Rotterdam', tons: 5100 },
	{ id: 's3', name: 'Sea Lark', port: 'Bergen', tons: 1800 },
]

const columns: ColumnDef<Ship>[] = [
	{ id: 'name', header: 'Ship', sortable: true },
	{ id: 'port', header: 'Port', sortable: true },
	{ id: 'tons', header: 'Tons', sortable: true, format: 'integer' },
]

// The agent of UI SDK sees every component of the page that has a name, and its actions.
const agent = createAgent()
const answer = shallowRef('')

async function act(action: string, args: unknown[]) {
	const result = await agent.act({ steps: [{ ref: 'Ships in port', action, args }] })
	answer.value = result.ok ? `${action} done.` : `Refused: ${result.error?.message ?? ''}`
}
</script>

<template>
	<div>
		<Button @click="act('sortBy', ['tons', 'desc'])">Heaviest first</Button>
		<Button @click="act('sortBy', ['weight', 'desc'])">Sort by weight</Button>
	</div>
	<p role="status">{{ answer }}</p>
	<Table :rows="ships" :columns="columns" aria-label="Ships in port" />
</template>
