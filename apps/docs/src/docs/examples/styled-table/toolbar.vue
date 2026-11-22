<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { Checkbox, CheckboxIndicator } from '@ui-sdk/vue/checkbox'
import { Input } from '@ui-sdk/vue/input'
import {
	createTableController,
	Table,
	useTableSearch,
	useTableView,
	type ColumnDef,
} from 'ui-sdk-table-vue'

type Book = { id: string; title: string; author: string; year: number }

const books: Book[] = [
	{ id: 'b1', title: 'The Long Field', author: 'Ines Moreau', year: 2019 },
	{ id: 'b2', title: 'Salt and Iron', author: 'Tom Ashby', year: 2021 },
	{ id: 'b3', title: 'Small Hours', author: 'Ines Moreau', year: 2016 },
	{ id: 'b4', title: 'North Light', author: 'Kai Lund', year: 2023 },
	{ id: 'b5', title: 'The River Road', author: 'Tom Ashby', year: 2012 },
]

const columns: ColumnDef<Book>[] = [
	// The title stays: a person cannot hide it.
	{ id: 'title', header: 'Title', sortable: true, hideable: false },
	{ id: 'author', header: 'Author', sortable: true },
	{ id: 'year', header: 'Year', sortable: true },
]

// The controls read the view and call the controller; the table holds the state.
const controller = createTableController()
const view = useTableView(controller)
const search = useTableSearch(controller)
// A constant, not a literal in the template: a new object at each render is a new state.
const firstPage = { page: 1, pageSize: 2 }
const page = () => view.value?.page ?? 1
const pageCount = () => view.value?.pageCount ?? 1
</script>

<template>
	<div role="toolbar" aria-label="Books">
		<Input
			type="search"
			aria-label="Search the books"
			:value="search.text.value"
			@value-change="(text) => (search.text.value = text)"
		/>
		<label
			v-for="column in view?.columns.filter((each) => each.hideable !== false)"
			:key="column.id"
		>
			<Checkbox
				:checked="view?.visibleColumns.includes(column) ?? true"
				@checked-change="(next) => controller.setColumnVisibility(column.id, next === true)"
			>
				<CheckboxIndicator>✓</CheckboxIndicator>
			</Checkbox>
			{{ column.header }}
		</label>
	</div>
	<Table
		:rows="books"
		:columns="columns"
		:controller="controller"
		:default-page="firstPage"
		aria-label="Books"
	/>
	<nav aria-label="Pages of the books">
		<Button :disabled="page() === 1" @click="controller.setPage(page() - 1)">Previous</Button>
		<span role="status">Page {{ page() }} of {{ pageCount() }}</span>
		<Button :disabled="page() === pageCount()" @click="controller.setPage(page() + 1)">Next</Button>
	</nav>
</template>

<style scoped>
/* The looks of the controls are the app's. Here they only get room. */
[role='toolbar'],
nav {
	display: flex;
	gap: 12px;
	align-items: center;
}
label {
	display: flex;
	gap: 6px;
	align-items: center;
}
</style>
