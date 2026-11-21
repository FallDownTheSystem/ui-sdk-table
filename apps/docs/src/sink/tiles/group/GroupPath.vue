<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { createPeople, type Person } from '../../data'
import SinkIcon from '../../parts/SinkIcon.vue'

const people = createPeople(30)
const columns: ColumnDef<Person>[] = [
	// The columns of the groups are in the table and out of view: the group rows say their values.
	{ id: 'country', header: 'Country' },
	{ id: 'team', header: 'Team' },
	{ id: 'name', header: 'Name' },
	{ id: 'score', header: 'Score', format: 'decimal' },
]
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="people"
				:columns="columns"
				:group-by="['country', 'team']"
				:default-expanded="['group/country=Denmark']"
				:default-column-visibility="{ country: false, team: false }"
				sticky-header
				aria-label="People by country, then by team"
			>
				<template #group="{ group, path, expanded, toggleExpanded }">
					<Button
						class="twist"
						:aria-expanded="expanded"
						:aria-label="path.map((step) => step.text).join(', ')"
						@click="toggleExpanded"
					>
						<SinkIcon name="chevron" />
					</Button>
					<template v-for="(step, index) in path" :key="step.group.id">
						<span v-if="index" class="cell-sub"> / </span>
						<span :class="{ 'cell-sub': index < path.length - 1 }">{{ step.text }}</span>
					</template>
					<span class="cell-sub"> · {{ group.leaves.length }}</span>
				</template>
			</Table>
		</div>
	</div>
</template>
