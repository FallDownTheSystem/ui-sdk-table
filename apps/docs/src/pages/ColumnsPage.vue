<script setup lang="ts">
import {
	createTableController,
	Table,
	type ColumnDef,
	type ColumnPinning,
	type ColumnVisibility,
	type ColumnWidths,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { createPeople, type Person } from '../benchmark/data'

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true, width: 180, hideable: false },
	{
		id: 'work',
		header: 'Work',
		columns: [
			{ id: 'team', header: 'Team', sortable: true, width: 140 },
			{ id: 'country', header: 'Country', width: 140 },
		],
	},
	{
		id: 'numbers',
		header: 'Numbers',
		columns: [
			{
				id: 'score',
				header: 'Score',
				sortable: true,
				width: 100,
				minWidth: 60,
				maxWidth: 300,
				aggregate: 'mean',
				format: 'decimal',
			},
			{ id: 'joined', header: 'Joined', width: 140, format: 'date' },
		],
	},
]
const leaves = ['name', 'team', 'country', 'score', 'joined']

const rows = createPeople(40)
const controller = createTableController()
const visibility = shallowRef<ColumnVisibility>({})
const order = shallowRef<readonly string[]>([])
const widths = shallowRef<ColumnWidths>({})
const pinning = shallowRef<ColumnPinning>({})
const commits = shallowRef(0)
const rtl = shallowRef(false)
const narrow = shallowRef(true)

function isPinned(id: string, side: 'start' | 'end') {
	return pinning.value[side]?.includes(id) ?? false
}

function togglePin(id: string, side: 'start' | 'end') {
	controller.pinColumn(id, isPinned(id, side) ? null : side)
}
</script>

<template>
	<h1>Columns</h1>
	<p>
		Header groups, hidden columns, column order, column width and pinned columns. Drag a header to
		move its column, or press Space on it and use the arrow keys. Drag the edge of a header to
		resize, or press Alt with an arrow key on the header.
	</p>
	<div class="toolbar">
		<label v-for="id in leaves" :key="id">
			<input
				type="checkbox"
				:checked="visibility[id] !== false"
				:disabled="id === 'name'"
				@change="controller.toggleColumnVisibility(id)"
			/>
			Show {{ id }}
		</label>
		<label>
			<input
				type="checkbox"
				:checked="visibility.work !== false"
				@change="controller.toggleColumnVisibility('work')"
			/>
			Show the Work group
		</label>
	</div>
	<div class="toolbar">
		<button
			type="button"
			:aria-pressed="isPinned('name', 'start')"
			@click="togglePin('name', 'start')"
		>
			Pin name to the start
		</button>
		<button
			type="button"
			:aria-pressed="isPinned('team', 'start')"
			@click="togglePin('team', 'start')"
		>
			Pin team to the start
		</button>
		<button
			type="button"
			:aria-pressed="isPinned('joined', 'end')"
			@click="togglePin('joined', 'end')"
		>
			Pin joined to the end
		</button>
		<button type="button" @click="controller.resetColumnWidths()">Reset widths</button>
		<button type="button" @click="controller.moveColumn('joined', 0)">Move joined first</button>
		<label><input v-model="rtl" type="checkbox" /> Right to left</label>
		<label><input v-model="narrow" type="checkbox" /> Narrow frame</label>
	</div>
	<div class="toolbar">
		<output data-testid="order">{{ order.join(',') || 'definition order' }}</output>
		<output data-testid="widths">{{ JSON.stringify(widths) }}</output>
		<output data-testid="commits">{{ commits }} commits</output>
		<output data-testid="pinning">{{ JSON.stringify(pinning) }}</output>
	</div>
	<div class="scroller" :class="{ narrow }" :dir="rtl ? 'rtl' : 'ltr'" data-testid="scroller">
		<Table
			v-model:column-visibility="visibility"
			v-model:column-order="order"
			v-model:column-widths="widths"
			v-model:column-pinning="pinning"
			:rows="rows"
			:columns="columns"
			:controller="controller"
			resizable
			reorderable
			sticky-header
			aria-label="People"
			@column-widths-commit="commits++"
		>
			<template #col-name="{ text }">
				<button type="button" class="link">{{ text }}</button>
			</template>
		</Table>
	</div>
</template>
