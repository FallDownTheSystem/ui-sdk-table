<script setup lang="ts">
import {
	createTableController,
	rowNumberColumn,
	Table,
	useTableView,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { computed } from 'vue'

type City = { id: string; city: string; country: string; people: number }

const cities: City[] = [
	{ id: 'c1', city: 'Porto', country: 'Portugal', people: 232000 },
	{ id: 'c2', city: 'Ghent', country: 'Belgium', people: 265000 },
	{ id: 'c3', city: 'Tartu', country: 'Estonia', people: 97000 },
]

const columns: ColumnDef<City>[] = [
	// A column of row numbers: it stays first, and no range, copy or export holds it.
	rowNumberColumn<City>(),
	{ id: 'city', header: 'City' },
	{ id: 'country', header: 'Country' },
	{ id: 'people', header: 'People', format: 'integer' },
]

const controller = createTableController()
const view = useTableView(controller)
const said = computed(() => {
	const cells = view.value?.cellSelection
	return cells ? `${cells.rows} by ${cells.columns} cells` : 'Nothing selected'
})
</script>

<template>
	<Table
		:rows="cities"
		:columns="columns"
		:controller="controller"
		cell-selection
		column-letters
		aria-label="Cities"
	/>
	<p role="status">{{ said }}</p>
</template>
