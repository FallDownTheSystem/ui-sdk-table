<script setup lang="ts">
import { Switch, SwitchThumb } from '@ui-sdk/vue/switch'
import {
	applyEdits,
	createTableController,
	Table,
	type CellEdit,
	type CellRange,
	type ColumnDef,
	type StandardSchemaV1,
	type TableEditDetails,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Person = {
	id: string
	name: string
	team: string
	score: number
	joined: string
	active: boolean
}

const TEAMS = ['Billing', 'Design', 'Growth', 'Platform', 'Support']

// A schema of the Standard Schema kind, written by hand. A schema of Zod,
// Valibot or ArkType has the same shape and goes in the same place.
function schema(check: (value: unknown) => string | undefined): StandardSchemaV1 {
	return {
		'~standard': {
			version: 1,
			vendor: 'demo',
			validate: (value) => {
				const message = check(value)
				return message === undefined ? { value } : { issues: [{ message }] }
			},
		},
	}
}

// A check that only a server can do, such as "is this name free". A schema
// can answer with a promise, and the editor waits for it.
const slow = shallowRef(false)
const SLOW_MS = 600
const nameSchema: StandardSchemaV1 = {
	'~standard': {
		version: 1,
		vendor: 'demo',
		validate: (value) => {
			const text = typeof value === 'string' ? value.trim() : ''
			if (text.length < 2) return { issues: [{ message: 'A name has 2 characters or more.' }] }
			if (!slow.value) return { value }
			return new Promise((resolve) =>
				setTimeout(
					() =>
						resolve(
							rows.value.some((row) => row.name === text)
								? { issues: [{ message: `Another person has the name ${text}.` }] }
								: { value },
						),
					SLOW_MS,
				),
			)
		},
	},
}

const columns: ColumnDef<Person>[] = [
	{ id: 'id', header: 'Id', width: 70, editable: false },
	{ id: 'name', header: 'Name', width: 200, sortable: true, schema: nameSchema },
	{
		id: 'team',
		header: 'Team',
		width: 150,
		schema: schema((value) =>
			TEAMS.includes(String(value)) ? undefined : `The team must be one of: ${TEAMS.join(', ')}.`,
		),
	},
	{
		id: 'score',
		header: 'Score',
		width: 110,
		sortable: true,
		format: 'integer',
		aggregate: 'sum',
		schema: schema((value) =>
			typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
				? undefined
				: 'The score must be a whole number from 0 to 100.',
		),
	},
	{
		id: 'joined',
		header: 'Joined',
		width: 140,
		format: 'date',
		schema: schema((value) =>
			typeof value === 'string' &&
			/^\d{4}-\d{2}-\d{2}$/.test(value) &&
			!Number.isNaN(Date.parse(value))
				? undefined
				: 'The date must be written as year-month-day, such as 2026-03-09.',
		),
	},
	{ id: 'active', header: 'Active', width: 90, editable: false },
]

const NAMES = [
	'Ada Adams',
	'Ben Brooks',
	'Cleo Carter',
	'Dan Drake',
	'Eve Ellis',
	'Finn Fisher',
	'Gus Grant',
	'Ivy Hayes',
	'Jack Adams',
	'Lily Ellis',
]

const controller = createTableController()
const rows = shallowRef<Person[]>(
	NAMES.map((name, index) => ({
		id: `e${index + 1}`,
		name,
		team: TEAMS[index % TEAMS.length] ?? 'Design',
		score: (index * 17 + 20) % 101,
		joined: `20${String(15 + index).padStart(2, '0')}-0${(index % 9) + 1}-1${index % 10}`,
		active: index % 3 !== 0,
	})),
)
const range = shallowRef<CellRange | null>(null)
const log = shallowRef<string[]>([])
const commits = shallowRef(0)
const locked = shallowRef(false)
const selectable = shallowRef(false)

function onCellEdit(edits: readonly CellEdit<Person>[], details: TableEditDetails) {
	if (locked.value) {
		details.cancel()
		return
	}
	rows.value = applyEdits(rows.value, edits)
	const cells = edits.map((edit) => `${edit.rowId}.${edit.columnId}=${JSON.stringify(edit.value)}`)
	log.value = [`${details.reason}: ${cells.join(' ')}`, ...log.value].slice(0, 5)
}

function setActive(id: string, active: boolean) {
	rows.value = rows.value.map((row) => (row.id === id ? { ...row, active } : row))
}

/** Gives focus to the list of teams when the table shows it. */
const focusOnMount = (el: unknown) => {
	if (el instanceof HTMLElement) queueMicrotask(() => el.focus())
}
</script>

<template>
	<h1>Editing</h1>
	<p>
		Press Enter or F2 on a cell, type a character, or press a cell twice. Enter and Tab save, Escape
		puts the value back. Shift with an arrow key, or a drag, selects cells. Ctrl+C copies them and
		Ctrl+V pastes.
	</p>
	<div class="toolbar">
		<label><input v-model="selectable" type="checkbox" /> Row selection</label>
		<label><input v-model="locked" type="checkbox" /> Refuse every edit</label>
		<label><input v-model="slow" type="checkbox" /> Check names on a slow server</label>
		<button type="button" @click="controller.editCell('e2', 'score', 99)">
			Give row e2 the score 99
		</button>
		<button
			type="button"
			@click="
				controller.selectCells(
					{ rowId: 'e1', columnId: 'name' },
					{ rowId: 'e3', columnId: 'score' },
				)
			"
		>
			Select 3 by 3 cells
		</button>
		<button type="button" @click="controller.clearCellSelection()">Clear the cells</button>
	</div>
	<div class="toolbar">
		<span>
			Range: <output data-testid="range">{{ range ? JSON.stringify(range) : 'none' }}</output>
		</span>
		<span> Drags: <output data-testid="commits">{{ commits }}</output> </span>
	</div>
	<div class="scroller">
		<Table
			v-model:cell-range="range"
			:rows="rows"
			:columns="columns"
			:controller="controller"
			:selection="selectable ? 'multiple' : undefined"
			editable
			cell-selection
			aria-label="People"
			@cell-edit="onCellEdit"
			@cell-range-commit="commits++"
		>
			<template #col-active="{ row }">
				<Switch
					:checked="row.active"
					:aria-label="`${row.name} is active`"
					@checked-change="(checked: boolean) => setActive(row.id, checked)"
				>
					<SwitchThumb />
				</Switch>
			</template>
			<template #edit-team="{ value, error, save, cancel }">
				<select
					:ref="focusOnMount"
					class="cell-editor"
					aria-label="Edit Team"
					:aria-invalid="error ? 'true' : undefined"
					:value="value"
					@change="save(($event.target as HTMLSelectElement).value, $event)"
					@keydown.escape.stop.prevent="cancel()"
					@keydown.stop
				>
					<option v-for="team in TEAMS" :key="team" :value="team">{{ team }}</option>
					<option value="Nowhere">Nowhere</option>
				</select>
				<span v-if="error" class="cell-error">{{ error }}</span>
			</template>
		</Table>
	</div>
	<h2>Last edits</h2>
	<button type="button" @click="log = []">Clear the list</button>
	<ol data-testid="log">
		<li v-for="(line, index) in log" :key="index">{{ line }}</li>
	</ol>
</template>
