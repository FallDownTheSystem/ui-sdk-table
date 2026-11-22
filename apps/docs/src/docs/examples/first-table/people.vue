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
	{ id: 'score', header: 'Score', sortable: true, format: 'integer' },
]
</script>

<template>
	<Table :rows="people" :columns="columns" aria-label="People" />
</template>
