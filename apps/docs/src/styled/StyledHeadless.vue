<script setup lang="ts">
import { DataTable } from 'ui-sdk-table-styled'
import {
	Table,
	type CellAttrsContext,
	type ColumnDef,
	type RowAttrsContext,
} from 'ui-sdk-table-vue'
import { sortableColumns } from './columns'
import { people, type Person } from './data'
import DemoSection from './DemoSection.vue'

const headlessColumns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'role', header: 'Role', sortable: true },
	{ id: 'age', header: 'Age', sortable: true, format: 'integer' },
]

// The headless table has no classes of its own. These two functions give
// each row and each cell the classes of this page.
const rowAttrs = (context: RowAttrsContext<Person>) =>
	context.kind === 'row' ? { class: 'odd:bg-muted/50' } : undefined
const cellAttrs = (context: CellAttrsContext<Person>) => ({
	class: [
		'px-3 py-2 text-start',
		context.kind === 'header' && 'border-b-2 border-foreground font-semibold',
	],
})

const noPeople: Person[] = []
</script>

<template>
	<DemoSection id="headless-compose" title="Headless">
		<template #description>
			A table that only sorts, built on the table without styles: the page gives the classes and the
			content of the header. Press Enter on a header, or click it.
		</template>
		<div class="w-fit rounded-md border border-border p-2">
			<Table
				:rows="people"
				:columns="headlessColumns"
				:row-attrs="rowAttrs"
				:cell-attrs="cellAttrs"
				aria-label="Headless people"
				class="border-collapse text-sm"
			>
				<template #header="{ label, sort, toggleSort }">
					<button type="button" class="cursor-pointer font-semibold" @click="toggleSort">
						{{ label }}
						<span aria-hidden="true">{{ sort === 'asc' ? '↑' : sort === 'desc' ? '↓' : '' }}</span>
					</button>
				</template>
			</Table>
		</div>
	</DemoSection>

	<DemoSection id="class-overrides" title="Class overrides">
		<template #description>
			A class for the frame, the table, the header cells, the rows and the cells.
		</template>
		<DataTable
			:rows="people"
			:columns="sortableColumns"
			pagination
			:page-sizes="[20, 50]"
			wrapper-class="border-2 border-destructive/40 ring-2 ring-primary/40"
			table-class="border-collapse"
			header-class="bg-accent text-accent-foreground"
			row-class="hover:bg-primary/5"
			cell-class="italic"
			label="People with own classes"
		/>
	</DemoSection>

	<DemoSection id="empty-loading" title="Empty and loading">
		<template #description>A table without rows, with a text of its own, and on its way.</template>
		<div class="grid gap-4 lg:grid-cols-3">
			<div class="flex min-w-0 flex-col gap-2">
				<h3 class="text-base font-semibold">Default empty</h3>
				<DataTable :rows="noPeople" :columns="sortableColumns" label="No people" />
			</div>
			<div class="flex min-w-0 flex-col gap-2">
				<h3 class="text-base font-semibold">Custom empty slot</h3>
				<DataTable :rows="noPeople" :columns="sortableColumns" label="No people, own text">
					<template #empty>
						<p class="px-2 py-6 text-center text-muted-foreground">
							No people found. Try adjusting your filters.
						</p>
					</template>
				</DataTable>
			</div>
			<div class="flex min-w-0 flex-col gap-2">
				<h3 class="text-base font-semibold">Loading</h3>
				<DataTable
					:rows="noPeople"
					:columns="sortableColumns"
					loading
					label="People on their way"
				/>
			</div>
		</div>
	</DemoSection>
</template>
