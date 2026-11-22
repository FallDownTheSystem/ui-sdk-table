# First table

Put a table on a page and give it looks.

If you haven't added the packages yet, start with [Installation](./installation.md).

## Put a table on a page

A table needs rows, columns and a name. Each row needs a stable `id`. Each column has an `id`, which is also the key of its value in the row.

```vue title="people.vue"
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Person = { id: string; name: string; team: string; score: number }

const people: Person[] = [
	{ id: 'p1', name: 'Ines Moreau', team: 'Design', score: 82 },
	{ id: 'p2', name: 'Kofi Mensah', team: 'Platform', score: 91 },
	{ id: 'p3', name: 'Wren Takahashi', team: 'Design', score: 77 },
	{ id: 'p4', name: 'Hollis Grant', team: 'Support', score: 88 },
]

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team', sortable: true },
	{ id: 'score', header: 'Score', sortable: true },
]
</script>

<template>
	<Table :rows="people" :columns="columns" aria-label="People" />
</template>
```

Press Score to sort by it. Press it again to turn the order. Press Tab to reach the table, then move between the cells with the arrow keys.

`aria-label` gives the table its accessible name. A screen reader and an agent find the table by it.

The table never copies or changes your row objects. It reads them, and it reports a change through an event.

## Add looks

The table has no looks of its own. Every element carries a `data-slot`, and its state shows as `aria-*` and `data-*` attributes. A style reads those, and no class.

| Part | Attribute |
| --- | --- |
| The table | `data-slot="table"` |
| A header row and a body row | `data-slot="table-header-row"`, `data-slot="table-row"` |
| A header cell and a body cell | `data-slot="table-cell"`, in a `th` or a `td` |
| The column of a cell | `data-column` with the column id |
| The format of a column | `data-format` on each of its cells, such as `decimal` |
| The sort of a column | `aria-sort` and `data-sorted` (`asc` or `desc`) on its header cell |

```vue title="styled.vue"
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Person = { id: string; name: string; team: string; score: number }

const people: Person[] = [
	{ id: 'p1', name: 'Ines Moreau', team: 'Design', score: 82.5 },
	{ id: 'p2', name: 'Kofi Mensah', team: 'Platform', score: 91 },
	{ id: 'p3', name: 'Wren Takahashi', team: 'Design', score: 77.25 },
	{ id: 'p4', name: 'Hollis Grant', team: 'Support', score: 88 },
]

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team', sortable: true },
	{ id: 'score', header: 'Score', sortable: true, format: 'decimal' },
]
</script>

<template>
	<div class="people">
		<Table
			:rows="people"
			:columns="columns"
			:default-sort="[{ id: 'score', desc: true }]"
			always-sorted
			aria-label="People by score"
		/>
	</div>
</template>

<style scoped>
/* The table renders its own elements, so the rules reach them through :deep(). */
.people :deep([data-slot='table']) {
	border-collapse: collapse;
	font-size: 14px;
}

.people :deep([data-slot='table-cell']) {
	padding: 8px 14px;
	border-block-end: 1px solid #e3e3e8;
	text-align: start;
}

.people :deep([data-slot='table-head'] [data-slot='table-cell']) {
	color: #55555f;
	font-weight: 500;
}

/* A number reads best on the end edge of its cell. */
.people :deep([data-format='decimal']) {
	text-align: end;
	font-variant-numeric: tabular-nums;
}

.people :deep([data-slot='table-cell'] button) {
	padding: 0;
	border: 0;
	background: none;
	font: inherit;
	color: inherit;
	cursor: pointer;
}

/* The sort shows on the header cell: `aria-sort`, and `data-sorted` with asc or desc. */
.people :deep([data-sorted='asc'] button)::after {
	content: ' ↑';
}

.people :deep([data-sorted='desc'] button)::after {
	content: ' ↓';
}

.people :deep([data-slot='table-row']:hover) {
	background: #f4f4f7;
}

/* One cell of the grid holds focus. The ring stays inside the cell. */
.people :deep([data-slot='table-cell']:focus-visible) {
	outline: 2px solid #3b5bdb;
	outline-offset: -2px;
}
</style>
```

Press Score to turn the order, and Name to sort by name. The arrow comes from data-sorted. Hover a row, or reach a cell with Tab, to see the hover and the focus ring.

`always-sorted` keeps one column in the sort: a press on it turns the order and never clears it.

The rules of a scoped style reach the elements of the table through `:deep()`, because the table renders them.

## Keep going

- [Introduction](./introduction.md) says what the library gives and what your app builds.
