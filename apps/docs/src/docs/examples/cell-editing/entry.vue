<script setup lang="ts">
import {
	applyEdits,
	Table,
	useEditDraft,
	type CellAttrsContext,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Shift = { id: string; person: string; day: string; hours: number; note: string }

const columns: ColumnDef<Shift>[] = [
	{ id: 'person', header: 'Person', editable: false },
	{ id: 'day', header: 'Day' },
	{ id: 'hours', header: 'Hours', format: 'decimal', numberKeyboard: true },
	{ id: 'note', header: 'Note' },
]

// The rows are yours. The draft holds the edits until Save.
const rows = shallowRef<Shift[]>([
	{ id: 's1', person: 'Kofi', day: 'Monday', hours: 8, note: '' },
	{ id: 's2', person: 'Ines', day: 'Tuesday', hours: 6.5, note: 'Late start' },
	{ id: 's3', person: 'Tomas', day: 'Friday', hours: 4, note: '' },
])
const draft = useEditDraft(rows)
const editing = shallowRef(false)
const last = shallowRef('Nothing saved yet.')

function save() {
	const edits = draft.save()
	rows.value = applyEdits(rows.value, edits)
	last.value = `Saved ${edits.length} ${edits.length === 1 ? 'cell' : 'cells'}.`
	editing.value = false
}

function cancel() {
	draft.cancel()
	editing.value = false
}

// A cell whose value differs from your rows gets a mark of its own.
const cellAttrs = (context: CellAttrsContext<Shift>) =>
	context.kind === 'cell' && draft.changed(context.node.id, context.column.id)
		? { class: 'changed' }
		: undefined
</script>

<template>
	<div class="bar">
		<button v-if="!editing" type="button" @click="editing = true">Edit</button>
		<template v-else>
			<button type="button" @click="save">Save</button>
			<button type="button" @click="cancel">Cancel</button>
			<span>{{ draft.count.value }} changed</span>
		</template>
	</div>
	<Table
		:rows="draft.rows.value"
		:columns="columns"
		:entry="editing"
		:cell-attrs="cellAttrs"
		aria-label="Shifts"
		@cell-edit="draft.onCellEdit"
	/>
	<p role="status">{{ last }}</p>
</template>

<style scoped>
.bar {
	display: flex;
	gap: 8px;
	align-items: center;
	margin-block-end: 8px;
}

/* In the entry mode, the cells that take input show it. */
:deep([data-entry] td[data-editable]) {
	box-shadow: inset 0 -1px 0 #94a3b8;
	cursor: text;
}

:deep(td.changed) {
	background: #fef9c3;
}
</style>
