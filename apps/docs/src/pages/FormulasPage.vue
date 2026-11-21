<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import {
	describeFormulaIssue,
	formulaColumn,
	parseFormula,
	printFormula,
} from 'ui-sdk-table-vue/formulas'
import { computed, shallowRef } from 'vue'

// Orders, and columns whose values are formulas of their own row. The page
// is the place of the browser tests of the formulas (`e2e/formulas.spec.ts`).
// `?locale=fi-FI` types and shows the formulas with a decimal comma.

type Order = { id: string; product: string; qty: number; price: number }

const query = new URLSearchParams(location.search)
const locale = query.get('locale') ?? 'en-US'

const PRODUCTS = ['Bolt', 'Nut', 'Washer', 'Screw', 'Hinge', 'Bracket']

function createOrders(count: number): Order[] {
	let state = 7
	const random = () => {
		state = (state * 1664525 + 1013904223) % 4294967296
		return state / 4294967296
	}
	return Array.from({ length: count }, (_, index) => ({
		id: `o${index + 1}`,
		product: PRODUCTS[Math.floor(random() * PRODUCTS.length)] ?? 'Bolt',
		qty: 1 + Math.floor(random() * 40),
		price: Math.round(random() * 6000) / 100,
	}))
}

const rows = createOrders(48)

const base: ColumnDef<Order>[] = [
	{ id: 'product', header: 'Product', sortable: true, width: 140 },
	{ id: 'qty', header: 'Quantity', sortable: true, format: 'integer', width: 110 },
	{ id: 'price', header: 'Price', sortable: true, format: 'decimal', width: 110 },
]

const stored = shallowRef('=[price]*[qty]')
const draft = shallowRef(printFormula(stored.value, { columns: base, locale }))
const issue = shallowRef('')

const total = computed(() =>
	formulaColumn(
		{
			id: 'total',
			header: 'Total',
			formula: stored.value,
			sortable: true,
			aggregate: 'sum',
			filter: 'range',
			format: 'decimal',
			formatOptions: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
			width: 120,
		},
		base,
	),
)

const band = computed(() =>
	formulaColumn(
		{
			id: 'band',
			header: 'Band',
			formula: '=IFS([total]<100, "small", [total]<1000, "medium", TRUE, "large")',
			groupable: true,
			width: 110,
		},
		[...base, total.value],
	),
)

const columns = computed(() => [...base, total.value, band.value])

function save() {
	const parsed = parseFormula(draft.value, { columns: base, locale, self: 'total' })
	if ('issues' in parsed) {
		issue.value = parsed.issues.map((found) => describeFormulaIssue(found)).join(' ')
		return
	}
	issue.value = ''
	stored.value = parsed.formula
	draft.value = printFormula(parsed.formula, { columns: base, locale })
}

const grouping = shallowRef<'none' | 'band'>('none')
const groupBy = computed(() => (grouping.value === 'band' ? ['band'] : []))
const filter = shallowRef<{ columns?: Record<string, unknown> }>({})
const range = shallowRef<{ min: string; max: string }>({ min: '', max: '' })

function filterTotal() {
	const read = (text: string) => (text === '' ? null : Number(text))
	filter.value = { columns: { total: { min: read(range.value.min), max: read(range.value.max) } } }
}
</script>

<template>
	<h1>Formulas</h1>
	<p>
		The total and the band are columns whose values are formulas of their own row. They sort,
		filter, group and add up as any column does.
	</p>
	<form class="toolbar" @submit.prevent="save">
		<label>
			Formula of the total
			<input v-model="draft" data-testid="formula" spellcheck="false" :aria-invalid="!!issue" />
		</label>
		<button type="submit">Use the formula</button>
		<output data-testid="stored">{{ stored }}</output>
		<output role="alert" data-testid="issue">{{ issue }}</output>
	</form>
	<div class="toolbar">
		<label>
			Groups
			<select v-model="grouping" data-testid="grouping">
				<option value="none">No groups</option>
				<option value="band">By band</option>
			</select>
		</label>
		<label>
			Total from
			<input v-model="range.min" type="number" data-testid="total-min" @change="filterTotal" />
		</label>
		<label>
			to
			<input v-model="range.max" type="number" data-testid="total-max" @change="filterTotal" />
		</label>
	</div>
	<div class="scroller">
		<Table
			v-model:filter="filter"
			:rows="rows"
			:columns="columns"
			:group-by="groupBy"
			:locale="locale"
			sticky-header
			sticky-footer
			aria-label="Orders"
		>
			<template #group="{ group, path, expanded: open, toggleExpanded }">
				<button type="button" :aria-expanded="open" @click="toggleExpanded($event)">
					{{ path.map((entry) => entry.text).join(' / ') }} ({{ group.leaves.length }})
				</button>
			</template>
		</Table>
	</div>
</template>
