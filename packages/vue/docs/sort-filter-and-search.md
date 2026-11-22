# Sort, filter and search

Sort by one or more columns, filter each column, and search every column with a pause in the typing.

The rows pass a sort, then the filters. Sort is first on purpose: a filter keeps the order of its input, so a key in the search field never sorts. The `sort` and `filter` states hold what a person chose.

## Sort

A column with `sortable: true` gets a button in its header. A press sorts up, the next press down, and the third press takes the sort away.

```vue title="sort.vue"
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Runner = { id: string; name: string; club: string; time: number }

const runners: Runner[] = [
	{ id: 'r1', name: 'Jack Ellis', club: 'Harriers', time: 34.12 },
	{ id: 'r2', name: 'Ivy Adams', club: 'Striders', time: 33.48 },
	{ id: 'r3', name: 'Cleo Vance', club: 'Harriers', time: 35.02 },
	{ id: 'r4', name: 'Ben Nolan', club: 'Striders', time: 32.57 },
	{ id: 'r5', name: 'Rosa Diaz', club: 'Pacers', time: 33.9 },
]

const columns: ColumnDef<Runner>[] = [
	{ id: 'name', header: 'Runner', sortable: true },
	{ id: 'club', header: 'Club', sortable: true },
	{
		id: 'time',
		header: '10 km',
		sortable: true,
		format: 'decimal',
		formatOptions: { suffix: ' min' },
	},
]
</script>

<template>
	<Table :rows="runners" :columns="columns" aria-label="Results of the 10 km run" />
</template>

<style scoped>
/* `data-sort-index` holds the place of a column in the sort, from 1. */
:deep(th[data-sort-index] button)::before {
	content: attr(data-sort-index) ' ';
}

:deep(th[data-sort-index]) {
	color: #1e3a8a;
}
</style>
```

Press Club, then hold Shift and press 10 km. The clubs stay together, and inside each club the fastest runner comes first. The number before each header is its place in the sort.

- `sort` is a list of `{ id, desc? }`. The first rule sorts first.
- `multiSort` decides how a press adds a column. `'modifier'` (the default): a press replaces the sort, and a press with Shift, Control or Command adds the column. `'none'`: one column at a time, whatever key is held. `'always'`: each press adds the column. Enter on a header follows the same rule.
- `alwaysSorted`: a press on the only column of the sort turns the order and never clears it. It does not sort a table that starts without a sort; give `defaultSort` for that.
- `compare(a, b, rowA, rowB)` on a column gives it its own order, such as Urgent before Low.
- `sortChildren: false` keeps the child rows of a tree in their order.
- `toggleSort(event)` of the `#header` slot passes the event, and the table reads the keys. `controller.toggleSort(id, { append: true })` and `sortBy(id, direction, { append: true })` throw in the mode `none`.
- A `sort` of the owner with more columns than the mode allows is left as it is.

## Search with a pause

```vue title="search.vue"
<script setup lang="ts">
import { Input } from '@ui-sdk/vue/input'
import {
	createTableController,
	Table,
	useTableSearch,
	useTableView,
	type ColumnDef,
} from 'ui-sdk-table-vue'

type Member = { id: string; name: string; team: string; city: string }

const members: Member[] = [
	{ id: 'm1', name: 'Ada Lindqvist', team: 'Design', city: 'Stockholm' },
	{ id: 'm2', name: 'Tomas Reyes', team: 'Platform', city: 'Madrid' },
	{ id: 'm3', name: 'Maya Okafor', team: 'Design', city: 'Lagos' },
	{ id: 'm4', name: 'Leo Brandt', team: 'Support', city: 'Hamburg' },
	{ id: 'm5', name: 'Nina Sato', team: 'Platform', city: 'Osaka' },
	{ id: 'm6', name: 'Omar Haddad', team: 'Support', city: 'Amman' },
]

const columns: ColumnDef<Member>[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'team', header: 'Team' },
	{ id: 'city', header: 'City' },
]

const controller = createTableController()
const search = useTableSearch(controller)
const view = useTableView(controller)
</script>

<template>
	<Input
		type="search"
		aria-label="Search the members"
		placeholder="Name, team or city"
		:value="search.text.value"
		@value-change="(text) => (search.text.value = text)"
		@keydown.escape="search.clear()"
		@keydown.enter="search.flush()"
	/>
	<p role="status">
		{{ search.pending.value ? 'Waiting for a pause' : `${view?.dataRowCount ?? 0} members found` }}
	</p>
	<Table
		:rows="members"
		:columns="columns"
		:controller="controller"
		:search-debounce="300"
		aria-label="Members of the team"
	>
		<template #empty>No member matches the search.</template>
	</Table>
</template>
```

Type desi. The field shows each letter at once, and the table filters when the typing pauses. Escape clears the field, and Enter filters without the wait.

`useTableSearch(controller)` gives a search field what it needs:

- `text`: the text of the field. A new text shows at once. The table filters when the typing pauses for `searchDebounce` milliseconds, 200 without the prop. With 0, each letter filters.
- `pending`: whether a text waits for its pause.
- `clear()`: empties the search at once, for a clear button and for Escape.
- `flush()`: filters now, for Enter.

The filter changes once, after the pause, with the reason `input-change`. `clear`, `setSearch`, `clearFilters` and a new search text from the owner of `v-model:filter` act at once and drop a text that waits.

- The search reads the text of each cell, as the screen shows it. `searchable: false` leaves a column out.
- `searchMode: 'fuzzy'` also finds near matches, with letters in order but apart. `fuzzyThreshold` (0 to 1) is the score that a match needs.
- The table says nothing to a screen reader about a search. Announce the rows found when `filter` changes, which is one time after the pause.

Without Vue, the same is `controller.inputSearch(text, event)`, `controller.flushSearch()`, and `search` and `searchPending` of `getView()`. `createDebounce(run, { debounce })` is the timer under it, with `call`, `cancel`, `flush` and `pending`.

## Filter a column

`filter.columns` holds one value for each column that filters. `controller.setColumnFilter(columnId, value)` sets it. The shape of the value decides how it matches, unless the column says otherwise with `filter`:

| Value | Kind | Matches |
| --- | --- | --- |
| A text | `text` | Cells whose text holds it |
| A list | `select` | Cells whose value is in the list |
| `{ min, max }` | `range` | Numbers between the ends. One end can be left out |
| `{ from, to }` | `dateRange` | Dates between the days. A day as `YYYY-MM-DD` means the whole day |

A function `filter(value, filterValue, row)` on a column decides for itself. An empty text, an empty list and an object of empty ends ask for nothing.

## Facets for filter controls

```vue title="facets.vue"
<script setup lang="ts">
import { Toggle, ToggleGroup } from '@ui-sdk/vue/toggle'
import { createTableController, Table, useTableView, type ColumnDef } from 'ui-sdk-table-vue'
import { computed } from 'vue'

type Shoe = { id: string; model: string; brand: string; color: string }

const shoes: Shoe[] = [
	{ id: 's1', model: 'Trail 2', brand: 'Northway', color: 'Black' },
	{ id: 's2', model: 'Glide', brand: 'Sola', color: 'White' },
	{ id: 's3', model: 'Ridge', brand: 'Northway', color: 'Green' },
	{ id: 's4', model: 'Tempo', brand: 'Sola', color: 'Black' },
	{ id: 's5', model: 'Cloud 9', brand: 'Arc', color: 'White' },
	{ id: 's6', model: 'Summit', brand: 'Northway', color: 'Black' },
]

const columns: ColumnDef<Shoe>[] = [
	{ id: 'model', header: 'Model' },
	{ id: 'brand', header: 'Brand', filter: 'select' },
	{ id: 'color', header: 'Color', filter: 'select' },
]

const LISTS = [
	{ id: 'brand', label: 'Brand' },
	{ id: 'color', label: 'Color' },
]

const controller = createTableController()
const view = useTableView(controller)

// The facets are read again after each change of the view.
const lists = computed(() =>
	view.value
		? LISTS.map((list) => ({
				...list,
				values: controller.getFacets(list.id).values,
				chosen: (view.value?.filter.columns?.[list.id] as string[] | undefined) ?? [],
			}))
		: [],
)
</script>

<template>
	<div v-for="list in lists" :key="list.id">
		<span :id="`facet-${list.id}`" class="control-label">{{ list.label }}</span>
		<ToggleGroup
			multiple
			:aria-labelledby="`facet-${list.id}`"
			:value="list.chosen"
			@value-change="(values) => controller.setColumnFilter(list.id, values)"
		>
			<Toggle v-for="facet in list.values" :key="facet.text" :value="String(facet.value)">
				{{ facet.text }} ({{ facet.count }})
			</Toggle>
		</ToggleGroup>
	</div>
	<Table :rows="shoes" :columns="columns" :controller="controller" aria-label="Running shoes" />
</template>
```

Press Northway. The colors list counts only the shoes of Northway. Press Black too: two shoes match both. Press Northway again to let it go.

`controller.getFacets(columnId)` answers with what a control offers:

| Control | Read |
| --- | --- |
| A list of values | `values`: each with `value`, `text` in the format of the column, and `count`. A combobox can search the list by `text`; `fuzzyScore` of `@ui-sdk/core/text-match` is the search of the table |
| A slider | `range`: `min`, `max` and `step`, the smallest change that the format of the column shows |
| A date picker | `days`: the first and the last day as `YYYY-MM-DD`, in the time zone of the column; `dates` holds the two moments |

- The facets follow the search and the filters of the other columns, and never the filter of the column itself, so a filter does not take away its own choices. `getFacets(columnId, { rows: 'all' })` gives the facets of every row.
- A value that the filter names stays in the list with the count 0 when no row holds it any more.
- `kind` says which filter fits the column: its `filter` option, or what its format says. A column of dates gives `dateRange`, a column of numbers `range`, any other column `text`.
- `sliderBounds(range, { steps: 100 })` gives a slider its ends and a step that a thumb can use: 1, 2 or 5 times a power of ten of the step of a cell, and about a hundred stops.
- A facet is counted when it is asked for, and kept until the search or another filter changes.

## Names

- **Options:** `sort`, `defaultSort`, `filter`, `defaultFilter`, `multiSort`, `alwaysSorted`, `searchDebounce`, `searchMode`, `fuzzyThreshold`, `sortChildren`, `facets`; column keys `sortable`, `compare`, `filter`, `searchable`.
- **Events:** `sort-change`, `filter-change`.
- **Controller:** `sortBy`, `toggleSort`, `setSearch`, `inputSearch`, `flushSearch`, `setColumnFilter`, `clearFilters`, `clearColumnFilters`, `getFacets`.
- **Exports:** `useTableSearch`, `createDebounce`, `sliderBounds`, `isEmptyFilter`, and the types `SortRule`, `FilterState`, `FilterKind`, `FilterMatcher`, `MultiSortMode`, `ColumnFacets`, `ColumnFacetValue`, `FacetOptions`, `TableSearch`.
- **Attributes:** `aria-sort`, `data-sorted` and `data-sort-index` on a header cell.

See the [Sort tiles](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=sort) and the [Filter tiles](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=filter) of the sink.
