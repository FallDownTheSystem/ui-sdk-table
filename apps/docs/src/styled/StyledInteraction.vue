<script setup lang="ts">
import { PlusIcon, RefreshCwIcon } from '@lucide/vue'
import { Button } from '@ui-sdk/vue/button'
import {
	buttonClass,
	createTableController,
	DataTable,
	DataTableSelect,
	type DataTableColumn,
} from 'ui-sdk-table-styled'
import { nextTick, shallowRef } from 'vue'
import { basicColumns, sortableColumns, taskColumns } from './columns'
import { people, seeded, tasks, type Person, type Task } from './data'
import DemoSection from './DemoSection.vue'

const selectedIds = shallowRef<string[]>([])
const notAdmin = (row: Person) => row.role !== 'Admin'

const groupedSelection = shallowRef<string[]>([])
const groupColumn = shallowRef('priority')
const groupColumns = [
	{ value: 'priority', label: 'Group by priority' },
	{ value: 'status', label: 'Group by status' },
]
const grouped = createTableController()
async function groupBy(columnId: string) {
	groupColumn.value = columnId
	// The new groups start closed. The selection stays as it is.
	await nextTick()
	grouped.expandAll()
}
const selectedTitles = () =>
	tasks.filter((task) => groupedSelection.value.includes(String(task.id))).map((task) => task.title)
const notDone = (row: Task) => row.status !== 'Done'

const visibilityColumns: DataTableColumn<Person>[] = [
	// The name stays: a table without it says nothing.
	{ id: 'name', header: 'Name', hideable: false },
	{ id: 'role', header: 'Role' },
	{ id: 'age', header: 'Age', format: 'integer' },
]

const controlsPeople = shallowRef<Person[]>(people.map((person) => ({ ...person })))
const random = seeded(99)
const NAMES = ['Ilmari Aalto', 'Kerttu Heikkinen', 'Onni Järvinen', 'Maija Laine', 'Väinö Berg']
function addRow() {
	const id = Math.max(0, ...controlsPeople.value.map((person) => person.id)) + 1
	// A new array: the table never looks into the array that it has.
	controlsPeople.value = [
		...controlsPeople.value,
		{
			id,
			name: NAMES[Math.floor(random() * NAMES.length)] ?? 'New person',
			role: 'Viewer',
			age: 21 + Math.floor(random() * 40),
			joined: new Date(),
		},
	]
}
function refreshRows() {
	controlsPeople.value = people.map((person) => ({ ...person }))
}
</script>

<template>
	<DemoSection id="selection" title="Selection">
		<template #description>
			A checkbox for each row and one for all rows. In the second table, the rows of an admin cannot
			be selected.
		</template>
		<DataTable
			v-model:selected="selectedIds"
			:rows="people"
			:columns="sortableColumns"
			selection="multiple"
			label="Selectable people"
		/>
		<output data-testid="selected" class="text-sm text-muted-foreground">
			Selected ids: {{ selectedIds.join(', ') || 'none' }}
		</output>
		<DataTable
			:rows="people"
			:columns="sortableColumns"
			selection="multiple"
			:can-select="notAdmin"
			label="People without admins"
		/>
	</DemoSection>

	<DemoSection id="selection-grouping" title="Selection and grouping">
		<template #description>
			A group row has a checkbox for its rows. The selection stays when the grouping changes. In the
			second table, a task that is done cannot be selected.
		</template>
		<DataTableSelect
			:items="groupColumns"
			:value="groupColumn"
			label="Group tasks by"
			@change="(value) => typeof value === 'string' && groupBy(value)"
		/>
		<DataTable
			v-model:selected="groupedSelection"
			:rows="tasks"
			:columns="taskColumns"
			:controller="grouped"
			:group-by="[groupColumn]"
			default-expanded="all"
			selection="multiple"
			label="Selectable tasks"
		/>
		<output data-testid="selected-tasks" class="text-sm text-muted-foreground">
			Selected tasks: {{ selectedTitles().join(', ') || 'none' }}
		</output>
		<DataTable
			:rows="tasks"
			:columns="taskColumns"
			:default-group-by="['status']"
			default-expanded="all"
			selection="multiple"
			:can-select="notDone"
			label="Tasks that are not done"
		/>
	</DemoSection>

	<DemoSection id="column-visibility" title="Column visibility">
		<template #description>A menu shows and hides columns. The age starts hidden.</template>
		<DataTable
			:rows="people"
			:columns="visibilityColumns"
			:default-column-visibility="{ age: false }"
			column-menu
			label="People with a column menu"
		/>
	</DemoSection>

	<DemoSection id="export" title="Export">
		<template #description>
			The menu writes a CSV or an Excel file named "people". The writers load on the first export.
		</template>
		<DataTable
			:rows="people"
			:columns="basicColumns"
			:export="{ filename: 'people' }"
			label="People to export"
		/>
	</DemoSection>

	<DemoSection id="custom-controls" title="Custom controls">
		<template #description>The toolbar slot holds the controls of the page.</template>
		<DataTable :rows="controlsPeople" :columns="basicColumns" label="People with controls">
			<template #toolbar>
				<Button :class="buttonClass('outline')" @click="addRow">
					<PlusIcon aria-hidden="true" />
					Add row
				</Button>
				<Button :class="buttonClass('outline')" @click="refreshRows">
					<RefreshCwIcon aria-hidden="true" />
					Refresh
				</Button>
			</template>
		</DataTable>
	</DemoSection>
</template>
