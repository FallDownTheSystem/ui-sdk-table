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
