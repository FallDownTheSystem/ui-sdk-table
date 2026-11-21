<script setup lang="ts">
import { MailIcon } from '@lucide/vue'
import { Button } from '@ui-sdk/vue/button'
import { buttonClass, DataTable, type DataTableColumn } from 'ui-sdk-table-styled'
import { onMounted, shallowRef } from 'vue'
import { makeCustomers, type Customer } from './data'
import DemoBadge from './DemoBadge.vue'
import DemoSection from './DemoSection.vue'

const props = defineProps<{ stress?: boolean }>()

// The rows arrive after the page, as rows from a server do, so the table shows its skeleton first.
const customers = shallowRef<Customer[]>([])
const loading = shallowRef(true)
onMounted(() => {
	setTimeout(() => {
		customers.value = makeCustomers(props.stress ? 2000 : 75)
		loading.value = false
	}, 300)
})

const selection = shallowRef<string[]>([])

const formatPhone = (phone: string) =>
	phone.replace(/^(\+\d{3})(\d{2})(\d{3})(\d+)$/, '$1 $2 $3 $4')

const euro = { currency: 'EUR', locale: 'en-IE', showUnit: true, maximumFractionDigits: 0 }
// The destructive colour as text is under 4.5 to 1 on a tinted or selected row, so the text keeps
// its colour and a dot in front of it carries the state.
const dot =
	"font-semibold before:me-1.5 before:inline-block before:size-2 before:rounded-full before:content-['']"
const risk = (value: unknown) =>
	typeof value === 'number' && value > 0.7
		? `${dot} before:bg-destructive`
		: typeof value === 'number' && value > 0.4
			? `${dot} before:bg-warning-ink`
			: 'font-medium'

const columns: DataTableColumn<Customer>[] = [
	{
		id: 'name',
		header: 'Customer',
		value: (row) => `${row.firstName} ${row.lastName}`,
		sortable: true,
		hideable: false,
	},
	{ id: 'title', header: 'Title', sortable: true },
	{ id: 'company', header: 'Company', sortable: true },
	{ id: 'country', header: 'Country', sortable: true, groupable: true, filter: 'select' },
	{ id: 'email', header: 'Email', format: 'email', formatOptions: { asLink: true } },
	{ id: 'phone', header: 'Phone', value: (row) => formatPhone(row.phone) },
	{ id: 'website', header: 'Website', format: 'url', formatOptions: { openInNewTab: true } },
	{ id: 'plan', header: 'Plan', sortable: true, groupable: true },
	{ id: 'mrr', header: 'MRR', sortable: true, format: 'currency', formatOptions: euro },
	{ id: 'lifetimeValue', header: 'LTV', sortable: true, format: 'currency', formatOptions: euro },
	{
		id: 'openInvoices',
		header: 'Open invoices',
		sortable: true,
		format: 'integer',
		meta: {
			class: (value) =>
				typeof value === 'number' && value > 3 ? `${dot} before:bg-destructive` : '',
		},
	},
	{
		id: 'churnRisk',
		header: 'Churn risk',
		sortable: true,
		format: 'percentage',
		formatOptions: { showUnit: true },
		meta: { class: risk },
	},
	{ id: 'npsScore', header: 'NPS', sortable: true, format: 'integer' },
	{
		id: 'active',
		header: 'Active',
		sortable: true,
		format: 'boolean',
		meta: { align: 'center', filterable: false },
	},
	{
		id: 'contractEnds',
		header: 'Contract ends',
		sortable: true,
		format: 'date',
		formatOptions: { locale: 'en-GB' },
	},
	{ id: 'lastSeen', header: 'Last seen', sortable: true, format: 'relativeTime' },
	{ id: 'tags', header: 'Tags', value: (row) => row.tags.join(', ') },
]

const hidden = {
	title: false,
	email: false,
	phone: false,
	website: false,
	openInvoices: false,
	npsScore: false,
	lastSeen: false,
	tags: false,
}

const rowClass = (row: Customer) => [
	// Muted text on the fill of a hovered or selected row is under 4.5 to 1, so a row dims with the text colour.
	!row.active && 'text-foreground/70',
	row.churnRisk > 0.7 && 'bg-destructive/5',
]

const planTone = {
	Free: 'neutral',
	Starter: 'info',
	Growth: 'success',
	Enterprise: 'warning',
} as const
const invoiceTone = { paid: 'success', open: 'info', overdue: 'destructive' } as const
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
</script>

<template>
	<DemoSection
		:id="stress ? 'stress-test' : 'customer-directory'"
		:title="stress ? 'Stress test: 2000 customers' : 'Customer directory'"
	>
		<template #description>
			<template v-if="stress">
				2,000 customers with search, column filters, selection and the column menu, on pages of 50.
			</template>
			<template v-else>
				Everything at once: search, column filters, sort, selection, detail rows, the column menu,
				export and pages.
			</template>
		</template>
		<DataTable
			v-model:selected="selection"
			:rows="customers"
			:columns="columns"
			:loading="loading"
			:row-class="rowClass"
			:default-sort="stress ? [] : [{ id: 'mrr', desc: true }]"
			:default-column-visibility="hidden"
			:has-detail="stress ? undefined : () => true"
			:export="
				stress
					? false
					: { filename: 'customers', options: { rows: 'all', columns: 'all', children: false } }
			"
			:page-sizes="stress ? [50, 100, 200, 500] : [10, 25, 50, 100]"
			:skeleton-rows="5"
			search
			column-filters
			column-menu
			pagination
			selection="multiple"
			:label="stress ? 'Stress customers' : 'Customers'"
		>
			<template v-if="!stress" #toolbar>
				<Button v-if="selection.length" :class="buttonClass('outline')">
					<MailIcon aria-hidden="true" />
					Email {{ selection.length }} selected
				</Button>
			</template>
			<template #col-name="{ row }">
				<div class="flex items-center gap-3">
					<span
						aria-hidden="true"
						class="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-medium text-foreground"
					>
						{{ row.firstName[0] }}{{ row.lastName[0] }}
					</span>
					<div class="flex flex-col">
						<span class="font-medium">{{ row.firstName }} {{ row.lastName }}</span>
						<span v-if="stress" class="text-xs text-foreground/70">{{ row.email }}</span>
						<a
							v-else
							:href="`mailto:${row.email}`"
							class="rounded-sm text-xs text-foreground/70 underline-offset-4 hover:underline"
						>
							{{ row.email }}
						</a>
					</div>
				</div>
			</template>
			<template #col-country="{ row }">
				<span class="inline-flex items-center gap-2">
					<span
						aria-hidden="true"
						class="rounded-sm border border-border px-1 font-mono text-xs text-foreground/70"
					>
						{{ row.countryCode }}
					</span>
					{{ row.country }}
				</span>
			</template>
			<template v-if="!stress" #col-plan="{ row }">
				<DemoBadge :tone="planTone[row.plan]">{{ row.plan }}</DemoBadge>
			</template>
			<template v-if="!stress" #col-mrr="{ row, text }">
				{{ text }}
				<span v-if="row.mrr > 0" class="ms-1 text-xs text-foreground/70">
					×{{ (row.lifetimeValue / row.mrr).toFixed(0) }}
				</span>
			</template>
			<template v-if="!stress" #col-tags="{ row }">
				<span v-if="row.tags.length" class="inline-flex gap-1">
					<DemoBadge v-for="tag in row.tags" :key="tag">{{ tag }}</DemoBadge>
				</span>
				<span v-else class="text-foreground/70">None</span>
			</template>
			<template v-if="!stress" #col-active="{ row }">
				<span
					aria-hidden="true"
					:data-active="row.active ? '' : undefined"
					class="inline-block size-2 rounded-full bg-muted-foreground/40 data-active:bg-success"
				/>
				<span class="sr-only">{{ row.active ? 'Active' : 'Not active' }}</span>
			</template>
			<template v-if="!stress" #detail="{ row }">
				<div class="flex flex-col gap-2 rounded-md bg-muted p-3">
					<p class="font-medium">
						Invoices for {{ row.firstName }} {{ row.lastName }} ({{ row.invoices.length }})
					</p>
					<table v-if="row.invoices.length" class="w-full max-w-2xl text-sm">
						<thead>
							<tr class="text-start text-foreground/70">
								<th class="py-1 text-start font-medium">Number</th>
								<th class="py-1 text-start font-medium">Issued</th>
								<th class="py-1 text-start font-medium">Due</th>
								<th class="py-1 text-end font-medium">Amount</th>
								<th class="py-1 ps-4 text-start font-medium">Status</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="invoice in row.invoices" :key="invoice.number">
								<td class="py-1 font-mono">{{ invoice.number }}</td>
								<td class="py-1">{{ date.format(invoice.issued) }}</td>
								<td class="py-1">{{ date.format(invoice.due) }}</td>
								<td class="py-1 text-end tabular-nums">{{ money.format(invoice.amount) }}</td>
								<td class="py-1 ps-4">
									<DemoBadge :tone="invoiceTone[invoice.status]">{{ invoice.status }}</DemoBadge>
								</td>
							</tr>
						</tbody>
					</table>
					<p v-else class="text-foreground/70">No invoices yet.</p>
				</div>
			</template>
		</DataTable>
		<output v-if="!stress" data-testid="selected-customers" class="text-sm text-muted-foreground">
			Selected customers: {{ selection.length }}
		</output>
	</DemoSection>
</template>
