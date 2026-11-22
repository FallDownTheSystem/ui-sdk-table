# A styled table for an app

Build the table component of your design system on the headless table: the order of the work, and for each control what the library gives and what your app writes.

Read it when you write the one table that every page of an app uses. A page of the app then passes rows, columns and a few options, and gets the looks and the controls of the design system.

```vue title="toolbar.vue"
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
```

Type an author into the search field, take Year out of the table with its box, and step through the pages. Each control reads the view and calls the controller; the table holds the state.

## The order of the work

1. **The wrapper.** One component that renders `Table` and passes its props, its events, its slots and a `controller` through. Take the controller from a prop, else make one with `createTableController()`, and expose it.
2. **The looks of the table.** Style the parts by `data-slot` and the state by `data-*` and `aria-*` attributes. See [Styling](./styling.md).
3. **The controls beside the table.** A toolbar, a search field, filters, a column menu, the pages, an export menu. Each reads `useTableView(controller)` and calls a method of the controller.
4. **The sheet controls**, when the app needs them: a sheet toolbar, a formula bar, a summary of the selected cells.
5. **The words.** Pass `messages` with the texts of your language.

## The wrapper

- **What the library gives:** `Table` with its props, events and slots; `createTableController`; `rowAttrs`, `cellAttrs` and `sectionAttrs` for classes.
- **What the app writes:** the list of props it passes through, the events it sends on, the slots it forwards, and its own lead columns, such as a checkbox column (`lead: true`).
- An option that a page does not set must reach the table as not set, so the table keeps its own default. Vue reads a boolean prop that is not set as `false`: give each boolean prop of the wrapper the default `undefined`.
- Keep `rowAttrs` and `cellAttrs` the same functions for the life of the table, and read the props inside them. A new function is a new option, and the table renders again.
- Pass arrays and objects as constants, not as literals in a template: a literal is a new value at each render.
- The export is named `Table`. A design system that has a `Table` of its own imports this one under another name: `import { Table as HeadlessTable } from 'ui-sdk-table-vue'`.

## Looks

- **What the library gives:** `data-slot` on every part, state as attributes, the CSS variables of widths, pins and sticky rows. See [Styling](./styling.md).
- **What the app writes:** one place for the classes of the design system. A class reaches a row or a cell through `rowAttrs` and `cellAttrs`, which get the `kind` of the row or cell (`header`, `row`, `cell`, `foot`, `group`, `group-total`, `detail`, `empty`, `letters`, `letter`). A caller cannot replace a state attribute of the table with them.
- A state shows through a selector of an attribute, such as `[data-pinned]` or `[aria-selected='true']`, never through a class that a script switches.
- A cell that sticks needs an opaque background, so the rows under it do not show through.

## The toolbar and the search field

- **What the library gives:** `useTableSearch(controller)` with `text`, `pending`, `clear()` and `flush()`; the option `searchDebounce`.
- **What the app writes:** the field of the design system, bound to `search.text`. Escape calls `clear()` and Enter `flush()`. See [Sort, filter and search](./sort-filter-and-search.md).
- The table says nothing to a screen reader about a search. Announce the rows found when `filter` changes.

## Filter controls

- **What the library gives:** `controller.getFacets(columnId)` with `kind`, `values`, `range` and `days`; `getFacets(columnId, { rows: 'all' })`; `setColumnFilter`, `clearColumnFilters`, `clearFilters`; `sliderBounds`, `isEmptyFilter`, `toText`.
- **What the app writes:** a control for each `kind`: a list of values, a slider with two fields, a date range. A search field in a long list. Which columns have a filter control.
- Read the ends of a slider and of a calendar from `getFacets(columnId, { rows: 'all' })`, so they do not move while a person filters another column. Read the counts of a list from `getFacets(columnId)`.
- A hidden column can still filter. List its filter, so a person can see why rows are gone.

## The column menu

- **What the library gives:** `setColumnVisibility`, `showAllColumns`, `hideAllColumns`, `resetColumnVisibility`, `resetColumnOrder`, `resetColumnPinning`, `resetColumnWidths`, `pinColumn`; the view fields `columns` and `visibleColumns`. `setColumnVisibility` throws for a column with `hideable: false`.
- **What the app writes:** the menu, a box for each column that can be hidden, and the entries for pins and resets that the app wants. See [Columns](./column-definitions.md).

## The pages

- **What the library gives:** `setPage`, `setPageSize` (`null` for one page with every row); the view fields `page` (from 1), `pageSize`, `pageCount`, `rowCount`, `pageUnit` and `lastPageKnown`.
- **What the app writes:** the pagination of the design system, a list of page sizes, and the text "11–20 of 23". With pages from a server that gave no count, `lastPageKnown` is false. See [Pages and server mode](./pages-and-server-mode.md).

## The export menu

- **What the library gives:** `controller.exportData(options)`; `toCsv`, `toXlsx`, `downloadCsv` and `downloadXlsx` in the entry `ui-sdk-table-vue/export`; `excelFormulas()` in `ui-sdk-table-vue/formulas`.
- **What the app writes:** the menu, and a message when the file fails. Load the entry with `import()` when a person asks for a file, never with a static import. See [Export](./export.md).

## The sheet toolbar, the formula bar and the summary

- **What the library gives:** `formatCells`, `toggleCellFormat`, `clearCellFormats`, `getCellFormat`, `undo`, `redo`; the view fields `activeCell`, `cellSelection`, `canUndo`, `canRedo`; `useFormulaBar(controller)`; `useSelectionSummary(controller)`; `getColumnFormula`, `setColumnFormula`, `getFormulaFunctions`.
- **What the app writes:** the buttons and lists, their pressed state from `getCellFormat` of the active cell, and focus back to the active cell (`[data-active]`) after a choice. A method that refuses throws: show the `cause` of the error when it is a text, else its `message`. See [Formats](./formats.md), [History](./history.md) and [Formulas](./sheet-formulas.md).
- Show the summary in a plain element, not in a live region: a new sum at each step of a selection is noise.

## The words

- **What the library gives:** `defaultMessages` and the type `TableMessages`. Pass your own as `messages`. `describeFormulaIssue` of the formulas entry gives the English words of a formula issue.
- **What the app writes:** the texts of its own controls in its language, and the texts of the table it wants other than English.

See the [More tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=more): `more-app` is one table with many options in one scene.
