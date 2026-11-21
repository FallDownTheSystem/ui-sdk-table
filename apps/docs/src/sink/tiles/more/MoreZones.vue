<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Flight = { id: string; flight: string; departs: string }

const flights: Flight[] = [
	{ id: 'f1', flight: 'AY 5', departs: '2026-12-01T15:10:00Z' },
	{ id: 'f2', flight: 'AY 15', departs: '2026-12-01T22:45:00Z' },
	{ id: 'f3', flight: 'DL 203', departs: '2026-12-02T08:30:00Z' },
	{ id: 'f4', flight: 'AY 9', departs: '2026-12-02T12:05:00Z' },
]
const time = { weekday: 'short', hour: '2-digit', minute: '2-digit' } as const
const columns: ColumnDef<Flight>[] = [
	{ id: 'flight', header: 'Flight' },
	// Two columns read one value, each in a time zone of its own.
	{
		id: 'helsinki',
		header: 'Helsinki',
		key: 'departs',
		format: 'datetime',
		formatOptions: { ...time, timeZone: 'Europe/Helsinki' },
	},
	{
		id: 'new-york',
		header: 'New York',
		key: 'departs',
		format: 'datetime',
		formatOptions: { ...time, timeZone: 'America/New_York' },
	},
]
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="flights"
				:columns="columns"
				locale="en-GB"
				aria-label="Departures in two time zones"
			/>
		</div>
	</div>
</template>
