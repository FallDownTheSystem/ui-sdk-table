<script setup lang="ts">
import {
	Table,
	type CellAttrsContext,
	type ColumnDef,
	type RowAttrsContext,
} from 'ui-sdk-table-vue'

type Invoice = { id: string; customer: string; days: number; balance: number }

const invoices: Invoice[] = [
	{ id: 'i1', customer: 'Aalto Works', days: 4, balance: 1200 },
	{ id: 'i2', customer: 'Birch & Co', days: 41, balance: 853.5 },
	{ id: 'i3', customer: 'Cobalt Lab', days: 12, balance: -150 },
	{ id: 'i4', customer: 'Dune Supply', days: 67, balance: 420.5 },
	{ id: 'i6', customer: 'Fjord Tools', days: 33, balance: -75.25 },
]
const columns: ColumnDef<Invoice>[] = [
	{ id: 'customer', header: 'Customer' },
	{ id: 'days', header: 'Days open', format: 'integer' },
	// `meta` is a place for words of your own. The table carries it and never reads it.
	{ id: 'balance', header: 'Balance', format: 'decimal', meta: { marksCredit: true } },
]
const marksCredit = (meta: unknown) =>
	typeof meta === 'object' && meta !== null && 'marksCredit' in meta

// The same function for every render: a new one would render every row again.
const rowAttrs = (context: RowAttrsContext<Invoice>) =>
	context.kind === 'row' && context.row.days > 30 ? { class: 'is-late' } : undefined

const cellAttrs = (context: CellAttrsContext<Invoice>) =>
	context.kind === 'cell' && marksCredit(context.column.meta) && Number(context.value) < 0
		? { class: 'is-credit', title: 'A credit: we owe this customer.' }
		: undefined
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="invoices"
				:columns="columns"
				:row-attrs="rowAttrs"
				:cell-attrs="cellAttrs"
				:section-attrs="{ body: { class: 'invoices' } }"
				aria-label="Invoices, with the late ones and the credits marked"
			>
				<template #col-days="{ text, row }">
					{{ text }} <span v-if="row.days > 30" class="cell-flag cell-tag">late</span>
				</template>
			</Table>
		</div>
	</div>
</template>
