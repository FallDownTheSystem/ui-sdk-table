<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type CellRange, type ColumnDef } from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'

type Show = {
	id: string
	show: string
	mon: number
	tue: number
	wed: number
	thu: number
	fri: number
}

const shows: Show[] = [
	{ id: 's1', show: 'Matinee', mon: 112, tue: 96, wed: 130, thu: 141, fri: 188 },
	{ id: 's2', show: 'Early evening', mon: 204, tue: 187, wed: 221, thu: 240, fri: 302 },
	{ id: 's3', show: 'Late evening', mon: 95, tue: 88, wed: 102, thu: 156, fri: 281 },
	{ id: 's4', show: 'Night', mon: 34, tue: 29, wed: 41, thu: 77, fri: 163 },
]
const day = (id: keyof Show, header: string): ColumnDef<Show> => ({ id, header, format: 'integer' })
const columns: ColumnDef<Show>[] = [
	{ id: 'show', header: 'Show' },
	day('mon', 'Mon'),
	day('tue', 'Tue'),
	day('wed', 'Wed'),
	day('thu', 'Thu'),
	day('fri', 'Fri'),
]
const controller = createTableController()
const range = shallowRef<CellRange | null>(null)
// A drag reports each step, and its end once.
const drags = shallowRef(0)

// The selected cells as a copy gives them: tabs between cells, line ends between rows.
const sum = computed(() => {
	if (!range.value) return undefined
	const cells = controller.copyCells().split(/[\t\n]/)
	const numbers = cells.map(Number).filter((value) => !Number.isNaN(value))
	return { cells: cells.length, total: numbers.reduce((total, value) => total + value, 0) }
})
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button
				@click="
					controller.selectCells({ rowId: 's2', columnId: 'wed' }, { rowId: 's3', columnId: 'fri' })
				"
			>
				Wed to Fri, evenings
			</Button>
			<Button :disabled="!range" @click="controller.clearCellSelection()">Clear</Button>
			<p class="demo-note end" role="status" data-testid="range-sum">
				<template v-if="sum">
					<strong>{{ sum.total }}</strong> seats in {{ sum.cells }} cells, {{ drags }} drags
				</template>
				<template v-else>No cell selected</template>
			</p>
		</div>
		<div class="sink-frame">
			<Table
				v-model:cell-range="range"
				:rows="shows"
				:columns="columns"
				:controller="controller"
				cell-selection
				aria-label="Seats sold by show and day"
				@cell-range-commit="drags++"
			/>
		</div>
	</div>
</template>
