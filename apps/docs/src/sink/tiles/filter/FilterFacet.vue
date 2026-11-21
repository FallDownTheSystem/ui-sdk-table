<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
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

const people = createPeople(60)
const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'team', header: 'Team', filter: 'select' },
	{ id: 'country', header: 'Country', filter: 'select' },
]
const LISTS = [
	{ id: 'team', label: 'Team' },
	{ id: 'country', label: 'Country' },
]
const controller = createTableController()
const view = useTableView(controller)
const filter = shallowRef<FilterState>({})

// The facets of a column follow the filter of the other column, and never their own.
const facets = computed(() =>
	view.value
		? LISTS.map((list) => ({ ...list, values: controller.getFacets(list.id).values }))
		: [],
)
const chosen = (id: string) => {
	const value = filter.value.columns?.[id]
	return Array.isArray(value) ? (value as string[]) : []
}
</script>

<template>
	<div class="demo">
		<div v-for="list in facets" :key="list.id" class="demo-bar">
			<ToggleGroup
				class="facet"
				multiple
				:aria-label="list.label"
				:value="chosen(list.id)"
				@value-change="(values) => controller.setColumnFilter(list.id, values)"
			>
				<Toggle
					v-for="facet in list.values"
					:key="facet.text"
					class="tile-use"
					:value="String(facet.value)"
				>
					{{ facet.text }} <span class="facet-count">{{ facet.count }}</span>
				</Toggle>
			</ToggleGroup>
		</div>
		<div class="demo-bar">
			<p class="demo-note" role="status">
				{{ view?.dataRowCount ?? 0 }} of {{ people.length }} people
			</p>
			<Button class="end" @click="controller.clearColumnFilters()">Clear</Button>
		</div>
		<div class="sink-frame">
			<Table
				v-model:filter="filter"
				:rows="people"
				:columns="columns"
				:controller="controller"
				sticky-header
				aria-label="People by team and country"
			>
				<template #empty>No person is in both. Clear one of the lists.</template>
			</Table>
		</div>
	</div>
</template>
