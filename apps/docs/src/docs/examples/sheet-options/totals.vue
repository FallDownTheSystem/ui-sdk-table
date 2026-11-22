<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { Table, type AggregateName, type ColumnAggregates, type ColumnDef } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Trip = { id: string; city: string; nights: number; cost: number }

const trips: Trip[] = [
	{ id: 't1', city: 'Lisbon', nights: 3, cost: 420 },
	{ id: 't2', city: 'Vienna', nights: 2, cost: 380 },
	{ id: 't3', city: 'Krakow', nights: 4, cost: 310 },
]

const columns: ColumnDef<Trip>[] = [
	{ id: 'city', header: 'City' },
	{ id: 'nights', header: 'Nights', format: 'integer', aggregate: 'sum' },
	{ id: 'cost', header: 'Cost', format: 'integer', aggregate: 'sum' },
]

// The app holds the function of each total. A column without an entry keeps its `aggregate`.
const aggregates = shallowRef<ColumnAggregates>({})
const choices: AggregateName[] = ['sum', 'mean', 'max']
</script>

<template>
	<Table
		v-model:column-aggregates="aggregates"
		:rows="trips"
		:columns="columns"
		aria-label="Trips of the year"
	>
		<template #foot="{ column, text, aggregate, setAggregate }">
			<template v-if="aggregate">
				{{ text }}
				<Button
					v-for="name in choices"
					:key="name"
					:aria-label="`${name} of ${column.header}`"
					:aria-pressed="aggregate === name"
					@click="setAggregate(name)"
				>
					{{ name }}
				</Button>
			</template>
		</template>
	</Table>
</template>
