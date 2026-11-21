<script setup lang="ts">
import { Table, type ColumnDef, type TableMessages } from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { euro } from '../../data'
import SinkSegment from '../../parts/SinkSegment.vue'

type Status = 'paid' | 'open'
type Invoice = { id: string; customer: string; status: Status; due: string; total: number }

const invoices: Invoice[] = [
	{ id: 'i1', customer: 'Acme', status: 'paid', due: '2026-03-04', total: 1240.5 },
	{ id: 'i2', customer: 'Bolt', status: 'open', due: '2026-03-07', total: 385 },
	{ id: 'i3', customer: 'Cedar', status: 'paid', due: '2026-03-10', total: 2210.75 },
	{ id: 'i4', customer: 'Delta', status: 'open', due: '2026-03-13', total: 96.4 },
	{ id: 'i5', customer: 'Ember', status: 'paid', due: '2026-03-16', total: 4580 },
	{ id: 'i6', customer: 'Fern', status: 'paid', due: '2026-03-19', total: 712.2 },
	{ id: 'i7', customer: 'Glow', status: 'open', due: '2026-03-22', total: 1630 },
	{ id: 'i8', customer: 'Hive', status: 'paid', due: '2026-03-25', total: 58.9 },
	{ id: 'i9', customer: 'Iris', status: 'open', due: '2026-03-28', total: 2045.35 },
	{ id: 'i10', customer: 'Jade', status: 'paid', due: '2026-03-31', total: 310 },
	{ id: 'i11', customer: 'Kite', status: 'paid', due: '2026-04-03', total: 975.6 },
	{ id: 'i12', customer: 'Lumen', status: 'open', due: '2026-04-06', total: 1420 },
]

const LANGUAGES = [
	{ value: 'en', label: 'English' },
	{ value: 'de', label: 'Deutsch' },
	{ value: 'fr', label: 'Français' },
] as const
type Language = (typeof LANGUAGES)[number]['value']

// Everything a person reads in the table, in each language: the headers, the words of the data
// and the words that the table writes itself. The locale formats the dates and the money.
const WORDS: Record<
	Language,
	{
		locale: string
		headers: Record<'customer' | 'status' | 'due' | 'total', string>
		status: Record<Status, string>
		messages: Partial<TableMessages>
	}
> = {
	en: {
		locale: 'en-GB',
		headers: { customer: 'Customer', status: 'Status', due: 'Due', total: 'Total' },
		status: { paid: 'Paid', open: 'Open' },
		messages: {},
	},
	de: {
		locale: 'de-DE',
		headers: { customer: 'Kunde', status: 'Status', due: 'Fällig', total: 'Summe' },
		status: { paid: 'Bezahlt', open: 'Offen' },
		messages: {
			groupRow: ({ text, count }) => `${text}, ${count} Rechnungen`,
			expandRow: () => 'Aufklappen',
			collapseRow: () => 'Zuklappen',
			noRows: () => 'Keine Zeilen.',
		},
	},
	fr: {
		locale: 'fr-FR',
		headers: { customer: 'Client', status: 'Statut', due: 'Échéance', total: 'Total' },
		status: { paid: 'Payée', open: 'Ouverte' },
		messages: {
			groupRow: ({ text, count }) => `${text}, ${count} factures`,
			expandRow: () => 'Déplier',
			collapseRow: () => 'Replier',
			noRows: () => 'Aucune ligne.',
		},
	},
}

const language = shallowRef<Language>('de')
const words = computed(() => WORDS[language.value])
const open = computed(() =>
	Object.values(words.value.status).map((status) => `group/status=${encodeURIComponent(status)}`),
)

const columns = computed<ColumnDef<Invoice>[]>(() => [
	{ id: 'customer', header: words.value.headers.customer },
	// The status names the groups, so it needs no column of its own.
	{
		id: 'status',
		header: words.value.headers.status,
		value: (invoice) => words.value.status[invoice.status],
	},
	{
		id: 'due',
		header: words.value.headers.due,
		format: 'date',
		// The name of the month shows the language best: 4 Mar, 4. März, 4 mars.
		formatOptions: { day: 'numeric', month: 'short', timeZone: 'UTC' },
	},
	{
		id: 'total',
		header: words.value.headers.total,
		format: 'currency',
		formatOptions: euro,
		aggregate: 'sum',
	},
])
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<SinkSegment v-model="language" label="Language of the table" :items="LANGUAGES" />
		</div>
		<div class="sink-frame" :lang="language">
			<!-- A new language names the groups anew, so the table starts again with both open. -->
			<Table
				:key="language"
				:rows="invoices"
				:columns="columns"
				:messages="words.messages"
				:locale="words.locale"
				:group-by="['status']"
				:default-column-visibility="{ status: false }"
				:default-expanded="open"
				aria-label="Invoices by status, in the chosen language"
			/>
		</div>
	</div>
</template>
