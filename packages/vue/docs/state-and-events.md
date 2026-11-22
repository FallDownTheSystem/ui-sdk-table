# State and events

Start a state where you want it, hold it in your app, and hear each change with its reason.

Every state of the table works the same way, as the state of a UI SDK component does. Use `default<Key>` to choose where a state starts, and `v-model:<key>` to hold it in your app.

```vue title="controlled.vue"
<script setup lang="ts">
import { Table, type ColumnDef, type SortRule, type TableChangeDetails } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Player = { id: string; name: string; club: string; goals: number }

const players: Player[] = [
	{ id: 'p1', name: 'Lena Fischer', club: 'Rovers', goals: 14 },
	{ id: 'p2', name: 'Sam Carter', club: 'United', goals: 21 },
	{ id: 'p3', name: 'Noor Haddad', club: 'Rovers', goals: 9 },
	{ id: 'p4', name: 'Ivan Petrov', club: 'Athletic', goals: 17 },
]

const columns: ColumnDef<Player>[] = [
	{ id: 'name', header: 'Player', sortable: true },
	{ id: 'club', header: 'Club', sortable: true },
	{ id: 'goals', header: 'Goals', sortable: true, format: 'integer' },
]

// The app holds the sort: the table shows what this ref says.
const sort = shallowRef<readonly SortRule[]>([{ id: 'goals', desc: true }])
const said = shallowRef('No change yet.')

function onSortChange(value: readonly SortRule[], details: TableChangeDetails) {
	// The club column sorts only with another column before it.
	if (value[0]?.id === 'club' && value.length === 1) {
		details.cancel()
		said.value = 'Refused: sort by goals or by player first, then add the club with Shift.'
		return
	}
	said.value = `${value.map((rule) => `${rule.id} ${rule.desc ? 'down' : 'up'}`).join(', ') || 'no sort'}, by ${details.reason}`
}
</script>

<template>
	<Table
		v-model:sort="sort"
		:rows="players"
		:columns="columns"
		aria-label="Goals of the season"
		@sort-change="onSortChange"
	/>
	<p role="status">{{ said }}</p>
</template>
```

Press a header to sort. The line under the table says the sort and its reason. Press Club alone and the app refuses it; press Goals, then Club with Shift, and the sort holds both.

## Three props for each state

| Prop | What it does |
| --- | --- |
| `<key>` | The value of the state. With it, the app holds the state: `v-model:<key>` |
| `default<Key>` | Where the state starts when the table holds it |
| `@<key>-change` | Runs at each change, with `(value, details)` |

The keys are `sort`, `filter`, `groupBy`, `page`, `expanded`, `selected`, `columnVisibility`, `columnOrder`, `columnWidths`, `columnPinning`, `rowPinning`, `columnAggregates`, `cellFormats`, `cellFormulas` and `cellRange`.

`columnWidths` and `cellRange` change at each step of a drag. Their `@column-widths-commit` and `@cell-range-commit` run once, when the drag ends.

## The details of a change

- `details.reason` says why the state changed: `press`, `item-press`, `list-navigation`, `input-change`, `imperative` (a call of the controller), `reset`, `drag`, `move-key`, `resize-key`, `escape-key`, `shortcut`, `undo` or `redo`. The type is `TableReason`.
- `details.event` is the event behind the change, when there was one.
- `details.source` says how the person caused it: `mouse`, `touch`, `pen`, `keyboard`, `virtual`, `agent` for a call of an agent, or `programmatic`. Read it for analytics, never for behavior.
- `details.cancel()` refuses the change. The table then sends no `update:<key>`, so a `v-model` keeps its value.

## The table never changes your data

The rows and the columns are yours. The table never copies or changes a row object. Each row needs a stable id: the `id` property, or what `getRowId(row, index, parent)` returns.

An edit of a cell is no state. The table reports it through `@cell-edit`, and the app puts the value into its rows: see [Editing](./cell-editing.md).

With `v-model:<key>`, the table renders whole at each change, as for every prop that the owner holds. With `default<Key>`, the table keeps the value itself. For a large table, prefer `default<Key>` and listen to `@<key>-change` where the app only needs to hear a change.

## Keep going

- [Controller and view](./controller-and-view.md) changes a state from code, and reads what the table shows.
