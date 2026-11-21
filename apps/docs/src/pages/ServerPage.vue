<script setup lang="ts">
import {
	createTableController,
	Table,
	type ColumnDef,
	type FilterState,
	type PageState,
	type SortRule,
} from 'ui-sdk-table-vue'
import { downloadCsv, downloadXlsx } from 'ui-sdk-table-vue/export'
import { computed, shallowRef, watch } from 'vue'
import type { Person } from '../benchmark/data'
import { requestPeople } from '../server/fake-server'

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team', sortable: true },
	{ id: 'country', header: 'Country', sortable: true },
	{ id: 'score', header: 'Score', sortable: true, format: 'decimal' },
	{ id: 'joined', header: 'Joined', sortable: true, format: 'date' },
]
const TEAMS = ['Billing', 'Design', 'Growth', 'Platform', 'Support']

// The time that the stand-in server takes for an answer. A browser test sets it in the address.
const delay = Number(new URLSearchParams(location.search).get('delay') ?? 150)

const controller = createTableController()
const sort = shallowRef<readonly SortRule[]>([])
const filter = shallowRef<FilterState>({})
const page = shallowRef<PageState | undefined>({ page: 1, pageSize: 25 })
const rows = shallowRef<Person[]>([])
const total = shallowRef<number | undefined>()
const loading = shallowRef(false)
const requests = shallowRef(0)

const pageCount = computed(() =>
	total.value === undefined || !page.value
		? undefined
		: Math.max(1, Math.ceil(total.value / page.value.pageSize)),
)

// The table says what it wants through its state. One change of the state
// is one request; an answer that comes after a newer request is dropped.
watch(
	[sort, filter, page],
	async () => {
		if (!page.value) return
		const request = ++requests.value
		loading.value = true
		const answer = await requestPeople(
			{ sort: sort.value, filter: filter.value, page: page.value },
			delay,
		)
		if (request !== requests.value) return
		rows.value = answer.rows
		total.value = answer.total
		loading.value = false
	},
	{ immediate: true },
)

function search(event: Event) {
	controller.setSearch((event.target as HTMLInputElement).value)
}

function team(event: Event) {
	controller.setColumnFilter('team', (event.target as HTMLSelectElement).value || undefined)
}
</script>

<template>
	<h1>Rows from a server</h1>
	<p>
		A stand-in server holds 10,000 people. It searches, sorts and cuts the pages; the table shows
		one page and says what it wants next. The two export buttons write the rows in view.
	</p>
	<div class="toolbar">
		<label>
			Search
			<input type="search" :value="filter.search ?? ''" @input="search" />
		</label>
		<label>
			Team
			<select @change="team">
				<option value="">All teams</option>
				<option v-for="name in TEAMS" :key="name">{{ name }}</option>
			</select>
		</label>
		<button type="button" @click="downloadCsv(controller.exportData(), 'people')">
			Export CSV
		</button>
		<button type="button" @click="downloadXlsx(controller.exportData(), 'people')">
			Export Excel
		</button>
		<output data-testid="requests">{{ requests }} requests</output>
		<output data-testid="status">{{ loading ? 'Loading' : 'Ready' }}</output>
	</div>
	<div class="scroller">
		<Table
			v-model:sort="sort"
			v-model:filter="filter"
			v-model:page="page"
			:rows="rows"
			:columns="columns"
			:controller="controller"
			:row-count="total"
			:loading="loading"
			manual-sort
			manual-filter
			manual-page
			sticky-header
			aria-label="People"
		>
			<template #empty>No person matches.</template>
		</Table>
	</div>
	<div v-if="page" class="toolbar">
		<button type="button" :disabled="page.page <= 1" @click="controller.previousPage()">
			Previous page
		</button>
		<output data-testid="page">Page {{ page.page }} of {{ pageCount ?? '…' }}</output>
		<button
			type="button"
			:disabled="pageCount !== undefined && page.page >= pageCount"
			@click="controller.nextPage()"
		>
			Next page
		</button>
		<button type="button" @click="controller.lastPage()">Last page</button>
		<output data-testid="total">
			{{ total === undefined ? '' : `${total.toLocaleString('en')} people` }}
		</output>
	</div>
</template>
