<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Score = { id: string; player: string; score: number; level: number }

const scores: Score[] = [
	{ id: 's1', player: 'AAA', score: 98760, level: 12 },
	{ id: 's2', player: 'ZED', score: 87120, level: 11 },
	{ id: 's3', player: 'KIM', score: 76540, level: 9 },
	{ id: 's4', player: 'BOB', score: 51200, level: 7 },
	{ id: 's5', player: 'JOY', score: 40050, level: 6 },
]
const columns: ColumnDef<Score>[] = [
	{ id: 'player', header: 'Name', sortable: true },
	{ id: 'level', header: 'Lv', sortable: true, format: 'integer' },
	{ id: 'score', header: 'Score', sortable: true, format: 'integer' },
]
</script>

<template>
	<div class="demo look-pixel">
		<div class="sink-frame">
			<Table
				:rows="scores"
				:columns="columns"
				:default-sort="[{ id: 'score', desc: true }]"
				aria-label="High scores of an arcade game"
			/>
		</div>
	</div>
</template>
