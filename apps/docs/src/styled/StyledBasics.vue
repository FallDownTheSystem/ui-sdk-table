<script setup lang="ts">
import { DataTable, type FilterState, type SortRule } from 'ui-sdk-table-styled'
import { shallowRef } from 'vue'
import { basicColumns, sortableColumns } from './columns'
import { paginationPeople, people, type Person } from './data'
import DemoSection from './DemoSection.vue'

const sort = shallowRef<readonly SortRule[]>([{ id: 'role' }, { id: 'age', desc: true }])
const filter = shallowRef<FilterState>({})

const filterColumns = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'role', header: 'Role', sortable: true, filter: 'select' as const },
	{ id: 'age', header: 'Age', sortable: true, format: 'integer' as const },
	{
		id: 'joined',
		header: 'Joined',
		sortable: true,
		format: 'date' as const,
		formatOptions: { locale: 'en-GB' },
	},
]
</script>

<template>
	<DemoSection id="basic" title="Basic">
		<template #description>Rows and columns, and nothing else.</template>
		<DataTable :rows="people" :columns="basicColumns" label="Basic people" />
	</DemoSection>

	<DemoSection id="sorting" title="Sorting">
		<template #description>
			A click on a header sorts by its column. A click with Shift adds the column to the sort. The
			table starts sorted by role, then by age from high to low.
		</template>
		<DataTable
			v-model:sort="sort"
			:rows="people"
			:columns="sortableColumns"
			label="Sorted people"
		/>
		<output data-testid="sort" class="text-sm text-muted-foreground">
			Sort:
			{{
				sort.map((rule) => `${rule.id} ${rule.desc ? 'descending' : 'ascending'}`).join(', ') ||
				'none'
			}}
		</output>
	</DemoSection>

	<DemoSection id="pagination" title="Pagination">
		<template #description>23 rows on pages of 5, 10, 25 or 50.</template>
		<DataTable
			:rows="paginationPeople"
			:columns="basicColumns"
			pagination
			:page-sizes="[5, 10, 25, 50]"
			label="Paged people"
		/>
	</DemoSection>

	<DemoSection id="global-filter" title="Global filter">
		<template #description>The search reads every column.</template>
		<DataTable
			v-model:filter="filter"
			:rows="people"
			:columns="sortableColumns"
			search
			label="Searchable people"
		/>
		<output data-testid="search" class="text-sm text-muted-foreground">
			Search text: {{ filter.search || 'none' }}
		</output>
	</DemoSection>

	<DemoSection id="column-filters" title="Column filters">
		<template #description>
			One filter for each column: a text, a list of the values of the column, a range of numbers and
			a range of dates.
		</template>
		<DataTable :rows="people" :columns="filterColumns" column-filters label="Filtered people" />
	</DemoSection>
</template>
