<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Departure = { id: string; time: string; to: string; via: string; track: number }

const departures: Departure[] = [
	{ id: 'd1', time: '08:02', to: 'Zürich HB', via: 'Olten', track: 7 },
	{ id: 'd2', time: '08:14', to: 'Genève', via: 'Lausanne', track: 4 },
	{ id: 'd3', time: '08:30', to: 'Lugano', via: 'Arth-Goldau', track: 12 },
	{ id: 'd4', time: '08:47', to: 'Basel SBB', via: 'Liestal', track: 9 },
]
const columns: ColumnDef<Departure>[] = [
	{ id: 'time', header: 'Time', sortable: true },
	{ id: 'to', header: 'To', sortable: true },
	{ id: 'track', header: 'Track', format: 'integer' },
]
</script>

<template>
	<div class="demo look-swiss">
		<div class="sink-frame">
			<Table
				:rows="departures"
				:columns="columns"
				:default-sort="[{ id: 'time' }]"
				aria-label="Departures of the morning"
			/>
		</div>
	</div>
</template>
