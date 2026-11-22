# Groups and totals

Group the rows by the values of a column, and show a total of a column under it, for each group and for the table.

```vue title="groups.vue"
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Sale = { id: string; region: string; rep: string; deals: number; amount: number }

const sales: Sale[] = [
	{ id: 's1', region: 'North', rep: 'Ada Lindqvist', deals: 4, amount: 12400 },
	{ id: 's2', region: 'North', rep: 'Leo Brandt', deals: 2, amount: 5300 },
	{ id: 's3', region: 'South', rep: 'Tomas Reyes', deals: 6, amount: 18750 },
	{ id: 's4', region: 'South', rep: 'Maya Okafor', deals: 3, amount: 9100 },
	{ id: 's5', region: 'South', rep: 'Nina Sato', deals: 1, amount: 2200 },
]

const columns: ColumnDef<Sale>[] = [
	{ id: 'region', header: 'Region' },
	{ id: 'rep', header: 'Rep', sortable: true },
	{ id: 'deals', header: 'Deals', format: 'integer', aggregate: 'sum' },
	{
		id: 'amount',
		header: 'Amount',
		format: 'currency',
		formatOptions: { currency: 'EUR', showUnit: true },
		aggregate: 'sum',
	},
]
</script>

<template>
	<Table
		:rows="sales"
		:columns="columns"
		:group-by="['region']"
		:default-expanded="['group/region=North']"
		:default-column-visibility="{ region: false }"
		locale="en-US"
		aria-label="Sales by region"
	>
		<template #group="{ text, expanded, toggleExpanded, group }">
			<button type="button" :aria-expanded="expanded" @click="toggleExpanded">
				{{ expanded ? '▾' : '▸' }} {{ text }}
			</button>
			({{ group.leaves.length }} reps)
		</template>
		<template #foot-rep>All regions</template>
	</Table>
</template>
```

Press South to open its group. Each group row shows the deals and the amount of its reps under their columns, and the footer shows the totals of every region.

## Totals

A column with `aggregate` has a total: `sum`, `mean`, `min`, `max`, `count`, `uniqueCount` or `first`, or a function `(values, rows) => total`. The table then has a footer row with the total of each column, in the format of the column.

- The footer, the group rows, `controller.getTotals()` and the totals of an export read one function. A total counts the rows that pass the filters, on every page, with their child rows.
- A pinned row that the filter refuses is in view and not in a total.
- `#foot` and `#foot-{column id}` fill a footer cell. They get `column`, `value`, `text`, `totals` and `aggregate`.
- With rows from a server, the table has one page of rows and its totals are of that page. Pass `:totals="{ table: { amount: 1234 }, groups: { 'group/team=Design': { amount: 800 } } }"` for the totals of the server.

## Group rows

`groupBy` is a list of column ids. Each one adds a level of groups. `canGroup(row)` keeps a row out of the groups: the rows that it refuses come first, before every group.

`groupable: true` on a column is for the controls of your app: it marks the columns that a person may group by. The table itself groups by any column that `groupBy` names.

The id of a group is `group/<column id>=<value>`, such as `group/region=North`. `expanded` holds the ids of the open groups, as it holds the ids of open tree rows.

A group row has a label cell and, from the first column with an `aggregate` on, one cell for each column: the total of the group stands under its header and over the total of the footer. The label covers the columns before that. It ends where pinned columns end, so it sticks or scrolls as one cell.

- `#group` fills the label cell. It gets `group`, `text`, `expanded`, `level`, `totals`, `totalTexts`, `toggleExpanded`, the `path` of the group (the groups above it and itself, each with `column`, `value` and `text`, for a label such as "Europe / Finland") and `covered`, the columns under the label. A total of a covered column has no cell of its own.
- `#group-total-{column id}` and `#group-total` fill a cell under a column. They get `group`, `column`, `value`, `text`, `totals`, `aggregate`, `expanded`, `level` and `path`. A column without an `aggregate` has an empty cell, with an empty `text`.
- `:group-totals="false"` gives one cell as wide as the table, as a table without any `aggregate` has.
- Hide the column of the groups with `columnVisibility`: the group rows say its values.

## Keys

| Key | On a cell of a group row |
| --- | --- |
| Enter | Opens or closes the group, from every cell of its row |
| Space | Selects the rows of the group, with `selection="multiple"` |
| The arrows | Cross the cells of the row, as in any row |

A group row holds no values. Its cells are never part of a cell range, and a copy gives an empty line for it.

## Attributes

- `data-kind="group"` on the row, with `aria-expanded` and `aria-level`. A table with group rows has the role `treegrid`.
- `data-kind` on a cell of a group row: `group-label`, `group-total` or `group-blank`.
- `cellAttrs` gets the kind `group` for the label cell and `group-total` for the cells under a column. `rowAttrs` gets the kind `group` with the `path`.

## Names

- **Options:** `groupBy`, `defaultGroupBy`, `groupTotals`, `totals`, `canGroup`; column keys `aggregate`, `groupable`.
- **Events:** `group-by-change`.
- **Controller:** `setGroupBy`, `expandAll`, `collapseAll`, `getTotals`.
- **Slots:** `#group`, `#group-total`, `#group-total-{column id}`, `#foot`, `#foot-{column id}`.
- **Types:** `GroupRow`, `GroupPathEntry`, `AggregateName`, `AggregateFn`, `ColumnTotal`, `TableTotalsSource`.

See the [Group tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=group).
