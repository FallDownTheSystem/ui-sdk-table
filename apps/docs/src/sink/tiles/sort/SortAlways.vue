<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Runner = { id: string; name: string; club: string; time: number }

const runners: Runner[] = [
	{ id: 'r1', name: 'Saara Laine', club: 'Kaleva', time: 34.12 },
	{ id: 'r2', name: 'Onni Aalto', club: 'Viri', time: 33.48 },
	{ id: 'r3', name: 'Helmi Virta', club: 'Kaleva', time: 35.02 },
	{ id: 'r4', name: 'Eero Niemi', club: 'Pyrintö', time: 32.57 },
	{ id: 'r5', name: 'Aino Korpi', club: 'Viri', time: 36.4 },
	{ id: 'r6', name: 'Lauri Salo', club: 'Pyrintö', time: 34.55 },
	{ id: 'r7', name: 'Maija Ranta', club: 'Kaleva', time: 33.9 },
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
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="runners"
				:columns="columns"
				:default-sort="[{ id: 'time' }]"
				always-sorted
				multi-sort="none"
				aria-label="Results of the 10 km run"
			/>
		</div>
	</div>
</template>
