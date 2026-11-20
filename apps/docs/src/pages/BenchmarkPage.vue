<script setup lang="ts">
import {
	createTableController,
	Table,
	type ColumnDef,
	type FilterState,
	type PageState,
} from 'ui-sdk-table-vue'
import { computed, nextTick, shallowRef } from 'vue'
import { createPeople, type Person } from '../benchmark/data'

const SIZES = [1000, 10000, 50000]
const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team', sortable: true },
	{ id: 'country', header: 'Country', sortable: true },
	{ id: 'score', header: 'Score', sortable: true, aggregate: 'mean', format: 'decimal' },
	{ id: 'joined', header: 'Joined', sortable: true, format: 'date' },
]

const controller = createTableController()
const size = shallowRef(SIZES[0] ?? 1000)
const rows = shallowRef<Person[]>(createPeople(size.value))
const filter = shallowRef<FilterState>({})
const page = shallowRef<PageState | undefined>({ page: 1, pageSize: 25 })
const selected = shallowRef<string[]>([])
const grouped = shallowRef(false)
const groupBy = computed(() => (grouped.value ? ['team'] : []))
const updateMs = shallowRef<number | null>(null)

/** Runs a change and measures the time until the browser has painted it. */
async function measure(run: () => void) {
	const start = performance.now()
	run()
	await nextTick()
	// Two frames: the first one runs layout and paint for the new rows.
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	updateMs.value = Math.round(performance.now() - start)
}

function load(count: number) {
	const next = createPeople(count)
	void measure(() => {
		size.value = count
		rows.value = next
	})
}

function search(event: Event) {
	const text = (event.target as HTMLInputElement).value
	void measure(() => (filter.value = { ...filter.value, search: text }))
}
</script>

<template>
	<h1>Table</h1>
	<p>
		The headless table with {{ size.toLocaleString('en') }} rows. Sort, search and group work on all
		rows; one page of rows is in the page. Tab into the table, then use the arrow keys.
	</p>
	<div class="toolbar">
		<button
			v-for="count in SIZES"
			:key="count"
			type="button"
			:aria-pressed="size === count"
			@click="load(count)"
		>
			{{ count.toLocaleString('en') }} rows
		</button>
		<label>
			Search
			<input type="search" :value="filter.search ?? ''" @input="search" />
		</label>
		<label>
			<input v-model="grouped" type="checkbox" />
			Group by team
		</label>
		<button type="button" @click="measure(() => controller.sortBy('score', 'desc'))">
			Highest score first
		</button>
		<output data-testid="selected-count">{{ selected.length }} selected</output>
		<output data-testid="update-time">
			{{ updateMs === null ? 'Not measured yet' : `Updated in ${updateMs} ms` }}
		</output>
	</div>
	<div class="scroller">
		<Table
			v-model:filter="filter"
			v-model:page="page"
			v-model:selected="selected"
			:rows="rows"
			:columns="columns"
			:group-by="groupBy"
			:controller="controller"
			selection="multiple"
			sticky-header
			aria-label="People"
		>
			<template #col-name="{ text, selected: isSelected, toggleSelected }">
				<label>
					<input type="checkbox" :checked="isSelected" @change="toggleSelected($event)" />
					{{ text }}
				</label>
			</template>
			<template #empty>No person matches the search.</template>
		</Table>
	</div>
	<div v-if="page" class="toolbar">
		<button type="button" :disabled="page.page <= 1" @click="controller.previousPage()">
			Previous page
		</button>
		<output data-testid="page">Page {{ page.page }}</output>
		<button type="button" @click="controller.nextPage()">Next page</button>
	</div>
</template>
