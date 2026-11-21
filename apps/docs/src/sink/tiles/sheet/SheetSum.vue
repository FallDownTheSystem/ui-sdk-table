<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, useSelectionSummary, type ColumnDef } from 'ui-sdk-table-vue'

type Run = { id: string; day: string; km: number; minutes: number | null }

const runs: Run[] = [
	{ id: 'r1', day: 'Mon 2', km: 5.2, minutes: 29 },
	{ id: 'r2', day: 'Tue 3', km: 6, minutes: 34 },
	{ id: 'r3', day: 'Wed 4', km: 8, minutes: 47 },
	{ id: 'r4', day: 'Fri 6', km: 4.1, minutes: null },
	{ id: 'r5', day: 'Sat 7', km: 10.2, minutes: 61 },
	{ id: 'r6', day: 'Sun 8', km: 12.5, minutes: 76 },
	{ id: 'r7', day: 'Mon 9', km: 5.5, minutes: 31 },
	{ id: 'r8', day: 'Tue 10', km: 6.3, minutes: 36 },
	{ id: 'r9', day: 'Wed 11', km: 7.4, minutes: 43 },
	{ id: 'r10', day: 'Fri 13', km: 4.8, minutes: 27 },
	{ id: 'r11', day: 'Sat 14', km: 9.6, minutes: null },
	{ id: 'r12', day: 'Sun 15', km: 14, minutes: 84 },
	{ id: 'r13', day: 'Mon 16', km: 5, minutes: 28 },
]
const columns: ColumnDef<Run>[] = [
	{ id: 'day', header: 'Day' },
	{ id: 'km', header: 'Distance', format: 'decimal' },
	{ id: 'minutes', header: 'Minutes', format: 'integer' },
]
const controller = createTableController()
// Counted after the selection rests, so a drag over many rows counts once.
const summary = useSelectionSummary(controller)
</script>

<template>
	<div class="demo">
		<!-- The sum is the picture of this tile: a large number, its name above, what else it counts below. -->
		<div class="readout" data-testid="sum-bar">
			<template v-if="summary && summary.numbers > 1">
				<span class="readout-label">Sum</span> <strong class="display">{{
					summary.texts.sum
				}}</strong>
				<span class="readout-label">
					mean {{ summary.texts.mean }} · {{ summary.count }} of {{ summary.cells }} filled
				</span>
			</template>
			<template v-else-if="summary">
				<span class="readout-label">Selected</span>
				<strong class="display">{{ summary.count }} of {{ summary.cells }}</strong>
				<span class="readout-label">filled</span>
			</template>
			<template v-else>
				<span class="readout-label">Sum</span> <strong class="display">–</strong>
				<span class="readout-label">No cell selected</span>
			</template>
		</div>
		<div class="demo-bar">
			<Button @click="controller.selectCellColumns('km')">Distance</Button>
			<Button @click="controller.selectAllCells()">All cells</Button>
		</div>
		<div class="sink-frame">
			<Table
				:rows="runs"
				:columns="columns"
				:controller="controller"
				cell-selection
				aria-label="Runs of two weeks, with a sum of the selected cells"
			/>
		</div>
	</div>
</template>
