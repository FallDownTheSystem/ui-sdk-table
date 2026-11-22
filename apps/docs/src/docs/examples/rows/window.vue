<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef } from 'ui-sdk-table-vue'

type Reading = { id: string; number: number; sensor: string; value: number }

const SENSORS = ['North', 'East', 'South', 'West']
const readings: Reading[] = Array.from({ length: 10_000 }, (_, index) => ({
	id: `r${index + 1}`,
	number: index + 1,
	sensor: SENSORS[index % SENSORS.length] ?? '',
	value: (index * 7919) % 1000,
}))

const columns: ColumnDef<Reading>[] = [
	{ id: 'number', header: 'Row', format: 'integer' },
	{ id: 'sensor', header: 'Sensor' },
	{ id: 'value', header: 'Value', format: 'integer' },
]

const controller = createTableController()
</script>

<template>
	<div>
		<Button @click="controller.scrollToRow('r5000', 'center')">Row 5,000</Button>
		<Button @click="controller.scrollToRow('r1', 'start')">First row</Button>
	</div>
	<!-- The frame scrolls. The table renders the rows near it, and a spacer for the rest. -->
	<div class="frame">
		<Table
			:rows="readings"
			:columns="columns"
			:controller="controller"
			:row-height="35"
			row-window
			sticky-header
			aria-label="Ten thousand readings"
		/>
	</div>
</template>

<style scoped>
.frame {
	block-size: 280px;
	overflow: auto;
}

.frame :deep(tr[data-sticky] > *) {
	background: #fff;
}

.frame :deep([data-slot='table-row']) {
	block-size: var(--table-row-height);
}
</style>
