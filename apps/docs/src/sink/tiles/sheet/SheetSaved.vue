<script setup lang="ts">
import { Table, type CellFormats, type ColumnDef } from 'ui-sdk-table-vue'

type Party = { id: string; party: string; seats: number; share: number }

const parties: Party[] = [
	{ id: 'a', party: 'Harbour List', seats: 31, share: 0.342 },
	{ id: 'b', party: 'Green Hill', seats: 24, share: 0.268 },
	{ id: 'c', party: 'Old Town', seats: 19, share: 0.211 },
	{ id: 'd', party: 'Riverside', seats: 12, share: 0.136 },
	{ id: 'e', party: 'Free Voters', seats: 4, share: 0.043 },
]
const columns: ColumnDef<Party>[] = [
	{ id: 'party', header: 'List' },
	{ id: 'seats', header: 'Seats', format: 'integer' },
	{ id: 'share', header: 'Share', format: 'decimal' },
]
// Two layers: a format for every cell of a column, and formats of single cells by row id.
const SAVED: CellFormats = {
	columns: { share: { format: 'percentage', decimals: 1 } },
	cells: {
		a: { party: { bold: true }, seats: { bold: true, fill: 'accent' } },
		e: { share: { color: 'alert', italic: true } },
	},
}
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="parties"
				:columns="columns"
				:default-cell-formats="SAVED"
				:format-colors="['accent', 'alert']"
				aria-label="Seats of a council, with the formats of a saved document"
			/>
		</div>
		<p class="demo-note">The share is 0.342 in the row and 34.2% on the screen.</p>
	</div>
</template>
