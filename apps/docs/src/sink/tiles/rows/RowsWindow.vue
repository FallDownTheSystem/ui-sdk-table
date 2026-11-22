<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef } from 'ui-sdk-table-vue'
import { createPeople, type Person } from '../../data'

const people = createPeople(50_000)
const columns: ColumnDef<Person>[] = [
	{ id: 'row', header: 'Row', value: (row) => Number(row.id.slice(1)) + 1, format: 'integer' },
	{ id: 'name', header: 'Name' },
	{ id: 'team', header: 'Team' },
]
const controller = createTableController()
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="controller.scrollToRow('p39999', 'center')">Row 40,000</Button>
			<Button @click="controller.scrollToRow('p0', 'start')">First row</Button>
			<Button @click="controller.scrollToRow('p49999', 'end')">Last row</Button>
		</div>
		<div class="sink-frame scrolls">
			<Table
				:rows="people"
				:columns="columns"
				:controller="controller"
				:row-height="31"
				:overscan="6"
				row-window
				sticky-header
				aria-label="Fifty thousand people in a row window"
			/>
		</div>
	</div>
</template>
