<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	createTableController,
	Table,
	type ColumnDef,
	type ColumnPinning,
	type ColumnVisibility,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type City = { id: string; name: string; country: string; people: number; area: number }

const cities: City[] = [
	{ id: 'c1', name: 'Lisbon', country: 'Portugal', people: 545000, area: 100 },
	{ id: 'c2', name: 'Vienna', country: 'Austria', people: 1982000, area: 415 },
	{ id: 'c3', name: 'Oslo', country: 'Norway', people: 709000, area: 454 },
]

const columns: ColumnDef<City>[] = [
	// A city has no name to hide: the column stays.
	{ id: 'name', header: 'City', width: 140, hideable: false },
	{ id: 'country', header: 'Country', width: 140 },
	{ id: 'people', header: 'People', width: 130, format: 'integer' },
	{ id: 'area', header: 'Area, km²', width: 130, format: 'integer' },
]

const controller = createTableController()
const visibility = shallowRef<ColumnVisibility>({})
const pinning = shallowRef<ColumnPinning>({})
</script>

<template>
	<div>
		<Button @click="controller.toggleColumnVisibility('country')">
			{{ visibility.country === false ? 'Show' : 'Hide' }} the country
		</Button>
		<Button @click="controller.pinColumn('name', pinning.start?.includes('name') ? null : 'start')">
			{{ pinning.start?.includes('name') ? 'Free' : 'Pin' }} the city
		</Button>
		<Button @click="controller.resetColumnWidths()">Reset the widths</Button>
	</div>
	<Table
		v-model:column-visibility="visibility"
		v-model:column-pinning="pinning"
		:rows="cities"
		:columns="columns"
		:controller="controller"
		resizable
		reorderable
		aria-label="Cities"
	/>
</template>
