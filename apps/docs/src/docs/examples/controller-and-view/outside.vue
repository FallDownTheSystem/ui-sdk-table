<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, useTableView, type ColumnDef } from 'ui-sdk-table-vue'

type Flight = { id: string; flight: string; to: string; gate: string; delay: number }

const flights: Flight[] = [
	{ id: 'f1', flight: 'SK 411', to: 'Oslo', gate: 'A4', delay: 0 },
	{ id: 'f2', flight: 'LH 870', to: 'Frankfurt', gate: 'B12', delay: 25 },
	{ id: 'f3', flight: 'AY 132', to: 'Helsinki', gate: 'A9', delay: 5 },
	{ id: 'f4', flight: 'BA 795', to: 'London', gate: 'C2', delay: 40 },
	{ id: 'f5', flight: 'KL 1170', to: 'Amsterdam', gate: 'B3', delay: 0 },
]

const columns: ColumnDef<Flight>[] = [
	{ id: 'flight', header: 'Flight', sortable: true },
	{ id: 'to', header: 'To', sortable: true },
	{ id: 'gate', header: 'Gate' },
	{ id: 'delay', header: 'Delay, min', sortable: true, format: 'integer' },
]

// The controller is the handle to the table, the view is what the table shows now.
const controller = createTableController()
const view = useTableView(controller)
</script>

<template>
	<div>
		<Button @click="controller.sortBy('delay', 'desc')">Most delayed first</Button>
		<Button @click="controller.setColumnFilter('delay', { min: 1 })">Only delayed</Button>
		<Button @click="controller.clearFilters()">Every flight</Button>
	</div>
	<p role="status">
		{{ view?.dataRowCount ?? 0 }} of {{ flights.length }} flights<template v-if="view?.sort[0]"
			>, sorted by {{ view.sort[0].id }}</template
		>
	</p>
	<Table :rows="flights" :columns="columns" :controller="controller" aria-label="Departures" />
</template>
