<script setup lang="ts">
import {
	createTableController,
	Table,
	type ColumnDef,
	type FilterState,
	type RowPinning,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { createPeople, type Person } from '../benchmark/data'

const SIZES = [10000, 50000]
const ROW_HEIGHT = 36
const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true, width: 240 },
	{ id: 'team', header: 'Team', sortable: true, width: 140 },
	{ id: 'country', header: 'Country', sortable: true, width: 140 },
	{
		id: 'score',
		header: 'Score',
		sortable: true,
		width: 120,
		aggregate: 'mean',
		format: 'decimal',
	},
	{ id: 'joined', header: 'Joined', sortable: true, width: 140, format: 'date' },
]

const query = new URLSearchParams(location.search)
// With `frame=page`, the page scrolls the rows, and not a frame around the table.
// With `frame=wide`, the page scrolls the rows too, inside a wrapper that
// scrolls only sideways, as a wide table often has.
const frame = query.get('frame')
const pageFrame = frame === 'page' || frame === 'wide'
// With `bars`, the page has a fixed header and footer of its own over the rows.
const bars = query.has('bars')
// With `entry`, the table is in the entry mode: Tab walks the cells and a press opens an editor.
const entry = query.has('entry')

const controller = createTableController()
const size = shallowRef(SIZES[0] ?? 10000)
const rows = shallowRef<Person[]>(createPeople(size.value))
const filter = shallowRef<FilterState>({})
const expanded = shallowRef<readonly string[]>([])
const pinning = shallowRef<RowPinning>({})
const variable = shallowRef(false)
const windowed = shallowRef(true)
const details = shallowRef(false)
const target = shallowRef(5000)

const rowHeight = computed(() => (variable.value ? undefined : ROW_HEIGHT))
// One function for all renders: a new function would make the table list its rows again.
const everyRow = () => true
const hasDetail = computed(() => (details.value ? everyRow : undefined))

/** How many text lines the name cell of a row has, when rows have their own heights. */
function lines(person: Person): number {
	const index = Number(person.id.slice(1))
	return index % 7 === 0 ? 3 : index % 3 === 0 ? 2 : 1
}

function load(count: number) {
	size.value = count
	rows.value = createPeople(count)
}

function isPinned(id: string, edge: 'top' | 'bottom') {
	return pinning.value[edge]?.includes(id) ?? false
}

function togglePin(id: string, edge: 'top' | 'bottom') {
	controller.pinRow(id, isPinned(id, edge) ? null : edge)
}
</script>

<template>
	<div v-if="bars" class="app-bar" data-testid="app-bar">The header of the page</div>
	<div v-if="bars" class="app-foot" data-testid="app-foot">The footer of the page</div>
	<h1>Row window</h1>
	<p>
		{{ size.toLocaleString('en') }} rows, and only the rows near the scroll frame are in the page.
		The header and the footer stay in view. Tab into the table, then use the arrow keys, Page Down
		and Ctrl+End.
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
		<label><input v-model="windowed" type="checkbox" /> Row window</label>
		<label><input v-model="variable" type="checkbox" /> Rows with their own heights</label>
		<label><input v-model="details" type="checkbox" /> Detail rows</label>
		<label>
			Search
			<input
				type="search"
				:value="filter.search ?? ''"
				@input="filter = { search: ($event.target as HTMLInputElement).value }"
			/>
		</label>
	</div>
	<div class="toolbar">
		<button type="button" @click="controller.scrollToRow(`p${size - 1}`, 'end')">
			Go to the last row
		</button>
		<button type="button" @click="controller.scrollToRow('p0', 'start')">
			Go to the first row
		</button>
		<label>
			Row number
			<input v-model.number="target" type="number" min="0" :max="size - 1" />
		</label>
		<button type="button" @click="controller.scrollToRow(`p${target}`, 'center')">
			Go to that row
		</button>
		<button type="button" :aria-pressed="isPinned('p2', 'top')" @click="togglePin('p2', 'top')">
			Pin row 2 to the top
		</button>
		<button type="button" :aria-pressed="isPinned('p9', 'top')" @click="togglePin('p9', 'top')">
			Pin row 9 to the top
		</button>
		<button
			type="button"
			:aria-pressed="isPinned('p4', 'bottom')"
			@click="togglePin('p4', 'bottom')"
		>
			Pin row 4 to the bottom
		</button>
		<output data-testid="pinning">{{ JSON.stringify(pinning) }}</output>
	</div>
	<div
		:class="{
			scroller: !pageFrame,
			tall: !pageFrame,
			sideways: frame === 'wide',
			'under-bars': bars,
		}"
		data-testid="scroller"
	>
		<Table
			v-model:filter="filter"
			v-model:expanded="expanded"
			v-model:row-pinning="pinning"
			:rows="rows"
			:columns="columns"
			:controller="controller"
			:row-window="windowed"
			:row-height="rowHeight"
			:has-detail="hasDetail"
			sticky-header
			sticky-footer
			:entry="entry"
			aria-label="People"
		>
			<template #col-name="{ row, text, expandable, expanded: open, toggleExpanded }">
				<button
					v-if="expandable"
					type="button"
					:aria-label="open ? `Close the details of ${text}` : `Open the details of ${text}`"
					@click="toggleExpanded($event)"
				>
					{{ open ? '−' : '+' }}
				</button>
				<span :class="variable ? `lines-${lines(row)}` : undefined">{{ row.id }} {{ text }}</span>
			</template>
			<template #detail="{ row }">
				<div class="detail">
					<strong>{{ row.name }}</strong>
					<p>{{ row.team }}, {{ row.country }}. Joined on {{ row.joined }}.</p>
					<button type="button">Send a message</button>
				</div>
			</template>
			<template #empty>No person matches the search.</template>
		</Table>
	</div>
</template>
