<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	buttonClass,
	createTableController,
	DataTable,
	type DataTableColumn,
} from 'ui-sdk-table-styled'
import { computed, shallowRef, watch } from 'vue'
import { taskColumns } from './columns'
import {
	footerOrders,
	footerStickyOrders,
	makeBigRows,
	makeMembers,
	orders,
	orgData,
	products,
	salesData,
	tasks,
	type BigRow,
	type FooterOrder,
	type Member,
	type Order,
	type Product,
	type Sales,
	type Task,
	type TreeRow,
} from './data'
import DemoSection from './DemoSection.vue'
import DemoSwitch from './DemoSwitch.vue'

const orgColumns: DataTableColumn<TreeRow>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'type', header: 'Type' },
	{ id: 'count', header: 'Count', format: 'integer' },
]
const org = createTableController()
const orgOpen = shallowRef(false)
watch(orgOpen, (open) => (open ? org.expandAll() : org.collapseAll()))

const euro = { currency: 'EUR', locale: 'en-IE', showUnit: true }
const productColumns: DataTableColumn<Product>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'sku', header: 'SKU' },
	{
		id: 'price',
		header: 'Price',
		format: 'currency',
		formatOptions: { currency: 'EUR', locale: 'fi-FI', showUnit: true },
	},
	{ id: 'stock', header: 'Stock', format: 'integer' },
]

const notLow = (row: Task) => row.priority !== 'Low'

const orderColumns: DataTableColumn<Order>[] = [
	{ id: 'category', header: 'Category', groupable: true },
	{ id: 'product', header: 'Product', sortable: true },
	{ id: 'region', header: 'Region' },
	{ id: 'units', header: 'Units', format: 'integer', aggregate: 'sum' },
	{ id: 'price', header: 'Price', format: 'currency', formatOptions: euro, aggregate: 'mean' },
	{ id: 'revenue', header: 'Revenue', format: 'currency', formatOptions: euro, aggregate: 'sum' },
]
const orderCustomColumns: DataTableColumn<Order>[] = [
	{ id: 'category', header: 'Category', groupable: true },
	{ id: 'product', header: 'Product' },
	{ id: 'units', header: 'Units', format: 'integer', aggregate: 'sum' },
	{ id: 'orderCount', header: 'Orders', key: 'id', format: 'integer', aggregate: 'count' },
	{
		id: 'returns',
		header: 'Returned',
		key: 'isReturn',
		format: 'boolean',
		// A total of its own: the function gets the values of the column and gives the text.
		aggregate: (values) => `${values.filter(Boolean).length} returned`,
	},
]

const quarter = { currency: 'EUR', locale: 'en-IE', showUnit: true, maximumFractionDigits: 0 }
const salesColumns: DataTableColumn<Sales>[] = [
	{ id: 'region', header: 'Region' },
	{
		id: 'sales-2024',
		header: '2024 sales (€)',
		meta: { align: 'center' },
		columns: (['q1', 'q2', 'q3', 'q4'] as const).map((id) => ({
			id,
			header: id.toUpperCase(),
			format: 'currency' as const,
			formatOptions: quarter,
		})),
	},
]

const members = makeMembers(10)
const memberColumns: DataTableColumn<Member>[] = [
	{ id: 'id', header: '#', format: 'integer', width: 64, meta: { align: 'start' } },
	{ id: 'name', header: 'Name' },
	{ id: 'email', header: 'Email' },
	{ id: 'role', header: 'Role' },
	{ id: 'joined', header: 'Joined', format: 'date' },
]

const footerColumns: DataTableColumn<FooterOrder>[] = [
	{ id: 'product', header: 'Product' },
	{ id: 'category', header: 'Category' },
	{ id: 'quantity', header: 'Quantity', format: 'integer', aggregate: 'sum' },
	{ id: 'unitPrice', header: 'Unit price', format: 'currency', formatOptions: euro },
	{ id: 'revenue', header: 'Revenue', format: 'currency', formatOptions: euro, aggregate: 'sum' },
]
const euros = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
function meanPrice(totals: Record<string, unknown>) {
	const revenue = Number(totals.revenue)
	const quantity = Number(totals.quantity)
	return quantity > 0 ? euros.format(revenue / quantity) : ''
}

const bigRows = shallowRef<BigRow[]>()
const measured = shallowRef(false)
const bigColumns = computed<DataTableColumn<BigRow>[]>(() => [
	{ id: 'id', header: 'Id', width: 80, format: 'integer', sortable: true },
	{ id: 'name', header: 'Name', width: 220, sortable: true },
	{ id: 'email', header: 'Email', width: 260 },
	{ id: 'role', header: 'Role', width: 140, filter: 'select' },
	{ id: 'country', header: 'Country', width: 160 },
	{ id: 'joined', header: 'Joined', width: 120, format: 'date', sortable: true },
	{
		id: 'score',
		header: 'Score',
		width: 120,
		format: 'integer',
		aggregate: 'mean',
		sortable: true,
	},
	{ id: 'status', header: 'Status', width: 120, filter: 'select' },
	// With measured heights a note breaks into lines, so the rows differ in height.
	{ id: 'notes', header: 'Notes', width: 320, meta: { wrap: measured.value } },
])
</script>

<template>
	<DemoSection id="expansion-children" title="Child rows">
		<template #description>
			A row with child rows has a button that opens it. The switch opens and closes every row
			through the controller of the table.
		</template>
		<DemoSwitch v-model="orgOpen">Expand all rows</DemoSwitch>
		<DataTable
			:rows="orgData"
			:columns="orgColumns"
			:controller="org"
			:get-children="(row: TreeRow) => row.children"
			label="Teams"
		/>
	</DemoSection>

	<DemoSection id="expansion-custom" title="Custom expanded row">
		<template #description>The detail row of a row holds any content.</template>
		<DataTable :rows="products" :columns="productColumns" :has-detail="() => true" label="Products">
			<template #detail="{ row }">
				<div class="rounded-md bg-muted p-3">
					<p class="text-xs font-medium text-foreground/70">Description</p>
					<p>{{ row.description }}</p>
				</div>
			</template>
		</DataTable>
	</DemoSection>

	<DemoSection id="grouping" title="Row grouping">
		<template #description>
			Rows grouped by priority. In the second table, the rows with a low priority stay outside the
			groups.
		</template>
		<DataTable
			:rows="tasks"
			:columns="taskColumns"
			:default-group-by="['priority']"
			default-expanded="all"
			label="Tasks by priority"
		/>
		<DataTable
			:rows="tasks"
			:columns="taskColumns"
			:default-group-by="['priority']"
			default-expanded="all"
			:can-group="notLow"
			label="Tasks by priority, low ones apart"
		/>
	</DemoSection>

	<DemoSection id="nested-grouping" title="Nested grouping">
		<template #description>
			Groups by priority, then by status. The second table draws its group rows itself.
		</template>
		<DataTable
			:rows="tasks"
			:columns="taskColumns"
			:default-group-by="['priority', 'status']"
			default-expanded="all"
			label="Tasks by priority and status"
		/>
		<DataTable
			:rows="tasks"
			:columns="taskColumns"
			:default-group-by="['priority', 'status']"
			default-expanded="all"
			label="Tasks with own group rows"
		>
			<template #group="{ group, text, expanded, level, toggleExpanded }">
				<Button
					:aria-expanded="expanded"
					:data-level="level"
					:class="[buttonClass('ghost', 'sm'), 'data-[level=1]:ms-5']"
					@click="(event: Event) => toggleExpanded(event)"
				>
					<span aria-hidden="true">{{ expanded ? '▼' : '▶' }}</span>
					{{ level > 0 ? `${group.leaves[0]?.row.priority} › ${text}` : text }}
					<span class="text-foreground/70">({{ group.leaves.length }})</span>
				</Button>
			</template>
		</DataTable>
	</DemoSection>

	<DemoSection id="grouping-aggregations" title="Aggregations">
		<template #description>
			A column with a total shows it in each group row and in the footer. The second table counts
			rows and has a total of its own.
		</template>
		<DataTable
			:rows="orders"
			:columns="orderColumns"
			:default-group-by="['category']"
			default-expanded="all"
			label="Orders by category"
		/>
		<DataTable
			:rows="orders"
			:columns="orderCustomColumns"
			:default-group-by="['category']"
			default-expanded="all"
			label="Orders with own totals"
		/>
	</DemoSection>

	<DemoSection id="header-groups" title="Header groups">
		<template #description>A header over four columns.</template>
		<DataTable :rows="salesData" :columns="salesColumns" label="Sales by quarter" />
	</DemoSection>

	<DemoSection id="sticky-header" title="Sticky header">
		<template #description>
			The header stays at the top of the page while the rows scroll under it.
		</template>
		<DataTable
			:rows="members"
			:columns="memberColumns"
			sticky-header
			scroll="page"
			label="Members"
		/>
	</DemoSection>

	<DemoSection id="column-footers" title="Column footers">
		<template #description>
			Totals in the footer, a text and a computed value through footer slots, and a table whose
			header and footer both stay in view inside a frame of fixed height.
		</template>
		<DataTable :rows="footerOrders" :columns="footerColumns" label="Orders with totals">
			<template #foot-product>Totals</template>
			<template #foot-unitPrice="{ totals }">{{ meanPrice(totals) }}</template>
		</DataTable>
		<DataTable :rows="footerOrders" :columns="footerColumns" label="Orders with a marked total">
			<template #foot-product>Totals</template>
			<template #foot-revenue="{ text }">
				<strong class="font-bold underline decoration-primary decoration-2 underline-offset-4">
					{{ text }}
				</strong>
			</template>
		</DataTable>
		<DataTable
			:rows="footerStickyOrders"
			:columns="footerColumns"
			sticky-header
			sticky-footer
			wrapper-class="h-80"
			label="Orders in a frame"
		>
			<template #foot-product>Totals</template>
			<template #foot-unitPrice="{ totals }">{{ meanPrice(totals) }}</template>
		</DataTable>
	</DemoSection>

	<DemoSection id="virtualization" title="Virtualization">
		<template #description>
			50,000 rows. The table renders the rows near the frame and a spacer for the rest. With fixed
			heights every row is 41 pixels high; with measured heights the table measures each row.
		</template>
		<div v-if="bigRows" class="flex flex-col gap-3">
			<div class="flex flex-wrap items-center gap-3">
				<Button :class="buttonClass('outline')" @click="measured = !measured">
					{{ measured ? 'Use fixed heights' : 'Use measured heights' }}
				</Button>
				<output data-testid="big-count" class="text-sm text-muted-foreground">
					{{ bigRows.length.toLocaleString('en-US') }} rows,
					{{ measured ? 'measured heights' : 'fixed heights' }}
				</output>
			</div>
			<DataTable
				:key="measured ? 'measured' : 'fixed'"
				:rows="bigRows"
				:columns="bigColumns"
				row-window
				:row-height="measured ? undefined : 41"
				:estimated-row-height="measured ? 60 : undefined"
				sticky-header
				sticky-footer
				search
				column-menu
				wrapper-class="h-140"
				label="Fifty thousand rows"
			/>
		</div>
		<Button
			v-else
			:class="[buttonClass('outline'), 'w-fit']"
			@click="bigRows = makeBigRows(50_000)"
		>
			Load the 50,000-row dataset
		</Button>
	</DemoSection>
</template>
