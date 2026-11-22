<script setup lang="ts">
import { Toggle, ToggleGroup } from '@ui-sdk/vue/toggle'
import { createTableController, Table, useTableView, type ColumnDef } from 'ui-sdk-table-vue'
import { computed } from 'vue'

type Shoe = { id: string; model: string; brand: string; color: string }

const shoes: Shoe[] = [
	{ id: 's1', model: 'Trail 2', brand: 'Northway', color: 'Black' },
	{ id: 's2', model: 'Glide', brand: 'Sola', color: 'White' },
	{ id: 's3', model: 'Ridge', brand: 'Northway', color: 'Green' },
	{ id: 's4', model: 'Tempo', brand: 'Sola', color: 'Black' },
	{ id: 's5', model: 'Cloud 9', brand: 'Arc', color: 'White' },
	{ id: 's6', model: 'Summit', brand: 'Northway', color: 'Black' },
]

const columns: ColumnDef<Shoe>[] = [
	{ id: 'model', header: 'Model' },
	{ id: 'brand', header: 'Brand', filter: 'select' },
	{ id: 'color', header: 'Color', filter: 'select' },
]

const LISTS = [
	{ id: 'brand', label: 'Brand' },
	{ id: 'color', label: 'Color' },
]

const controller = createTableController()
const view = useTableView(controller)

// The facets are read again after each change of the view.
const lists = computed(() =>
	view.value
		? LISTS.map((list) => ({
				...list,
				values: controller.getFacets(list.id).values,
				chosen: (view.value?.filter.columns?.[list.id] as string[] | undefined) ?? [],
			}))
		: [],
)
</script>

<template>
	<div v-for="list in lists" :key="list.id">
		<span :id="`facet-${list.id}`" class="control-label">{{ list.label }}</span>
		<ToggleGroup
			multiple
			:aria-labelledby="`facet-${list.id}`"
			:value="list.chosen"
			@value-change="(values) => controller.setColumnFilter(list.id, values)"
		>
			<Toggle v-for="facet in list.values" :key="facet.text" :value="String(facet.value)">
				{{ facet.text }} ({{ facet.count }})
			</Toggle>
		</ToggleGroup>
	</div>
	<Table :rows="shoes" :columns="columns" :controller="controller" aria-label="Running shoes" />
</template>
