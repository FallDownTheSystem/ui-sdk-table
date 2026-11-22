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
