<script setup lang="ts">
import {
	createTableController,
	rowNumberColumn,
	Table,
	type CellEdit,
	type CellFormulas,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import {
	createFormulaEngine,
	describeFormulaIssue,
	formulaColumn,
	parseFormula,
	printFormula,
	useFormulaBar,
} from 'ui-sdk-table-vue/formulas'
import { computed, shallowRef } from 'vue'

// Orders, and columns whose values are formulas of their own row. The page
// is the place of the browser tests of the formulas (`e2e/formulas.spec.ts`).
// `?locale=fi-FI` types and shows the formulas with a decimal comma. The
// moments of the orders are read on the clock of Helsinki, the zone of their
// column, whatever the zone of the computer.

type Order = { id: string; product: string; created: Date; qty: number; price: number }

const query = new URLSearchParams(location.search)
const locale = query.get('locale') ?? 'en-US'

const PRODUCTS = ['Bolt', 'Nut', 'Washer', 'Screw', 'Hinge', 'Bracket']

function createOrders(count: number): Order[] {
	let state = 7
	const random = () => {
		state = (state * 1664525 + 1013904223) % 4294967296
		return state / 4294967296
	}
	const start = Date.UTC(2025, 11, 1)
	const span = Date.UTC(2027, 0, 1) - start
	return Array.from({ length: count }, (_, index) => ({
		id: `o${index + 1}`,
		product: PRODUCTS[Math.floor(random() * PRODUCTS.length)] ?? 'Bolt',
		// The first order is at 00:30 on the first of December in Helsinki: still November in UTC.
		created: new Date(
			index === 0 ? Date.UTC(2026, 10, 30, 22, 30) : start + Math.floor(random() * span),
		),
		qty: 1 + Math.floor(random() * 40),
		price: Math.round(random() * 6000) / 100,
	}))
}

const rows = createOrders(48)

const base: ColumnDef<Order>[] = [
	{ id: 'product', header: 'Product', sortable: true, width: 140 },
	{
		id: 'created',
		header: 'Created',
		sortable: true,
		format: 'datetime',
		formatOptions: { timeZone: 'Europe/Helsinki' },
		width: 200,
	},
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

// The formulas of the period column. Each gives a period, so the column gets the format `period`.
const PERIODS = [
	'=WEEKOF([created])',
	'=WEEKOF([created], 2)',
	'=MONTHOF([created])',
	'=QUARTEROF([created])',
	'=YEAROF([created])',
	'=DAYOF([created])',
	'=HOUROF([created])',
	'=WEEKDAY([created], 2)',
]
const periodFormula = shallowRef(PERIODS[1] ?? '')
const periodColumn = computed(() =>
	formulaColumn(
		{
			id: 'period',
			header: 'Period',
			formula: periodFormula.value,
			sortable: true,
			groupable: true,
			width: 220,
		},
		base,
	),
)

// A column whose formula the table holds at run time, in `cellFormulas`.
const engine = createFormulaEngine()
const controller = createTableController()
const cellFormulas = shallowRef<CellFormulas>({ columns: { custom: '=[qty]*2' } })
const customDraft = shallowRef('=[qty]*2')
const customIssue = shallowRef('')
const custom: ColumnDef<Order> = {
	id: 'custom',
	header: 'Custom',
	sortable: true,
	groupable: true,
	width: 140,
}

function saveCustom() {
	try {
		controller.setColumnFormula('custom', customDraft.value === '' ? null : customDraft.value)
		customIssue.value = ''
	} catch (error) {
		customIssue.value = error instanceof Error ? error.message : String(error)
	}
}

const numbers = rowNumberColumn<Order>()
const columns = computed(() => [
	numbers,
	...base,
	total.value,
	band.value,
	periodColumn.value,
	custom,
])

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

// A small sheet whose cells can hold formulas of their own: `=B1*C1` in the
// total of the first line. The owner holds the lines and the formulas.
type Line = { id: string; item: string; price: number; qty: number; total?: unknown }
const lines = shallowRef<Line[]>([
	{ id: 'l1', item: 'Bolt', price: 2.5, qty: 40 },
	{ id: 'l2', item: 'Nut', price: 0.5, qty: 90 },
	{ id: 'l3', item: 'Washer', price: 0.2, qty: 15 },
	{ id: 'l4', item: 'Screw', price: 1.5, qty: 60 },
])
const lineFormulas = shallowRef<CellFormulas>({})
const lineColumns: ColumnDef<Line>[] = [
	rowNumberColumn<Line>(),
	{ id: 'item', header: 'Item', width: 120 },
	{ id: 'price', header: 'Price', format: 'decimal', sortable: true, width: 110 },
	{ id: 'qty', header: 'Quantity', format: 'integer', width: 110 },
	{
		id: 'total',
		header: 'Total',
		format: 'decimal',
		formatOptions: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
		width: 120,
	},
]
// The formula bar of the sheet: a field above it for the active cell.
const lineController = createTableController()
const bar = useFormulaBar(lineController)
const linesTable = shallowRef<HTMLElement | null>(null)
function backToCell() {
	linesTable.value?.querySelector<HTMLElement>('[data-active]')?.focus()
}
function commitBar() {
	if (bar.commit()) backToCell()
}
function cancelBar() {
	bar.cancel()
	backToCell()
}

function editLines(edits: readonly CellEdit<Line>[]) {
	lines.value = lines.value.map((line) => {
		const mine = edits.filter((edit) => edit.rowId === line.id)
		if (!mine.length) return line
		const next: Line = { ...line }
		for (const edit of mine) Object.assign(next, { [edit.columnId]: edit.value })
		return next
	})
}

const grouping = shallowRef<'none' | 'band' | 'period' | 'custom'>('none')
const groupBy = computed(() => (grouping.value === 'none' ? [] : [grouping.value]))
const filter = shallowRef<{ columns?: Record<string, unknown> }>({})
const range = shallowRef<{ min: string; max: string }>({ min: '', max: '' })

const days = shallowRef<{ from: string; to: string }>({ from: '', to: '' })

function filterTotal() {
	const read = (text: string) => (text === '' ? null : Number(text))
	filter.value = {
		columns: {
			...filter.value.columns,
			total: { min: read(range.value.min), max: read(range.value.max) },
		},
	}
}

function filterPeriod() {
	const read = (text: string) => (text === '' ? null : text)
	filter.value = {
		columns: {
			...filter.value.columns,
			period: { from: read(days.value.from), to: read(days.value.to) },
		},
	}
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
	<form class="toolbar" @submit.prevent="saveCustom">
		<label>
			Formula of the custom column
			<input
				v-model="customDraft"
				data-testid="custom-formula"
				spellcheck="false"
				:aria-invalid="!!customIssue"
			/>
		</label>
		<button type="submit">Set the formula</button>
		<output data-testid="custom-stored">{{ cellFormulas.columns?.custom ?? '' }}</output>
		<output role="status" data-testid="custom-issue">{{ customIssue }}</output>
	</form>
	<div class="toolbar">
		<label>
			Groups
			<select v-model="grouping" data-testid="grouping">
				<option value="none">No groups</option>
				<option value="band">By band</option>
				<option value="period">By period</option>
				<option value="custom">By the custom column</option>
			</select>
		</label>
		<label>
			Period
			<select v-model="periodFormula" data-testid="period">
				<option v-for="formula in PERIODS" :key="formula" :value="formula">{{ formula }}</option>
			</select>
		</label>
		<label>
			Period from
			<input v-model="days.from" type="date" data-testid="period-from" @change="filterPeriod" />
		</label>
		<label>
			to
			<input v-model="days.to" type="date" data-testid="period-to" @change="filterPeriod" />
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
	<div class="toolbar">
		<button type="button" data-testid="hide-qty" @click="controller.toggleColumnVisibility('qty')">
			Hide or show the quantity
		</button>
		<button type="button" data-testid="move-total" @click="controller.moveColumn('total', 1)">
			Move the total after the product
		</button>
	</div>
	<div class="scroller">
		<Table
			v-model:filter="filter"
			v-model:cell-formulas="cellFormulas"
			:controller="controller"
			:formulas="engine"
			history
			column-letters
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
	<h2>Formulas of cells</h2>
	<p>Type <code>=B1*C1</code> into a total. A cell that a formula reads changes its total.</p>
	<div class="toolbar">
		<button
			type="button"
			data-testid="new-prices"
			@click="lines = lines.map((line) => ({ ...line, price: line.price * 2 }))"
		>
			Load new prices
		</button>
		<button
			type="button"
			data-testid="remove-third"
			@click="lines = lines.filter((line) => line.id !== 'l3')"
		>
			Remove the washer
		</button>
	</div>
	<output data-testid="line-formulas">{{ JSON.stringify(lineFormulas) }}</output>
	<form class="toolbar" @submit.prevent="commitBar">
		<output data-testid="bar-address">{{ bar.address.value }}</output>
		<label>
			Formula bar
			<input
				data-testid="bar"
				spellcheck="false"
				:value="bar.text.value"
				:disabled="!bar.ready.value"
				:aria-invalid="!!bar.error.value"
				@input="bar.input(($event.target as HTMLInputElement).value)"
				@keydown.escape.prevent="cancelBar"
			/>
		</label>
		<output role="status" data-testid="bar-error">{{ bar.error.value }}</output>
	</form>
	<div ref="linesTable" class="scroller">
		<Table
			v-model:cell-formulas="lineFormulas"
			:controller="lineController"
			:formulas="engine"
			sheet
			column-letters
			:rows="lines"
			:columns="lineColumns"
			:locale="locale"
			aria-label="Lines"
			@cell-edit="editLines"
		/>
	</div>
</template>
