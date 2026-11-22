# Pages and server mode

Show the rows a page at a time, and take the rows, the pages, the sort and the filters from a server.

## Pages

A `page` state of `{ page, pageSize }` shows one page of the rows. Without it, the table shows every row. The page counts from 1.

```vue title="pages.vue"
<script setup lang="ts">
import {
	Pagination,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationList,
	PaginationNext,
	PaginationPrevious,
} from '@ui-sdk/vue/pagination'
import {
	createTableController,
	Table,
	useTableView,
	type ColumnDef,
	type PageState,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Invoice = { id: string; number: string; client: string; amount: number }

const CLIENTS = ['Northway', 'Sola', 'Arc', 'Brightline', 'Kestrel']
const invoices: Invoice[] = Array.from({ length: 23 }, (_, index) => ({
	id: `i${index + 1}`,
	number: `INV-${String(1001 + index)}`,
	client: CLIENTS[index % CLIENTS.length] ?? '',
	amount: 400 + ((index * 137) % 900),
}))

const columns: ColumnDef<Invoice>[] = [
	{ id: 'number', header: 'Invoice' },
	{ id: 'client', header: 'Client', sortable: true },
	{ id: 'amount', header: 'Amount', sortable: true, format: 'integer' },
]

const controller = createTableController()
const view = useTableView(controller)
const page = shallowRef<PageState | undefined>({ page: 1, pageSize: 5 })
</script>

<template>
	<Table
		v-model:page="page"
		:rows="invoices"
		:columns="columns"
		:controller="controller"
		aria-label="Invoices"
	/>
	<Pagination
		v-if="view"
		aria-label="Pages of the invoices"
		:page="view.page"
		:page-count="view.pageCount"
		@page-change="(next) => controller.setPage(next)"
	>
		<PaginationList v-slot="{ state }">
			<PaginationItem><PaginationPrevious>Previous</PaginationPrevious></PaginationItem>
			<PaginationItem v-for="item in state.items" :key="item">
				<PaginationLink v-if="typeof item === 'number'" :page="item" />
				<PaginationEllipsis v-else />
			</PaginationItem>
			<PaginationItem><PaginationNext>Next</PaginationNext></PaginationItem>
		</PaginationList>
	</Pagination>
	<p v-if="view" role="status">
		Page {{ view.page }} of {{ view.pageCount }}, {{ view.rowCount }} invoices
	</p>
</template>
```

Press 3 or Next to go to another page. The line under the pages says where you are: page 3 of 5, 23 invoices.

- The controls of the pages read the view: `page`, `pageCount`, `rowCount` and `pageSize`. The `Pagination` component of UI SDK draws them.
- `setPage`, `nextPage`, `previousPage`, `firstPage` and `lastPage` move. `setPageSize(size)` starts again from the first page, and `setPageSize(null)` shows every row.
- A new search starts on the first page.
- What the pages count is `pageUnit` of the view: `rows`, `groups` (each group, with its rows on the page of the group), `parents` (each top-level row, with its child rows on its page) or `mixed`.

## Rows from a server

```vue title="server.vue"
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
```

Press Score to sort, or Next for the next page. The table asks for nothing itself: the app watches the sort and the page, asks its server, and passes the rows that come back.

Three options tell the table that a server did the work:

- `manualSort`: the rows come in sort order. The table does not sort them. The `sort` state still changes, so the app knows what to ask for.
- `manualFilter`: the rows come with the search and the filters applied. The table does not filter them.
- `manualPage`: the rows are one page. The table shows them all, and the pages come from `rowCount`, the number of rows the server has after its filter.

A manual stage keeps the state: the sort, the filter and the page are requests to the owner.

- Without `rowCount`, a full page has a next page and a page that is not full is the last. An empty page after the first then sends the table one page back, so keep the rows of the page before, or set `loading`, while a page loads. `lastPage` needs the count.
- A step to the page that the table is on reports no change, so a listener that loads rows does not load them twice.
- `loading` tells assistive technology that rows are on their way (`aria-busy`), and the table keeps its rows. Without rows, the `#loading` slot shows.
- Every other feature works on the rows that the table has: an export, the totals and "select all" are of the page. Give `totals` for the totals of the server, and `facets` for the choices of every row of a filter control.
- With `manualPage`, a change of the page, the sort or the filter empties the history of a sheet.

## Names

- **Types:** `PageUnit`, `ColumnFacetsSource`, `TableTotalsSource`.

Every option, event, slot, controller method and view field of this page is in the reference: [Table](./reference-table.md), [Controller](./reference-controller.md) and [View](./reference-view.md).

See the [Rows tiles](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=rows) and the [Server tiles](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=server) of the sink.
