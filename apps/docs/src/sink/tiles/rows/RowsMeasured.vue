<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Note = { id: string; day: string; text: string }

const LINES = [
	'Called the supplier.',
	'They ship on Monday, and the invoice follows by mail.',
	'The second pallet was damaged in transit and goes back at their cost.',
	'Asked for a new delivery slot before the end of the month.',
]

// One to four sentences for each note, in a fixed pattern, so the heights differ and never change.
const notes: Note[] = Array.from({ length: 2000 }, (_, index) => ({
	id: `n${index + 1}`,
	day: `2026-${String(1 + (index % 12)).padStart(2, '0')}-${String(1 + ((index * 5) % 28)).padStart(2, '0')}`,
	text: LINES.slice(0, 1 + ((index * 7) % 4)).join(' '),
}))
const columns: ColumnDef<Note>[] = [
	{ id: 'id', header: 'Note', width: 64 },
	{ id: 'text', header: 'Text', width: 190 },
]
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="notes"
				:columns="columns"
				:estimated-row-height="56"
				row-window
				sticky-header
				aria-label="Two thousand notes of different heights"
			>
				<template #col-text="{ text }"><span class="wrap">{{ text }}</span></template>
			</Table>
		</div>
	</div>
</template>
