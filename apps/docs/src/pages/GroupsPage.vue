<script setup lang="ts">
import {
	createTableController,
	sliderBounds,
	Table,
	useTableSearch,
	type ColumnDef,
	type ColumnFacets,
	type ColumnPinning,
	type ColumnVisibility,
	type FilterState,
	type MultiSortMode,
	type RowAttrsContext,
	type SortRule,
} from 'ui-sdk-table-vue'
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { createPeople, type Person } from '../benchmark/data'

const columns: ColumnDef<Person>[] = [
	// A column that leads the table: it holds the checkbox of its row, stays
	// first, and sticks with the first column that is pinned to the start.
	{ id: 'pick', header: 'Pick', lead: true, hideable: false, searchable: false, width: 56 },
	{ id: 'name', header: 'Name', sortable: true, width: 200 },
	{ id: 'team', header: 'Team', sortable: true, filter: 'select', width: 140 },
	{ id: 'country', header: 'Country', sortable: true, filter: 'select', width: 140 },
	{
		id: 'score',
		header: 'Score',
		sortable: true,
		aggregate: 'sum',
		format: 'decimal',
		width: 120,
	},
	{ id: 'joined', header: 'Joined', sortable: true, format: 'date', width: 140 },
	{
		id: 'bonus',
		header: 'Bonus',
		value: (row) => Math.round(row.score * 10),
		aggregate: 'mean',
		format: 'integer',
		width: 120,
	},
]
const SORT_MODES: MultiSortMode[] = ['none', 'modifier', 'always']

const query = new URLSearchParams(location.search)
// The pause of the search field. A browser test sets a longer one in the address.
const debounce = Number(query.get('debounce') ?? 200)

const rows = createPeople(60)
const controller = createTableController()
const search = useTableSearch(controller)

const sort = shallowRef<readonly SortRule[]>([])
const filter = shallowRef<FilterState>({})
const selected = shallowRef<string[]>([])
const expanded = shallowRef<readonly string[]>([])
const pinning = shallowRef<ColumnPinning>({})
const visibility = shallowRef<ColumnVisibility>({})
const filterChanges = shallowRef(0)

const grouping = shallowRef<'team' | 'nested' | 'none'>('team')
const groupBy = computed(() =>
	grouping.value === 'team' ? ['team'] : grouping.value === 'nested' ? ['country', 'team'] : [],
)
const groupTotals = shallowRef(true)
const multiSort = shallowRef<MultiSortMode>('modifier')
const alwaysSorted = shallowRef(false)
const rtl = shallowRef(false)
const narrow = shallowRef(false)
const windowed = shallowRef(false)

// What the controls beside the table show. The table says when to read again.
const facets = shallowRef<Record<'team' | 'country' | 'score' | 'joined', ColumnFacets>>()
const found = shallowRef(0)
const stop = controller.subscribe(() => {
	facets.value = {
		team: controller.getFacets('team'),
		country: controller.getFacets('country'),
		score: controller.getFacets('score'),
		joined: controller.getFacets('joined'),
	}
	found.value = controller.getView().dataRowCount
})
onBeforeUnmount(stop)

const scoreEnds = computed(() => {
	const range = facets.value?.score.range
	return range ? sliderBounds(range) : undefined
})

const chosen = (id: string) => {
	const value = filter.value.columns?.[id]
	return Array.isArray(value) ? (value as unknown[]) : []
}

function choose(id: string, value: unknown, on: boolean) {
	const rest = chosen(id).filter((item) => item !== value)
	controller.setColumnFilter(id, on ? [...rest, value] : rest)
}

const part = (id: string, key: string) => {
	const value = filter.value.columns?.[id] as Record<string, unknown> | undefined
	return value?.[key] ?? ''
}

function bound(id: string, key: string, event: Event) {
	const input = event.target as HTMLInputElement
	const value =
		input.type === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value
	const current = (filter.value.columns?.[id] ?? {}) as Record<string, unknown>
	controller.setColumnFilter(id, { ...current, [key]: value })
}

function isPinned(id: string, side: 'start' | 'end') {
	return pinning.value[side]?.includes(id) ?? false
}

function togglePin(id: string, side: 'start' | 'end') {
	controller.pinColumn(id, isPinned(id, side) ? null : side)
}

// A class for the rows with a low score. The function also asks for names
// that belong to the table; the table leaves those out.
const rowAttrs = (context: RowAttrsContext<Person>) =>
	context.kind === 'row' && context.row.score < 20
		? { class: 'low', 'aria-selected': 'true', 'data-kind': 'low', index: 0 }
		: undefined
</script>

<template>
	<h1>Groups, totals and filters</h1>
	<p>
		A group row shows each total under its column, as the footer does. The filter controls are built
		from the facets of the table, which follow the search and the other filters. The search field
		waits for a pause in the typing.
	</p>
	<div class="toolbar">
		<label>
			Search
			<input
				v-model="search.text.value"
				type="search"
				@keydown.escape="search.clear()"
				@keydown.enter="search.flush()"
			/>
		</label>
		<button type="button" @click="search.clear()">Clear the search</button>
		<output data-testid="search-state">{{ search.pending.value ? 'Waiting' : 'Ready' }}</output>
		<output data-testid="filter-changes">{{ filterChanges }} filter changes</output>
		<output data-testid="found" role="status">{{ found }} people</output>
		<button type="button" @click="controller.clearFilters()">Clear all filters</button>
	</div>
	<div v-if="facets" class="toolbar filters">
		<fieldset v-for="id in ['team', 'country'] as const" :key="id" :data-testid="`facet-${id}`">
			<legend>{{ id === 'team' ? 'Team' : 'Country' }}</legend>
			<label v-for="facet in facets[id].values" :key="facet.text">
				<input
					type="checkbox"
					:checked="chosen(id).includes(facet.value)"
					@change="choose(id, facet.value, ($event.target as HTMLInputElement).checked)"
				/>
				{{ facet.text }} ({{ facet.count }})
			</label>
		</fieldset>
		<fieldset data-testid="facet-score">
			<legend>Score</legend>
			<label>
				From
				<input
					type="number"
					:min="scoreEnds?.min"
					:max="scoreEnds?.max"
					:step="scoreEnds?.step"
					:placeholder="scoreEnds ? String(scoreEnds.min) : ''"
					:value="part('score', 'min')"
					@change="bound('score', 'min', $event)"
				/>
			</label>
			<label>
				To
				<input
					type="number"
					:min="scoreEnds?.min"
					:max="scoreEnds?.max"
					:step="scoreEnds?.step"
					:placeholder="scoreEnds ? String(scoreEnds.max) : ''"
					:value="part('score', 'max')"
					@change="bound('score', 'max', $event)"
				/>
			</label>
		</fieldset>
		<fieldset data-testid="facet-joined">
			<legend>Joined</legend>
			<label>
				First day
				<input
					type="date"
					:min="facets.joined.days?.from"
					:max="facets.joined.days?.to"
					:value="part('joined', 'from')"
					@change="bound('joined', 'from', $event)"
				/>
			</label>
			<label>
				Last day
				<input
					type="date"
					:min="facets.joined.days?.from"
					:max="facets.joined.days?.to"
					:value="part('joined', 'to')"
					@change="bound('joined', 'to', $event)"
				/>
			</label>
		</fieldset>
	</div>
	<div class="toolbar">
		<label>
			Groups
			<select v-model="grouping">
				<option value="team">By team</option>
				<option value="nested">By country, then team</option>
				<option value="none">No groups</option>
			</select>
		</label>
		<label><input v-model="groupTotals" type="checkbox" /> Totals under their columns</label>
		<button type="button" @click="controller.expandAll()">Open all groups</button>
		<button type="button" @click="controller.collapseAll()">Close all groups</button>
		<label>
			Sort with several columns
			<select v-model="multiSort">
				<option v-for="mode in SORT_MODES" :key="mode">{{ mode }}</option>
			</select>
		</label>
		<label><input v-model="alwaysSorted" type="checkbox" /> Always sorted</label>
		<output data-testid="sort">
			{{ sort.map((rule) => `${rule.id} ${rule.desc ? 'desc' : 'asc'}`).join(', ') || 'no sort' }}
		</output>
	</div>
	<div class="toolbar">
		<button
			type="button"
			:aria-pressed="isPinned('name', 'start')"
			@click="togglePin('name', 'start')"
		>
			Pin name to the start
		</button>
		<button
			type="button"
			:aria-pressed="isPinned('bonus', 'end')"
			@click="togglePin('bonus', 'end')"
		>
			Pin bonus to the end
		</button>
		<button type="button" @click="controller.moveColumn('score', 0)">Move score first</button>
		<button type="button" @click="controller.hideAllColumns()">Hide all columns</button>
		<button type="button" @click="controller.setColumnVisibility('team', false)">Hide team</button>
		<button type="button" @click="controller.resetColumnVisibility()">Reset the columns</button>
		<label><input v-model="rtl" type="checkbox" /> Right to left</label>
		<label><input v-model="narrow" type="checkbox" /> Narrow frame</label>
		<label><input v-model="windowed" type="checkbox" /> Row window</label>
		<output data-testid="selected">{{ selected.length }} selected</output>
	</div>
	<div class="scroller" :class="{ narrow }" :dir="rtl ? 'rtl' : 'ltr'" data-testid="scroller">
		<Table
			v-model:sort="sort"
			v-model:filter="filter"
			v-model:selected="selected"
			v-model:expanded="expanded"
			v-model:column-pinning="pinning"
			v-model:column-visibility="visibility"
			:rows="rows"
			:columns="columns"
			:controller="controller"
			:group-by="groupBy"
			:group-totals="groupTotals"
			:multi-sort="multiSort"
			:always-sorted="alwaysSorted"
			:search-debounce="debounce"
			:row-window="windowed"
			:row-attrs="rowAttrs"
			selection="multiple"
			sticky-header
			sticky-footer
			aria-label="People in groups"
			@filter-change="filterChanges++"
		>
			<template #col-pick="{ row, selected: isSelected, toggleSelected }">
				<input
					type="checkbox"
					:aria-label="`Select ${row.name}`"
					:checked="isSelected"
					@change="toggleSelected($event)"
				/>
			</template>
			<template #group="{ group, path, covered, totalTexts, expanded: open, toggleExpanded }">
				<button type="button" :aria-expanded="open" @click="toggleExpanded($event)">
					{{ path.map((entry) => entry.text).join(' / ') }} ({{ group.leaves.length }})
				</button>
				<!-- A total of a column under the label has no cell of its own. -->
				<template v-for="column in covered" :key="column.id">
					<span v-if="column.aggregate" class="covered-total">
						{{ column.header }} {{ totalTexts[column.id] }}
					</span>
				</template>
			</template>
			<template #group-total-bonus="{ text }">
				<span class="mean">avg {{ text }}</span>
			</template>
			<template #foot-bonus="{ text }">
				<span class="mean">avg {{ text }}</span>
			</template>
			<template #empty>No person passes the filters.</template>
		</Table>
	</div>
</template>
