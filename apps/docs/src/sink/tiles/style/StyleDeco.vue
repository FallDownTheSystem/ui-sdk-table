<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Passenger = { id: string; cabin: string; name: string; deck: string }

const passengers: Passenger[] = [
	{ id: 'p1', cabin: 'A 12', name: 'Mrs. Vivian Hale', deck: 'Promenade' },
	{ id: 'p2', cabin: 'A 14', name: 'Mr. Julian Ash', deck: 'Promenade' },
	{ id: 'p3', cabin: 'B 3', name: 'Miss Ada Crane', deck: 'Saloon' },
	{ id: 'p4', cabin: 'B 9', name: 'Dr. Felix Morrow', deck: 'Saloon' },
]
const columns: ColumnDef<Passenger>[] = [
	{ id: 'cabin', header: 'Cabin' },
	{ id: 'name', header: 'Passenger', sortable: true },
	{ id: 'deck', header: 'Deck' },
]
</script>

<template>
	<div class="demo look-deco">
		<div class="sink-frame">
			<Table :rows="passengers" :columns="columns" aria-label="Passengers of the liner, 1925" />
		</div>
	</div>
</template>
