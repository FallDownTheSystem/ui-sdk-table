<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef, type GroupRow } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { createPeople, type Person } from '../../data'
import SinkCheck from '../../parts/SinkCheck.vue'
import SinkIcon from '../../parts/SinkIcon.vue'

// Ten people, so every team is open and the list fills its tile.
const people = createPeople(10)
const columns: ColumnDef<Person>[] = [
	// A column that leads the table: always first, and never moved, hidden or pinned by a person.
	{ id: 'pick', header: 'Pick', lead: true, hideable: false, searchable: false },
	{ id: 'name', header: 'Name' },
	{ id: 'country', header: 'Country' },
	{ id: 'team', header: 'Team' },
]
const controller = createTableController()
const selected = shallowRef<string[]>([])

const idsOf = (group: GroupRow<Person>) => group.leaves.map((leaf) => leaf.id)

function stateOf(group: GroupRow<Person>) {
	const picked = idsOf(group).filter((id) => selected.value.includes(id)).length
	return picked === 0 ? false : picked === group.leaves.length ? true : 'indeterminate'
}

function pick(group: GroupRow<Person>, on: boolean) {
	if (on) controller.selectRows(idsOf(group))
	else controller.deselectRows(idsOf(group))
}
</script>

<template>
	<div class="demo">
		<p class="readout" role="status">
			<strong class="display">{{ selected.length }} of {{ people.length }}</strong>
			<span class="readout-label">people picked</span>
		</p>
		<div class="sink-frame">
			<Table
				v-model:selected="selected"
				:rows="people"
				:columns="columns"
				:controller="controller"
				:group-by="['team']"
				:default-expanded="[
					'group/team=Design',
					'group/team=Platform',
					'group/team=Growth',
					'group/team=Billing',
					'group/team=Support',
				]"
				:default-column-visibility="{ team: false }"
				selection="multiple"
				sticky-header
				aria-label="People by team, picked by row or by group"
			>
				<template #header-pick><span class="sr-only">Pick</span></template>
				<template #col-pick="{ row, selected: on, toggleSelected }">
					<SinkCheck :checked="on" :label="`Pick ${row.name}`" @change="toggleSelected()" />
				</template>
				<template #group="{ group, text, expanded, toggleExpanded }">
					<SinkCheck
						:checked="stateOf(group)"
						:label="`Pick the team ${text}`"
						@change="(on) => pick(group, on)"
					/>
					<Button
						class="twist"
						:aria-expanded="expanded"
						:aria-label="text"
						@click="toggleExpanded"
					>
						<SinkIcon name="chevron" />
					</Button>
					{{ text }} <span class="cell-sub">{{ group.leaves.length }}</span>
				</template>
			</Table>
		</div>
	</div>
</template>
