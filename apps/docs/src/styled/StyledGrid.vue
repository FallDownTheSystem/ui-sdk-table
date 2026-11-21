<script setup lang="ts">
import {
	applyEdits,
	type CellEdit,
	type CellRange,
	type ColumnPinning,
	type PageState,
	type StandardSchemaV1,
} from 'ui-sdk-table-vue'
import { DataTable, type DataTableColumn } from 'ui-sdk-table-styled'
import { shallowRef, watch } from 'vue'
import { sortableColumns } from './columns'
import { makeMembers, makePeople, orders, people, type Order, type Person } from './data'
import DemoSection from './DemoSection.vue'

const orderColumns: DataTableColumn<Order>[] = [
	{ id: 'product', header: 'Product', sortable: true },
	{ id: 'category', header: 'Category' },
	{ id: 'region', header: 'Region' },
	{ id: 'units', header: 'Units', format: 'integer' },
	{
		id: 'price',
		header: 'Unit price',
		format: 'currency',
		formatOptions: { currency: 'USD', locale: 'en-US', showUnit: true },
	},
	{ id: 'isReturn', header: 'Returned', format: 'boolean' },
	{
		id: 'revenue',
		header: 'Revenue',
		format: 'currency',
		formatOptions: { currency: 'USD', locale: 'en-US', showUnit: true },
	},
]
const pins = shallowRef<ColumnPinning>({ start: ['product'], end: ['revenue'] })
// A pinned cell is opaque, so it paints the tint of its row itself: the
// second class gives the cells of the row the same colour as the row has.
const returned = (row: Order) => row.isReturn && 'bg-warning/15 *:from-warning/15'

const members = makeMembers(40)
const memberColumns = [
	{ id: 'name', header: 'Name' },
	{ id: 'email', header: 'Email' },
	{ id: 'role', header: 'Role' },
	{ id: 'joined', header: 'Joined', format: 'date' },
] satisfies DataTableColumn<(typeof members)[number]>[]

// A schema of the Standard Schema kind, written by hand. A schema of Zod,
// Valibot or ArkType has the same shape and goes in the same place.
const ageSchema: StandardSchemaV1 = {
	'~standard': {
		version: 1,
		vendor: 'demo',
		validate: (value) =>
			typeof value === 'number' && Number.isInteger(value) && value >= 18 && value <= 99
				? { value }
				: { issues: [{ message: 'The age must be a whole number from 18 to 99.' }] },
	},
}
const editColumns: DataTableColumn<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'role', header: 'Role', editable: false },
	{ id: 'age', header: 'Age', format: 'integer', schema: ageSchema },
]
const editRows = shallowRef<Person[]>(people.map((person) => ({ ...person })))
const range = shallowRef<CellRange | null>(null)
const lastEdit = shallowRef('none')
function edit(edits: readonly CellEdit<Person>[]) {
	// New rows for the edited ones: the table never writes into the rows it has.
	editRows.value = applyEdits(editRows.value, edits)
	lastEdit.value = edits.map((one) => `${one.column.id} of ${one.row.name}`).join(', ')
}

// A server that knows the page it is asked for and not how many rows it has.
const all = makePeople(23, 11)
const DELAY = Number(new URLSearchParams(location.search).get('delay') ?? 400)
const serverPage = shallowRef<PageState | undefined>({ page: 1, pageSize: 5 })
const serverRows = shallowRef<Person[]>([])
const serverLoading = shallowRef(false)
let request = 0
watch(
	serverPage,
	(state) => {
		if (!state) return
		const mine = ++request
		serverLoading.value = true
		// The rows of the page before stay in the table until the new ones are here.
		setTimeout(() => {
			if (mine !== request) return
			const start = (state.page - 1) * state.pageSize
			serverRows.value = all.slice(start, start + state.pageSize)
			serverLoading.value = false
		}, DELAY)
	},
	{ immediate: true },
)
</script>

<template>
	<DemoSection id="pinned-columns" title="Pinned columns">
		<template #description>
			The product stays at the start and the revenue at the end while the other columns scroll. The
			checkbox column sticks with the start pins. A returned order has a tint, on its pinned cells
			too.
		</template>
		<DataTable
			v-model:column-pinning="pins"
			:rows="orders"
			:columns="orderColumns"
			:row-class="returned"
			selection="multiple"
			sticky-header
			wrapper-class="h-72 max-w-sm"
			label="Orders with pinned columns"
		/>
	</DemoSection>

	<DemoSection id="column-resize" title="Resize and reorder columns">
		<template #description>
			Drag the bar at the end of a header, or use the arrow keys on it, for the width of a column.
			Drag a header, or press Alt and an arrow key on it, for its place.
		</template>
		<DataTable
			:rows="people"
			:columns="sortableColumns"
			resizable
			reorderable
			label="People with columns to resize and move"
		/>
	</DemoSection>

	<DemoSection id="cell-editing" title="Edit cells and select a range">
		<template #description>
			Enter or a double click opens a cell. Shift and an arrow key, or a drag, select a range of
			cells. The role cannot be edited, and an age must be a whole number from 18 to 99.
		</template>
		<DataTable
			v-model:cell-range="range"
			:rows="editRows"
			:columns="editColumns"
			editable
			cell-selection
			label="People to edit"
			@cell-edit="edit"
		/>
		<output data-testid="last-edit" class="text-sm text-muted-foreground">
			Last edit: {{ lastEdit }}
		</output>
	</DemoSection>

	<DemoSection id="server-pages" title="Pages from a server">
		<template #description>
			The page asks a server for each page and does not know how many rows there are. The pages stay
			in place while a page loads.
		</template>
		<DataTable
			v-model:page="serverPage"
			:rows="serverRows"
			:columns="sortableColumns"
			:loading="serverLoading"
			:page-sizes="[5, 10]"
			manual-page
			manual-sort
			pagination
			label="People from a server"
		/>
	</DemoSection>

	<DemoSection id="sticky-offset" title="Sticky header under an app header">
		<template #description>
			An app with a fixed header gives the table the height of that header in the variable
			<code>--table-sticky-top</code>. The header of the table then stays under the bar, not under
			the top of the page.
		</template>
		<div class="flex flex-col gap-4 [--table-sticky-top:--spacing(14)]">
			<div
				data-testid="app-bar"
				class="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background text-sm font-medium"
			>
				App header
			</div>
			<DataTable
				:rows="members"
				:columns="memberColumns"
				sticky-header
				scroll="page"
				label="Members under an app header"
			/>
		</div>
	</DemoSection>
</template>
