<script setup lang="ts">
import { Table, type ColumnDef, type PageState } from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { createPeople, type Person } from '../../data'
import SinkSwitch from '../../parts/SinkSwitch.vue'

// What a server would hold. The table gets one page of it, and the sums that the server made.
const everyone = createPeople(400)
const answer = {
	count: everyone.length,
	score: everyone.reduce((sum, person) => sum + person.score, 0),
}

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', aggregate: 'count' },
	{ id: 'score', header: 'Score', format: 'decimal', aggregate: 'sum' },
]
const page = shallowRef<PageState | undefined>({ page: 1, pageSize: 6 })
const rows = computed(() => {
	const { page: number, pageSize } = page.value ?? { page: 1, pageSize: 6 }
	return everyone.slice((number - 1) * pageSize, number * pageSize)
})
const fromServer = shallowRef(true)
const totals = computed(() =>
	fromServer.value ? { table: { name: answer.count, score: answer.score } } : undefined,
)
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<SinkSwitch v-model="fromServer">Totals of the server</SinkSwitch>
		</div>
		<div class="sink-frame">
			<Table
				v-model:page="page"
				:rows="rows"
				:columns="columns"
				:row-count="answer.count"
				:totals="totals"
				manual-page
				sticky-footer
				aria-label="A page of people with the totals of every person"
			>
				<template #foot-name="{ text }">{{ text }} people</template>
			</Table>
		</div>
	</div>
</template>
