<script setup lang="ts">
import {
	TableBody,
	TableCell,
	TableHead,
	TableHeaderCell,
	TableHeaderRow,
	TableRoot,
	TableRow,
	type ColumnDef,
} from 'ui-sdk-table-vue'

type Planet = { id: string; name: string; moons: number }

const planets: Planet[] = [
	{ id: 'mars', name: 'Mars', moons: 2 },
	{ id: 'jupiter', name: 'Jupiter', moons: 95 },
	{ id: 'saturn', name: 'Saturn', moons: 146 },
]

// `TableRoot` is not generic: its columns are `ColumnDef` of rows of an unknown type.
const columns: ColumnDef[] = [
	{ id: 'name', header: 'Planet' },
	{ id: 'moons', header: 'Moons' },
]
</script>

<template>
	<!-- The root takes the options of the table. Each part gets a key of its own as `value`, and its place in the grid. -->
	<TableRoot :rows="planets" :columns="columns" aria-label="Planets and their moons">
		<TableHead>
			<TableHeaderRow value="header" :index="0">
				<TableHeaderCell
					v-for="(column, col) in columns"
					:key="column.id"
					:value="`h|${column.id}`"
					:row="0"
					:col="col"
					header
				>
					{{ column.header }}
				</TableHeaderCell>
			</TableHeaderRow>
		</TableHead>
		<TableBody>
			<TableRow
				v-for="(planet, index) in planets"
				:key="planet.id"
				:value="planet.id"
				:index="index + 1"
			>
				<TableCell :value="`${planet.id}|name`" :row="index + 1" :col="0">{{
					planet.name
				}}</TableCell>
				<TableCell :value="`${planet.id}|moons`" :row="index + 1" :col="1">{{
					planet.moons
				}}</TableCell>
			</TableRow>
		</TableBody>
	</TableRoot>
</template>
