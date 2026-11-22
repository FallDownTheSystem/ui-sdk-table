<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { Input } from '@ui-sdk/vue/input'
import {
	createTableController,
	Table,
	useTableView,
	type CellFormulas,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { createFormulaEngine } from 'ui-sdk-table-vue/formulas'
import { computed, shallowRef } from 'vue'

type Room = { id: string; room: string; width: number; length: number }

const rooms: Room[] = [
	{ id: 'r1', room: 'Kitchen', width: 3.2, length: 4.1 },
	{ id: 'r2', room: 'Bedroom', width: 3.6, length: 4.4 },
	{ id: 'r3', room: 'Study', width: 2.4, length: 3 },
	{ id: 'r4', room: 'Hall', width: 1.4, length: 5.2 },
]
const columns: ColumnDef<Room>[] = [
	{ id: 'room', header: 'Room', editable: false },
	{ id: 'width', header: 'Width', format: 'decimal', editable: false },
	{ id: 'length', header: 'Length', format: 'decimal', editable: false },
	// A plain column of the page: the formula of the table gives it its values, and a cell opens with it.
	{ id: 'area', header: 'Area', format: 'decimal', editable: true },
]

const engine = createFormulaEngine()
const controller = createTableController()
const view = useTableView(controller)
const formulas = shallowRef<CellFormulas>({ columns: { area: '=[Width]*[Length]' } })

const now = computed(() => (view.value ? controller.getColumnFormula('area') : null))
const draft = shallowRef('=[Width]*[Length]')
const issue = shallowRef('')
// Formulas to try, each with the help line of its function from the table.
const EXAMPLES = [
	{ name: 'ROUND', formula: '=ROUND([Width]*[Length], 0)' },
	{ name: 'IF', formula: '=IF([Width]<2, 0, [Width]*[Length])' },
	{ name: 'MAX', formula: '=MAX([Width], [Length])' },
	{ name: 'Broken', formula: '=[Width]*' },
]
const helpOf = (name: string) =>
	view.value ? controller.getFormulaFunctions().find((fn) => fn.name === name)?.help : undefined

function save() {
	try {
		controller.setColumnFormula('area', draft.value.trim() === '' ? null : draft.value)
		issue.value = ''
	} catch (error) {
		// A refusal carries the words for a person as its cause.
		issue.value =
			error instanceof Error && typeof error.cause === 'string' ? error.cause : String(error)
	}
}
function undo() {
	controller.undo()
	draft.value = controller.getColumnFormula('area')?.text ?? ''
	issue.value = ''
}
</script>

<template>
	<div class="demo">
		<form class="demo-bar" @submit.prevent="save">
			<Input
				aria-label="Formula of the area"
				:value="draft"
				:aria-invalid="!!issue"
				@value-change="(text: string) => (draft = text)"
			/>
			<Button class="primary" type="submit">Set</Button>
			<Button type="button" @click="undo">Undo</Button>
		</form>
		<div class="demo-bar">
			<Button
				v-for="example in EXAMPLES"
				:key="example.name"
				type="button"
				:title="helpOf(example.name) ?? 'A formula that cannot be read'"
				@click="((draft = example.formula), save())"
				>{{ example.name }}</Button
			>
			<p class="demo-note formula-issue" role="status" :title="issue">
				{{ issue || `Area is ${now?.text ?? 'a plain column'}` }}
			</p>
		</div>
		<div class="sink-frame">
			<Table
				v-model:cell-formulas="formulas"
				:rows="rooms"
				:columns="columns"
				:controller="controller"
				:formulas="engine"
				locale="en-US"
				sheet
				aria-label="Rooms, with an area from a formula of the column"
			/>
		</div>
	</div>
</template>
