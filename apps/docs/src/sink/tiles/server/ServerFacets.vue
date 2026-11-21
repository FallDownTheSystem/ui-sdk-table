<script setup lang="ts">
import { Toggle, ToggleGroup } from '@ui-sdk/vue/toggle'
import {
	createTableController,
	Table,
	useTableView,
	type ColumnDef,
	type FilterState,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { createPeople, type Person } from '../../data'

// What a server would hold: it filters the rows, and counts every team.
const everyone = createPeople(12)
const teams = [...new Set(everyone.map((person) => person.team))].sort()
const facets = {
	team: {
		values: teams.map((team) => ({
			value: team,
			count: everyone.filter((person) => person.team === team).length,
		})),
	},
}

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'team', header: 'Team', filter: 'select' },
]
const controller = createTableController()
const view = useTableView(controller)
const filter = shallowRef<FilterState>({ columns: { team: ['Design'] } })

const chosen = computed(() => (filter.value.columns?.team ?? []) as string[])
// The answer of the server: only the rows of the chosen teams reach the table.
const rows = computed(() =>
	chosen.value.length ? everyone.filter((person) => chosen.value.includes(person.team)) : everyone,
)
const choices = computed(() => (view.value ? controller.getFacets('team').values : []))
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<ToggleGroup
				class="facet"
				multiple
				aria-label="Teams, as the server counts them"
				:value="chosen"
				@value-change="(values) => controller.setColumnFilter('team', values)"
			>
				<Toggle
					v-for="choice in choices"
					:key="choice.text"
					class="tile-use"
					:value="String(choice.value)"
				>
					{{ choice.text }} <span class="facet-count">{{ choice.count }}</span>
				</Toggle>
			</ToggleGroup>
		</div>
		<div class="sink-frame">
			<Table
				v-model:filter="filter"
				:rows="rows"
				:columns="columns"
				:controller="controller"
				:facets="facets"
				manual-filter
				sticky-header
				aria-label="People of the teams that the server filtered"
			/>
		</div>
	</div>
</template>
