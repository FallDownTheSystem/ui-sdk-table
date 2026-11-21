# ui-sdk-table-vue

The headless table for Vue: `Table`, its parts, slots, a `v-model` for each state, and `createTableController`. It renders a real `<table>` without any looks. A styled table is the work of the consumer, and is built on it.

```vue
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Person = { id: string; name: string; team: string }
const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team' },
]
</script>

<template>
	<Table :rows="people" :columns="columns" label="People" />
</template>
```

- `ui-sdk-table-vue/export` holds the CSV and Excel writers. Load it with `import()` where a person asks for a file, so a page without an export does not carry it.
- The package ships TypeScript source (`exports` points at `src`), so an app compiles it with its own compiler options.
- The export is named `Table`. An app that registers a component of its own with that name (for example by file name) imports this one under another name: `import { Table as HeadlessTable } from 'ui-sdk-table-vue'`.
- `rowAttrs` and `cellAttrs` give attributes to rows and cells. The table spreads them first and its own attributes after them, so a caller cannot replace a part prop (`value`, `index`, `row`, `col`, `colspan`) or a state attribute (`aria-*`, `data-*` of the table).
- `createTableController()` can be used before the table mounts: `subscribe` waits for the table and runs once when it is there.

## What a styled table builds on

| Need | What the table gives |
| --- | --- |
| Looks | `data-slot` on every part (`table`, `table-row`, `table-cell`, ...), state as `aria-*` and `data-*` attributes (`data-kind`, `data-pinned`, `data-sticky`, `data-selected`, `data-active`), and `rowAttrs`, `cellAttrs`, `sectionAttrs` for classes |
| Widths and offsets | `--table-width`, `--table-column-width`, `--table-pin-offset`, `--table-sticky-offset`, `--table-row-height`, `--table-spacer-size`. A page with a fixed header or footer sets `--table-sticky-top` and `--table-sticky-bottom` on the table or a parent, and the sticky rows stop there |
| A checkbox or an expand column | A column with `lead: true`: always first, never in the column order or the pins, and it sticks with the first column that is pinned to the start |
| Controls beside the table | `createTableController()`, then `getView()` for the state and the pages, `subscribe()` for when to read again, and one method for each action |
| A search field | `useTableSearch(controller)`: see below |
| Filter controls | `getFacets(columnId)`: see below |
| Totals | The footer row, the cells of a group row, `getTotals()`, and the `totals` option for totals that only a server knows |

## Group rows

A group row has a label cell and, from the first column with an `aggregate` on, one cell for each column: the total of the group stands under its header and over the total of the footer. The label covers the columns before that. It ends where pinned columns end, so it sticks or scrolls as one cell.

- `#group` fills the label cell. It gets `group`, `text`, `expanded`, `level`, `totals`, `totalTexts`, `toggleExpanded`, the `path` of the group (the groups above it and itself, each with `column`, `value` and `text`, for a label such as "Europe / Finland") and `covered`, the columns under the label. A total of a covered column has no cell of its own.
- `#group-total-{column id}` and `#group-total` fill a cell under a column, in the way of `#foot-{column id}` and `#foot`. They get `group`, `column`, `value`, `text`, `totals`, `expanded`, `level` and `path`. A column without an `aggregate` has an empty cell, with an empty `text`.
- `cellAttrs` gets the kind `group` for the label cell and `group-total` for the cells under a column. The cells carry `data-kind`: `group-label`, `group-total` or `group-blank`.
- `:group-totals="false"` gives one cell as wide as the table, as a table without any `aggregate` has.
- Enter on any cell of a group row opens or closes the group, and Space selects its rows. A group row holds no values: its cells are never marked as part of a cell range, and a copy gives an empty line for it.

The footer, the group rows, `getTotals` and the totals of an export read one function. A total counts the rows that pass the filters, on every page, with their child rows; a pinned row that the filter refuses is in view and not in a total. With rows from a server (`manualFilter`, `manualPage`) the table has one page of rows and its totals are of that page: pass `:totals="{ table: { amount: 1234 }, groups: { 'group/team=Design': { amount: 800 } } }"` for the totals of the server.

## Filter controls

`controller.getFacets(columnId)` answers with what a control offers. The facets follow the search and the filters of the other columns, and never the filter of the column itself. `getFacets(columnId, { rows: 'all' })` gives the facets of every row.

| Control | Read |
| --- | --- |
| A list of values | `values`: each with `value`, `text` in the format of the column, and `count`. A value that the filter names stays in the list with the count 0 when no row holds it any more. A combobox of the design system can search the list by `text`; `fuzzyScore` of `@ui-sdk/core/text-match` is the search of the table |
| A slider | `range`: `min`, `max` and `step`, the smallest change that the format of the column shows. `sliderBounds(range)` gives ends that are whole steps |
| A date picker | `days`: the first and the last day as `YYYY-MM-DD`, in the time zone of the column; `dates` holds the two moments |

A facet is counted when it is asked for, and kept until the search or another filter changes. With `manualFilter`, the rows are what the server sent; the `facets` option gives the choices of every row.

## A search field with a pause

```vue
<script setup lang="ts">
import { createTableController, Table, useTableSearch } from 'ui-sdk-table-vue'

const controller = createTableController()
const search = useTableSearch(controller)
</script>

<template>
	<input
		v-model="search.text.value"
		type="search"
		@keydown.escape="search.clear()"
		@keydown.enter="search.flush()"
	/>
	<Table :rows="people" :columns="columns" :controller="controller" :search-debounce="200" />
</template>
```

The field shows each letter at once. The table filters when the typing pauses for `searchDebounce` milliseconds (200 without the prop), with one change of `filter` and the reason `input-change`. `clear` and `setSearch` act at once and drop a text that waits, and so do `clearFilters` and a new search text from the owner of `v-model:filter`. `search.pending` says that a text waits. The table itself says nothing to a screen reader about a search: announce the rows found when `filter` changes, which is one time after the pause.

Without Vue, the same is `controller.inputSearch(text, event)`, `controller.flushSearch()`, and `search` and `searchPending` of `getView()`. `createDebounce(run, { debounce })` is the utility under it, with `call`, `cancel`, `flush` and `pending`.

## Sort modes

- `multi-sort="modifier"` (the default): a press on a header replaces the sort, and a press with Shift, Control or Command adds the column. `"none"`: one column at a time, whatever key is held. `"always"`: each press adds the column. Enter on a header follows the same rule.
- `always-sorted`: a press on the only column of the sort turns the order and never clears it. Off by default.
- `toggleSort(event)` of the `#header` slot passes the event, and the table reads the keys. `controller.toggleSort(id, { append: true })` and `sortBy(id, direction, { append: true })` throw in the mode `none`.
- A `sort` of the owner with more columns than the mode allows is left as it is. With `manualSort`, the rules are the same: the state is the request.

## Columns back to their start

`controller.hideAllColumns()` hides every column that can be hidden, in one change; a column with `hideable: false` and a `lead` column stay, and the first column in view stays when no other would. `resetColumnVisibility()`, `resetColumnOrder()` and `resetColumnPinning()` bring a state back to what the table started with (its `default…` prop, else the empty state), with the reason `reset`. `resetColumnWidths()` takes every width away. A `v-model:column-visibility` that hides every column gives a table without columns; the table does not correct the state of its owner.
