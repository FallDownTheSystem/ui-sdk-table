<script setup lang="ts">
import {
	createTableController,
	Table,
	useTableView,
	type ColumnDef,
	type FilterState,
	type PageState,
	type SortRule,
} from 'ui-sdk-table-vue'
import { shallowRef, watch } from 'vue'
import { requestPeople } from '../../../server/fake-server'
import type { Person } from '../../data'
import SinkPages from '../../parts/SinkPages.vue'

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team', sortable: true },
	{ id: 'country', header: 'Country', sortable: true },
	{ id: 'score', header: 'Score', sortable: true, format: 'decimal' },
]
const controller = createTableController()
const view = useTableView(controller)
const sort = shallowRef<readonly SortRule[]>([])
const filter = shallowRef<FilterState>({})
const page = shallowRef<PageState | undefined>({ page: 1, pageSize: 4 })
const rows = shallowRef<Person[]>([])
const total = shallowRef<number>()
const loading = shallowRef(false)
const requests = shallowRef(0)

// The state of the table is the request. An answer that a newer request overtook is dropped.
watch(
	[sort, filter, page],
	async () => {
		if (!page.value) return
		const request = ++requests.value
		loading.value = true
		const answer = await requestPeople(
			{ sort: sort.value, filter: filter.value, page: page.value },
			350,
		)
		if (request !== requests.value) return
		rows.value = answer.rows
		total.value = answer.total
		loading.value = false
	},
	{ immediate: true },
)
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
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
				aria-label="People from a server, a page at a time"
			/>
		</div>
		<div class="demo-bar">
			<p class="demo-note" role="status" data-testid="server-status">
				{{ loading ? 'Loading' : `${total?.toLocaleString('en') ?? 0} people` }}, request
				{{ requests }}
			</p>
			<SinkPages
				v-if="view"
				class="end"
				label="Pages of the people"
				:page="view.page"
				:page-count="view.pageCount"
				@change="(next) => controller.setPage(next)"
			/>
		</div>
	</div>
</template>
