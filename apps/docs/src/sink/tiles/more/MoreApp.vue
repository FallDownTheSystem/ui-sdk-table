<script setup lang="ts">
import { Input, InputClear, InputGroup } from '@ui-sdk/vue/input'
import { Toggle, ToggleGroup } from '@ui-sdk/vue/toggle'
import {
	createTableController,
	Table,
	useTableSearch,
	useTableView,
	type ColumnDef,
	type ColumnPinning,
	type FilterState,
	type PageState,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { count, euro } from '../../data'
import SinkCheck from '../../parts/SinkCheck.vue'
import SinkIcon from '../../parts/SinkIcon.vue'
import SinkPages from '../../parts/SinkPages.vue'
import SinkSegment from '../../parts/SinkSegment.vue'

type Stage = 'Lead' | 'Demo' | 'Offer' | 'Won' | 'Lost'
type Deal = {
	id: string
	deal: string
	company: string
	owner: string
	stage: Stage
	region: string
	amount: number
	chance: number
	closes: string
}

// A pipeline of sales, made up but steady: the same rows on every load.
const DEALS = [
	'Renewal',
	'Expansion',
	'Pilot',
	'Rollout',
	'Upgrade',
	'Migration',
	'Licences',
	'Support plan',
]
const COMPANIES = [
	'Acme',
	'Northwind',
	'Globex',
	'Initech',
	'Umbrella',
	'Stark Labs',
	'Wayne Co',
	'Hooli',
	'Vandelay',
	'Soylent',
	'Tyrell',
	'Cyberdyne',
]
const OWNERS = ['Ada Brooks', 'Ben Carter', 'Cleo Drake', 'Dan Ellis', 'Eve Fisher', 'Finn Grant']
const STAGES: Stage[] = ['Lead', 'Demo', 'Offer', 'Won', 'Lost']
const CHANCE: Record<Stage, number> = { Lead: 0.1, Demo: 0.3, Offer: 0.6, Won: 1, Lost: 0 }
const REGIONS = ['Americas', 'Europe', 'Asia']

// A small seeded generator, so every load shows the same pipeline.
let seed = 7
const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
const pick = <Item>(list: readonly Item[]) => list[Math.floor(random() * list.length)] as Item

const deals: Deal[] = Array.from({ length: 46 }, (_, index) => {
	const stage = pick(STAGES)
	const company = pick(COMPANIES)
	const open = stage !== 'Won' && stage !== 'Lost'
	return {
		id: `d${index + 1}`,
		deal: `${company} ${pick(DEALS)}`,
		company,
		owner: pick(OWNERS),
		stage,
		region: pick(REGIONS),
		amount: Math.round(800 + random() * 60000) - (index % 4) * 25,
		chance: open ? Math.round((CHANCE[stage] + (random() - 0.5) * 0.2) * 100) / 100 : CHANCE[stage],
		closes: `2027-${String(1 + Math.floor(random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(random() * 28)).padStart(2, '0')}`,
	}
})

const columns: ColumnDef<Deal>[] = [
	{ id: 'pick', header: 'Pick', lead: true, hideable: false, searchable: false, width: 52 },
	{ id: 'deal', header: 'Deal', sortable: true, hideable: false, width: 230 },
	{ id: 'owner', header: 'Owner', sortable: true, width: 170 },
	{
		id: 'stage',
		header: 'Stage',
		sortable: true,
		filter: 'select',
		width: 110,
		// The order of the pipeline, not of the alphabet.
		compare: (a, b) => STAGES.indexOf(a as Stage) - STAGES.indexOf(b as Stage),
	},
	{ id: 'region', header: 'Region', sortable: true, filter: 'select', width: 120 },
	{
		id: 'amount',
		header: 'Amount',
		sortable: true,
		format: 'currency',
		formatOptions: euro,
		aggregate: 'sum',
		width: 140,
	},
	{
		id: 'chance',
		header: 'Chance',
		sortable: true,
		format: 'percentage',
		formatOptions: { showUnit: true },
		aggregate: 'mean',
		width: 150,
	},
	{
		id: 'weighted',
		header: 'Weighted',
		sortable: true,
		value: (deal) => deal.amount * deal.chance,
		format: 'currency',
		formatOptions: euro,
		aggregate: 'sum',
		width: 140,
	},
	{ id: 'closes', header: 'Closes', sortable: true, format: 'date', width: 130 },
]

const LOCALES = [
	{ value: 'en-US', label: 'English' },
	{ value: 'de-DE', label: 'Deutsch' },
	{ value: 'fr-FR', label: 'Français' },
] as const
type Locale = (typeof LOCALES)[number]['value']

const controller = createTableController()
const view = useTableView(controller)
const search = useTableSearch(controller)
const locale = shallowRef<Locale>('en-US')
const filter = shallowRef<FilterState>({})
const selected = shallowRef<string[]>([])
const page = shallowRef<PageState | undefined>({ page: 1, pageSize: 10 })
const START_PINS: ColumnPinning = { start: ['pick', 'deal'] }

const initials = (name: string) =>
	name
		.split(' ')
		.map((part) => part[0])
		.join('')

const stages = computed(() => (view.value ? controller.getFacets('stage').values : []))
const chosenStages = computed(() => {
	const value = filter.value.columns?.stage
	return Array.isArray(value) ? (value as string[]) : []
})

const hideable = computed(
	() => view.value?.columns.filter((column) => column.hideable !== false) ?? [],
)
const shown = computed(() => view.value?.visibleColumns.map((column) => column.id) ?? [])
function show(ids: string[]) {
	for (const column of hideable.value) {
		const visible = ids.includes(column.id)
		if (visible !== shown.value.includes(column.id))
			controller.setColumnVisibility(column.id, visible)
	}
}

// The sum of the rows found, in the money of the chosen language.
const money = (value: number) =>
	new Intl.NumberFormat(locale.value, {
		style: 'currency',
		currency: 'EUR',
		notation: 'compact',
		maximumFractionDigits: 1,
	}).format(value)
const found = computed(() => {
	const total = view.value ? controller.getTotals().amount?.value : undefined
	return typeof total === 'number' ? total : 0
})

const all = computed(() => {
	const open = view.value?.selectable.length ?? 0
	return selected.value.length === 0
		? false
		: selected.value.length === open
			? true
			: 'indeterminate'
})

function typed(text: string, details: { reason: string }) {
	if (details.reason === 'clear-press') search.clear()
	else search.text.value = text
}
</script>

<template>
	<div class="demo app">
		<div class="app-head">
			<p class="readout" role="status">
				<strong class="display">{{ money(found) }}</strong>
				<span class="readout-label"
					>in {{ count(view?.dataRowCount ?? 0, 'deal', 'deals')
					}}<template v-if="selected.length">, {{ selected.length }} picked</template></span
				>
			</p>
			<SinkSegment v-model="locale" class="end" label="Language of the numbers" :items="LOCALES" />
		</div>
		<div class="demo-bar">
			<InputGroup class="app-search">
				<SinkIcon name="search" />
				<Input
					type="search"
					aria-label="Search deals"
					placeholder="Deal, owner or region"
					:value="search.text.value"
					@value-change="typed"
					@keydown.escape="search.clear()"
				/>
				<InputClear aria-label="Clear the search"><SinkIcon name="x" /></InputClear>
			</InputGroup>
			<ToggleGroup
				class="facet"
				multiple
				aria-label="Stages"
				:value="chosenStages"
				@value-change="(values) => controller.setColumnFilter('stage', values)"
			>
				<Toggle
					v-for="stage in stages"
					:key="stage.text"
					class="tile-use"
					:value="String(stage.value)"
				>
					{{ stage.text }} <span class="facet-count">{{ stage.count }}</span>
				</Toggle>
			</ToggleGroup>
		</div>
		<div class="demo-bar">
			<span class="app-label">Columns</span>
			<ToggleGroup
				class="facet"
				multiple
				aria-label="Columns in view"
				:value="shown"
				@value-change="show"
			>
				<Toggle v-for="column in hideable" :key="column.id" class="tile-use" :value="column.id">
					{{ column.header }}
				</Toggle>
			</ToggleGroup>
		</div>
		<div class="sink-frame">
			<Table
				v-model:filter="filter"
				v-model:selected="selected"
				v-model:page="page"
				:rows="deals"
				:columns="columns"
				:controller="controller"
				:locale="locale"
				:default-column-pinning="START_PINS"
				:default-sort="[{ id: 'closes' }]"
				:search-debounce="200"
				selection="multiple"
				sticky-header
				sticky-footer
				aria-label="Sales pipeline"
			>
				<template #header-pick>
					<SinkCheck
						:checked="all"
						label="Pick every deal found"
						@change="(on) => (on ? controller.selectAll() : controller.clearSelection())"
					/>
				</template>
				<template #col-pick="{ row, selected: on, toggleSelected }">
					<SinkCheck :checked="on" :label="`Pick ${row.deal}`" @change="toggleSelected()" />
				</template>
				<template #col-owner="{ row }">
					<span class="app-owner"
						><span class="app-initials" aria-hidden="true">{{ initials(row.owner) }}</span
						>{{ row.owner }}</span
					>
				</template>
				<template #col-stage="{ row }">
					<span
						class="cell-tag"
						:data-state="row.stage === 'Won' ? 'done' : row.stage === 'Lost' ? 'late' : undefined"
						>{{ row.stage }}</span
					>
				</template>
				<template #col-chance="{ row, text }">
					<span class="app-chance"
						><span class="app-bar" :style="{ '--chance': row.chance }" aria-hidden="true"></span
						>{{ text }}</span
					>
				</template>
				<template #empty>No deal matches. Clear the search or a stage.</template>
			</Table>
		</div>
		<div v-if="view && page" class="demo-bar">
			<p class="demo-note" role="status">
				{{ view.rowCount ? (view.page - 1) * page.pageSize + 1 : 0 }} to
				{{ Math.min(view.page * page.pageSize, view.rowCount) }} of {{ view.rowCount }}
			</p>
			<SinkPages
				class="end"
				label="Pages of the deals"
				:page="view.page"
				:page-count="view.pageCount"
				@change="(next) => controller.setPage(next)"
			/>
		</div>
	</div>
</template>
