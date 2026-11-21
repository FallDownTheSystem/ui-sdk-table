<script setup lang="ts">
import { Table, type ColumnDef, type MultiSortMode, type SortRule } from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { createPeople, type Person } from '../../data'
import SinkSegment from '../../parts/SinkSegment.vue'

const MODES = [
	{ value: 'none', label: 'One' },
	{ value: 'modifier', label: 'With Shift' },
	{ value: 'always', label: 'Every press' },
] as const

const people = createPeople(4)
const columns: ColumnDef<Person>[] = [
	{ id: 'team', header: 'Team', sortable: true },
	{ id: 'country', header: 'Country', sortable: true },
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'score', header: 'Score', sortable: true, format: 'decimal' },
]
const mode = shallowRef<MultiSortMode>('always')
const sort = shallowRef<readonly SortRule[]>([{ id: 'team' }])

const said = computed(() =>
	sort.value.length
		? sort.value.map((rule) => `${rule.id} ${rule.desc ? 'down' : 'up'}`).join(', then ')
		: 'not sorted',
)
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<SinkSegment v-model="mode" label="Columns in the sort" :items="MODES" />
			<p class="demo-note end" data-testid="sort-said">{{ said }}</p>
		</div>
		<div class="sink-frame">
			<Table
				v-model:sort="sort"
				:rows="people"
				:columns="columns"
				:multi-sort="mode"
				sticky-header
				aria-label="People, sorted in the chosen mode"
			/>
		</div>
	</div>
</template>
