<script setup lang="ts">
import {
	applyEdits,
	createTableController,
	rowNumberColumn,
	Table,
	useTableView,
	type CellEdit,
	type CellFormulas,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { createFormulaEngine } from 'ui-sdk-table-vue/formulas'
import { computed, shallowRef } from 'vue'
import SinkSegment from '../../parts/SinkSegment.vue'

type Row = { id: string; item: string; price: number; marked?: unknown }

const LOCALES = [
	{ value: 'en-US', label: 'English' },
	{ value: 'de-DE', label: 'Deutsch' },
] as const
type Locale = (typeof LOCALES)[number]['value']

const rows = shallowRef<Row[]>([
	{ id: 'a', item: 'Tea', price: 3.2, marked: 4.8 },
	{ id: 'c', item: 'Soup', price: 7.9, marked: 11.9 },
])
const columns: ColumnDef<Row>[] = [
	rowNumberColumn<Row>(),
	{ id: 'item', header: 'Item', editable: false },
	{ id: 'price', header: 'Cost', format: 'decimal' },
	{ id: 'marked', header: 'Price', format: 'decimal' },
]
// Stored with a point and commas, as in every language.
const START: CellFormulas = {
	cells: Object.fromEntries(['a', 'c'].map((id) => [id, { marked: '=ROUND([price]*1.5, 1)' }])),
}

const engine = createFormulaEngine()
const controller = createTableController()
const view = useTableView(controller)
const locale = shallowRef<Locale>('de-DE')
const formulas = shallowRef<CellFormulas>(START)
// The formula of C1 as a person of this language reads it, and what a sum gives. A new
// language is a change of the view, so both follow it.
const typed = computed(() =>
	view.value ? (controller.getCellFormula('a', 'marked')?.text ?? '') : '',
)
const sum = computed(() => {
	if (!view.value) return ''
	const value = controller.evaluateFormula('=SUM(C1:C2)', { rowId: 'a', columnId: 'item' })
	return typeof value === 'number' ? value.toLocaleString(locale.value) : String(value)
})
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<SinkSegment v-model="locale" label="Language of the sheet" :items="LOCALES" />
		</div>
		<p class="readout" role="status">
			<strong class="display formula-display" data-testid="locale-formula">{{ typed }}</strong>
			<span class="readout-label">In C1. =SUM(C1:C2) gives {{ sum }}</span>
		</p>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:controller="controller"
				:formulas="engine"
				v-model:cell-formulas="formulas"
				:locale="locale"
				editable
				column-letters
				aria-label="Prices with a formula in each language"
				@cell-edit="(edits: readonly CellEdit<Row>[]) => (rows = applyEdits(rows, edits))"
			/>
		</div>
	</div>
</template>
