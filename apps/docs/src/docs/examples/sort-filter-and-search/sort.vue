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
