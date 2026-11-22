# Controller and view

Change the table from a control beside it, and read what it shows now.

A toolbar, a search field, a filter control and the pages of a table live outside the table. They act through a controller and read a view. The same controller is what an agent calls.

```vue title="outside.vue"
<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, useTableView, type ColumnDef } from 'ui-sdk-table-vue'

type Flight = { id: string; flight: string; to: string; gate: string; delay: number }

const flights: Flight[] = [
	{ id: 'f1', flight: 'SK 411', to: 'Oslo', gate: 'A4', delay: 0 },
	{ id: 'f2', flight: 'LH 870', to: 'Frankfurt', gate: 'B12', delay: 25 },
	{ id: 'f3', flight: 'AY 132', to: 'Helsinki', gate: 'A9', delay: 5 },
	{ id: 'f4', flight: 'BA 795', to: 'London', gate: 'C2', delay: 40 },
	{ id: 'f5', flight: 'KL 1170', to: 'Amsterdam', gate: 'B3', delay: 0 },
]

const columns: ColumnDef<Flight>[] = [
	{ id: 'flight', header: 'Flight', sortable: true },
	{ id: 'to', header: 'To', sortable: true },
	{ id: 'gate', header: 'Gate' },
	{ id: 'delay', header: 'Delay, min', sortable: true, format: 'integer' },
]

// The controller is the handle to the table, the view is what the table shows now.
const controller = createTableController()
const view = useTableView(controller)
</script>

<template>
	<div>
		<Button @click="controller.sortBy('delay', 'desc')">Most delayed first</Button>
		<Button @click="controller.setColumnFilter('delay', { min: 1 })">Only delayed</Button>
		<Button @click="controller.clearFilters()">Every flight</Button>
	</div>
	<p role="status">
		{{ view?.dataRowCount ?? 0 }} of {{ flights.length }} flights<template v-if="view?.sort[0]"
			>, sorted by {{ view.sort[0].id }}</template
		>
	</p>
	<Table :rows="flights" :columns="columns" :controller="controller" aria-label="Departures" />
</template>
```

Press Most delayed first, then Only delayed. The line above the table reads the view: how many flights pass and the sort. Every flight brings the rows back.

## The controller

```ts
import { createTableController } from 'ui-sdk-table-vue'

const controller = createTableController()
```

Pass it as the `controller` prop. Then call its methods from anywhere:

- **Sort and filter:** `sortBy`, `toggleSort`, `setSearch`, `inputSearch`, `flushSearch`, `setColumnFilter`, `clearFilters`, `clearColumnFilters`.
- **Groups and pages:** `setGroupBy`, `setPage`, `setPageSize`, `nextPage`, `previousPage`, `firstPage`, `lastPage`.
- **Rows:** `expand`, `collapse`, `toggleExpanded`, `expandAll`, `collapseAll`, `select`, `toggleSelected`, `selectAll`, `selectRows`, `deselectRows`, `clearSelection`, `pinRow`, `scrollToRow`.
- **Columns:** `setColumnVisibility`, `toggleColumnVisibility`, `showAllColumns`, `hideAllColumns`, `moveColumn`, `setColumnOrder`, `setColumnWidth`, `pinColumn`, the `reset…` methods, `setColumnAggregate`.
- **Cells:** `editCell`, `startEdit`, `cancelEdit`, `selectCells`, `copyCells`, `pasteCells` and the methods of the data sheet.
- **Reads:** `getView`, `getFacets`, `getTotals`, `getSelectionSummary`, `exportData`, `subscribe`.

A method that gets a wrong argument throws a message that lists the valid values, such as `No column "age" to sort by. Columns: name, score.`

A controller can be made before the table mounts. Before the table exists, a call does nothing and answers `undefined`. `subscribe` is safe to call early: its listener waits for the table, runs once when the table is there, and then after each change. A table that comes in place of another (a new `key`) takes over every listener.

## The view

`useTableView(controller)` is a ref of `getView()` that follows the table. It holds `undefined` until the table is there.

| Field | What it holds |
| --- | --- |
| `sort`, `filter`, `groupBy`, `expanded`, `selected` | The state |
| `search`, `searchPending` | The text of a search field, and whether it waits for a pause |
| `page`, `pageSize`, `pageCount`, `rowCount`, `pageUnit`, `lastPageKnown` | The pages |
| `dataRowCount` | How many data rows pass the filters, child rows too |
| `columns`, `visibleColumns` | Every column that holds cells, and the columns in view in their order |
| `selectable` | The ids of the rows that `selectAll` selects |
| `hasExpandable`, `hasExpanded` | Whether something can open, and whether something is open |
| `loading` | The `loading` prop |
| `activeCell`, `cellSelection`, `canUndo`, `canRedo` | For a sheet |

A read that depends on the table, such as `controller.getFacets(id)`, goes in a `computed` that reads the view first. It is then asked again after each change.

Without Vue, `controller.subscribe(listener)` runs the listener after each change of the state, the rows or the columns, with the keys that changed. It returns the function that stops it.

## Names

- **Vue:** `createTableController`, `useTableView`, `useTableSearch`, `useSelectionSummary`.
- **Types:** `PageUnit`.

Every option, event, slot, controller method and view field of this page is in the reference: [Table](./reference-table.md), [Controller](./reference-controller.md) and [View](./reference-view.md).

See the [More tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=more).
