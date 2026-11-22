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
