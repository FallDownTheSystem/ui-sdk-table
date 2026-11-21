<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { count, createPeople, type Person } from '../../data'
import SinkIcon from '../../parts/SinkIcon.vue'

const people = createPeople(24)
const columns: ColumnDef<Person>[] = [
	// The column of the groups is in the table and out of view: the group rows say its values.
	{ id: 'team', header: 'Team' },
	{ id: 'name', header: 'Name', aggregate: 'count' },
	{ id: 'score', header: 'Score', format: 'decimal', aggregate: 'mean' },
	{
		id: 'country',
		header: 'Country',
		// A total of your own: the values of the group go in, one value comes out.
		aggregate: (values) => count(new Set(values).size, 'country', 'countries'),
	},
]
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="people"
				:columns="columns"
				:group-by="['team']"
				:default-expanded="['group/team=Billing']"
				:default-column-visibility="{ team: false }"
				:group-totals="false"
				sticky-header
				aria-label="People by team, with the totals in the group row"
			>
				<template #group="{ text, totalTexts, expanded, toggleExpanded }">
					<Button
						class="twist"
						:aria-expanded="expanded"
						:aria-label="text"
						@click="toggleExpanded"
					>
						<SinkIcon name="chevron" />
					</Button>
					{{ text }}
					<span class="cell-sub">
						{{ count(Number(totalTexts.name), 'person', 'people') }} · mean {{ totalTexts.score }} ·
						{{ totalTexts.country }}
					</span>
				</template>
			</Table>
		</div>
	</div>
</template>
