<script setup lang="ts">
import { Input, InputClear, InputGroup } from '@ui-sdk/vue/input'
import {
	createTableController,
	Table,
	useTableSearch,
	useTableView,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { createPeople, type Person } from '../../data'
import SinkIcon from '../../parts/SinkIcon.vue'

const people = createPeople(13)
const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'team', header: 'Team' },
	{ id: 'country', header: 'Country' },
]
const controller = createTableController()
const search = useTableSearch(controller)
const view = useTableView(controller)

// The clear button acts at once; a letter waits for the pause.
function typed(text: string, details: { reason: string }) {
	if (details.reason === 'clear-press') search.clear()
	else search.text.value = text
}
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<InputGroup>
				<SinkIcon name="search" />
				<Input
					type="search"
					aria-label="Search people"
					placeholder="Name, team or country"
					:value="search.text.value"
					@value-change="typed"
					@keydown.escape="search.clear()"
					@keydown.enter="search.flush()"
				/>
				<InputClear aria-label="Clear the search"><SinkIcon name="x" /></InputClear>
			</InputGroup>
		</div>
		<p class="readout" role="status">
			<strong class="display">{{ search.pending.value ? '…' : (view?.dataRowCount ?? 0) }}</strong>
			<span class="readout-label">{{
				search.pending.value ? 'waiting for a pause' : 'people found'
			}}</span>
		</p>
		<div class="sink-frame">
			<Table
				:rows="people"
				:columns="columns"
				:controller="controller"
				:search-debounce="350"
				sticky-header
				aria-label="People, searched after a pause"
			>
				<template #empty>No person matches. Try a shorter text.</template>
			</Table>
		</div>
	</div>
</template>
