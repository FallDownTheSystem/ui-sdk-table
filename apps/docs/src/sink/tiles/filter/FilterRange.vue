<script setup lang="ts">
import {
	Slider,
	SliderControl,
	SliderIndicator,
	SliderThumb,
	SliderTrack,
	SliderValue,
} from '@ui-sdk/vue/slider'
import {
	createTableController,
	sliderBounds,
	Table,
	useTableView,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { euro, products, type Product } from '../../data'

// A few products, so the table stands whole in its tile.
const shelf = products.slice(0, 4)
const columns: ColumnDef<Product>[] = [
	{ id: 'name', header: 'Product' },
	{ id: 'price', header: 'Price', filter: 'range', format: 'currency', formatOptions: euro },
]
const controller = createTableController()
const view = useTableView(controller)

// The lowest and the highest price of every row, on whole steps of the format.
const ends = computed(() => {
	const range = view.value ? controller.getFacets('price', { rows: 'all' }).range : null
	return range ? sliderBounds(range) : undefined
})
const picked = shallowRef<number[]>()

function slide(value: number | number[]) {
	if (!Array.isArray(value)) return
	picked.value = value
	controller.setColumnFilter('price', { min: value[0], max: value[1] })
}
</script>

<template>
	<div class="demo">
		<div v-if="ends" class="demo-bar">
			<Slider
				:min="ends.min"
				:max="ends.max"
				:step="ends.step * 10"
				:value="picked ?? [ends.min, ends.max]"
				:format="{ style: 'currency', currency: 'EUR' }"
				locale="en"
				aria-label="Price"
				@value-change="slide"
			>
				<SliderControl>
					<SliderTrack>
						<SliderIndicator />
						<SliderThumb :index="0" aria-label="Lowest price" />
						<SliderThumb :index="1" aria-label="Highest price" />
					</SliderTrack>
				</SliderControl>
				<SliderValue />
			</Slider>
		</div>
		<div class="sink-frame">
			<Table
				:rows="shelf"
				:columns="columns"
				:controller="controller"
				locale="en"
				aria-label="Products in a price range"
			>
				<template #empty>Nothing costs that. Widen the range.</template>
			</Table>
		</div>
	</div>
</template>
