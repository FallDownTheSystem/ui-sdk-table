<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	createTableController,
	Table,
	useTableView,
	type ColumnDef,
	type PageState,
	type SortRule,
} from 'ui-sdk-table-vue'
import { shallowRef, watch } from 'vue'

type Person = { id: string; name: string; score: number }

// A server in this file: 40 people, sorted and cut into pages after a short wait.
const PEOPLE: Person[] = Array.from({ length: 40 }, (_, index) => ({
	id: `p${index + 1}`,
	name: `Person ${index + 1}`,
	score: (index * 37) % 100,
}))

function fetchPeople(sort: readonly SortRule[], page: PageState) {
	const [rule] = sort
	const sorted = rule
		? PEOPLE.toSorted((a, b) => {
				const order = rule.id === 'score' ? a.score - b.score : a.name.localeCompare(b.name)
				return rule.desc ? -order : order
			})
		: PEOPLE
	const start = (page.page - 1) * page.pageSize
	return new Promise<{ rows: Person[]; total: number }>((resolve) =>
		setTimeout(
			() => resolve({ rows: sorted.slice(start, start + page.pageSize), total: PEOPLE.length }),
			200,
		),
	)
}

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'score', header: 'Score', sortable: true, format: 'integer' },
]

const controller = createTableController()
const view = useTableView(controller)
const sort = shallowRef<readonly SortRule[]>([])
const page = shallowRef<PageState | undefined>({ page: 1, pageSize: 5 })
const rows = shallowRef<Person[]>([])
const total = shallowRef<number>()
const loading = shallowRef(false)
let request = 0

// The state of the table is the request. An answer that a newer request overtook is dropped.
watch(
	[sort, page],
	async () => {
		if (!page.value) return
		const mine = ++request
		loading.value = true
		const answer = await fetchPeople(sort.value, page.value)
		if (mine !== request) return
		rows.value = answer.rows
		total.value = answer.total
		loading.value = false
	},
	{ immediate: true },
)
</script>

<template>
	<Table
		v-model:sort="sort"
		v-model:page="page"
		:rows="rows"
		:columns="columns"
		:controller="controller"
		:row-count="total"
		:loading="loading"
		manual-sort
		manual-page
		aria-label="People from a server"
	/>
	<div v-if="view">
		<Button :disabled="view.page <= 1" @click="controller.previousPage()">Previous</Button>
		<Button :disabled="view.page >= view.pageCount" @click="controller.nextPage()">Next</Button>
		<span role="status">{{ loading ? 'Loading' : `Page ${view.page} of ${view.pageCount}` }}</span>
	</div>
</template>
