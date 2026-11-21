<script setup lang="ts">
import { DataTable, DataTableSelect, type DataTableColumn } from 'ui-sdk-table-styled'
import { computed, shallowRef } from 'vue'
import { sortableColumns } from './columns'
import {
	formatRows,
	inventory,
	issues,
	localizationRows,
	paginationPeople,
	people,
	type FormatRow,
	type InventoryRow,
	type Issue,
	type LocalRow,
	type Person,
} from './data'
import DemoBadge from './DemoBadge.vue'
import DemoSection from './DemoSection.vue'
import { translations } from './translations'

const formatColumns: DataTableColumn<FormatRow>[] = [
	{ id: 'label', header: 'Label' },
	{ id: 'amount', header: 'Decimal', format: 'decimal', formatOptions: { locale: 'en-US' } },
	{
		id: 'price',
		header: 'Currency',
		format: 'currency',
		formatOptions: { currency: 'USD', locale: 'en-US', showUnit: true },
	},
	{ id: 'progress', header: 'Percentage', format: 'percentage', formatOptions: { showUnit: true } },
	{ id: 'created', header: 'Date', format: 'date', formatOptions: { locale: 'en-GB' } },
	{
		id: 'createdAt',
		header: 'Date and time',
		key: 'created',
		format: 'datetime',
		formatOptions: { locale: 'en-GB', timeZone: 'UTC' },
	},
	{ id: 'updated', header: 'Relative time', format: 'relativeTime' },
	{ id: 'active', header: 'Boolean', format: 'boolean', meta: { align: 'center' } },
	{ id: 'homepage', header: 'Link', format: 'url', formatOptions: { openInNewTab: true } },
	{ id: 'contact', header: 'Email', format: 'email', formatOptions: { asLink: true } },
]

const locales = [
	['en-US', 'English (United States)', 'USD'],
	['en-GB', 'English (United Kingdom)', 'GBP'],
	['fi-FI', 'Finnish (Finland)', 'EUR'],
	['de-DE', 'German (Germany)', 'EUR'],
	['fr-FR', 'French (France)', 'EUR'],
	['es-ES', 'Spanish (Spain)', 'EUR'],
	['nb-NO', 'Norwegian (Norway)', 'NOK'],
	['ja-JP', 'Japanese (Japan)', 'JPY'],
	['ar-EG', 'Arabic (Egypt)', 'EGP'],
] as const
const zones = [
	'UTC',
	'Europe/Helsinki',
	'Europe/London',
	'America/New_York',
	'America/Los_Angeles',
	'Asia/Tokyo',
	'Australia/Sydney',
]
const locale = shallowRef<string>('en-US')
const zone = shallowRef('UTC')
const currency = computed(() => locales.find(([id]) => id === locale.value)?.[2] ?? 'USD')

// The locale goes to the table, and every column follows it. The time zone
// and the currency are options of single columns.
const localColumns = computed<DataTableColumn<LocalRow>[]>(() => [
	{ id: 'amount', header: 'Decimal', format: 'decimal' },
	{
		id: 'price',
		header: 'Currency',
		format: 'currency',
		formatOptions: { currency: currency.value, showUnit: true },
	},
	{
		id: 'share',
		header: 'Percentage',
		format: 'percentage',
		formatOptions: { showUnit: true, maximumFractionDigits: 2 },
	},
	{
		id: 'date',
		header: 'Date',
		format: 'date',
		formatOptions: { dateStyle: 'medium', timeZone: zone.value },
	},
	{
		id: 'dateTime',
		header: 'Date and time',
		key: 'date',
		format: 'datetime',
		formatOptions: {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: zone.value,
			timeZoneName: 'short',
		},
	},
	{ id: 'updated', header: 'Relative time', format: 'relativeTime' },
])

const language = shallowRef('en')
const languages = Object.entries(translations).map(([value, entry]) => ({
	value,
	label: entry.label,
}))
const translationColumns: DataTableColumn<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'role', header: 'Role' },
	{ id: 'age', header: 'Age', format: 'integer' },
]

const issueColumns: DataTableColumn<Issue>[] = [
	{ id: 'title', header: 'Title' },
	{ id: 'status', header: 'Status' },
	{ id: 'assignee', header: 'Assignee' },
]
const statusTone = { open: 'info', in_review: 'warning', closed: 'success' } as const
const statusLabel = { open: 'Open', in_review: 'In review', closed: 'Closed' } as const

const inventoryColumns: DataTableColumn<InventoryRow>[] = [
	{ id: 'sku', header: 'SKU' },
	{ id: 'name', header: 'Name' },
	{ id: 'stock', header: 'Stock', format: 'integer' },
	{ id: 'change', header: 'Change', format: 'integer' },
]
const inventoryRowClass = (row: InventoryRow) =>
	row.stock === 0 ? 'bg-destructive/10' : row.stock < 10 ? 'bg-warning/15' : ''

const changeColumns: DataTableColumn<InventoryRow>[] = inventoryColumns.map((column) =>
	column.id === 'change'
		? {
				...column,
				meta: {
					// A class of its own for each cell, from the value of the cell.
					class: (value) =>
						typeof value === 'number' && value !== 0
							? value > 0
								? 'font-semibold'
								: 'font-semibold text-destructive'
							: 'text-foreground/70',
				},
			}
		: column,
)
</script>

<template>
	<DemoSection id="format-types" title="Format types">
		<template #description>
			The format of a column makes the text of its cells: numbers, money, dates, links.
		</template>
		<DataTable :rows="formatRows" :columns="formatColumns" label="Formats" />
	</DemoSection>

	<DemoSection id="localization" title="Localization">
		<template #description>
			The locale of the table and the time zone of a column decide how numbers and dates read.
		</template>
		<div class="flex flex-wrap gap-3">
			<DataTableSelect
				:items="locales.map(([value, label]) => ({ value, label }))"
				:value="locale"
				label="Locale"
				@change="(value) => typeof value === 'string' && (locale = value)"
			/>
			<DataTableSelect
				:items="zones.map((value) => ({ value, label: value }))"
				:value="zone"
				label="Time zone"
				@change="(value) => typeof value === 'string' && (zone = value)"
			/>
		</div>
		<DataTable
			:rows="localizationRows"
			:columns="localColumns"
			:locale="locale"
			label="Localized values"
		/>
	</DemoSection>

	<DemoSection id="ui-translations" title="UI translations">
		<template #description>
			The texts of the controls come from the messages of the table, and change while it is on the
			page.
		</template>
		<DataTableSelect
			:items="languages"
			:value="language"
			label="Language of the controls"
			@change="(value) => typeof value === 'string' && (language = value)"
		/>
		<DataTable
			:rows="paginationPeople"
			:columns="translationColumns"
			:messages="translations[language]?.messages"
			search
			column-menu
			pagination
			:page-sizes="[5, 10, 25]"
			label="Translated controls"
		/>
	</DemoSection>

	<DemoSection id="custom-slots" title="Custom cell slot">
		<template #description>A slot draws the cells of one column.</template>
		<DataTable :rows="issues" :columns="issueColumns" label="Issues">
			<template #col-status="{ row }">
				<DemoBadge :tone="statusTone[row.status]">{{ statusLabel[row.status] }}</DemoBadge>
			</template>
		</DataTable>
	</DemoSection>

	<DemoSection id="row-styling" title="Conditional row styling">
		<template #description>
			A function gives each row its class: out of stock, or nearly out of stock.
		</template>
		<DataTable
			:rows="inventory"
			:columns="inventoryColumns"
			:row-class="inventoryRowClass"
			label="Inventory by row"
		/>
	</DemoSection>

	<DemoSection id="cell-styling" title="Conditional cell styling">
		<template #description>A function of a column gives each of its cells a class.</template>
		<DataTable :rows="inventory" :columns="changeColumns" label="Inventory by cell" />
	</DemoSection>

	<DemoSection id="auto-width" title="Auto width">
		<template #description>A table fills its place, or is as wide as its columns need.</template>
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="flex min-w-0 flex-col gap-2">
				<h3 class="text-base font-semibold">Full width (default)</h3>
				<DataTable :rows="people" :columns="sortableColumns" label="People at full width" />
			</div>
			<div class="flex min-w-0 flex-col gap-2">
				<h3 class="text-base font-semibold">Auto width</h3>
				<DataTable
					:rows="people"
					:columns="sortableColumns"
					width="auto"
					label="People at auto width"
				/>
			</div>
		</div>
	</DemoSection>
</template>
