# ui-sdk-table-vue

The headless table for Vue: `Table`, its parts, slots, a `v-model` for each state, and `createTableController`. It renders a real `<table>` without any looks. A styled table is the work of the consumer, and is built on it.

```vue
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Person = { id: string; name: string; team: string }
const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team' },
]
</script>

<template>
	<Table :rows="people" :columns="columns" label="People" />
</template>
```

- `ui-sdk-table-vue/export` holds the CSV and Excel writers. Load it with `import()` where a person asks for a file, so a page without an export does not carry it.
- The package ships TypeScript source (`exports` points at `src`), so an app compiles it with its own compiler options.
- The export is named `Table`. An app that registers a component of its own with that name (for example by file name) imports this one under another name: `import { Table as HeadlessTable } from 'ui-sdk-table-vue'`.
- `rowAttrs` and `cellAttrs` give attributes to rows and cells. The table spreads them first and its own attributes after them, so a caller cannot replace a part prop (`value`, `index`, `row`, `col`, `colspan`) or a state attribute (`aria-*`, `data-*` of the table).
- `createTableController()` can be used before the table mounts: `subscribe` waits for the table and runs once when it is there. `useTableSearch` and `useTableView` can be called before the table too.

## What a styled table builds on

| Need | What the table gives |
| --- | --- |
| Looks | `data-slot` on every part (`table`, `table-row`, `table-cell`, ...), state as `aria-*` and `data-*` attributes (`data-kind`, `data-pinned`, `data-sticky`, `data-selected`, `data-active`, `data-format` with the format of the column on each of its cells, `data-sort-index` with the place of a column in the sort on its header cell), and `rowAttrs`, `cellAttrs`, `sectionAttrs` for classes |
| Widths and offsets | A table whose columns can be resized is as wide as its columns (`inline-size: var(--table-width)`) and must not stretch to its frame: a drag starts from the width that a column has on the screen. `--table-width`, `--table-column-width`, `--table-pin-offset`, `--table-sticky-offset`, `--table-row-height`, `--table-spacer-size`. A page with a fixed header or footer sets `--table-sticky-top` and `--table-sticky-bottom` on the table or a parent, and the sticky rows stop there |
| A checkbox or an expand column | A column with `lead: true`: always first, never in the column order or the pins, and it sticks with the first column that is pinned to the start. Its cells carry `data-lead`, for a width of their own |
| Controls beside the table | `createTableController()`, then `getView()` for the state and the pages, `subscribe()` for when to read again, and one method for each action. In Vue, `useTableView(controller)` is a ref of the view that follows the table, and is `undefined` until the table is there |
| A search field | `useTableSearch(controller)`: see below |
| Filter controls | `getFacets(columnId)`: see below. `sliderBounds(range, { steps: 100 })` gives a slider its ends and a step that a thumb can use: 1, 2 or 5 times a power of ten of the step of a cell, and about a hundred stops |
| A data sheet | The `sheet` option: see below |
| Totals | The footer row, the cells of a group row, `getTotals()`, and the `totals` option for totals that only a server knows |

## Group rows

A group row has a label cell and, from the first column with an `aggregate` on, one cell for each column: the total of the group stands under its header and over the total of the footer. The label covers the columns before that. It ends where pinned columns end, so it sticks or scrolls as one cell.

- `#group` fills the label cell. It gets `group`, `text`, `expanded`, `level`, `totals`, `totalTexts`, `toggleExpanded`, the `path` of the group (the groups above it and itself, each with `column`, `value` and `text`, for a label such as "Europe / Finland") and `covered`, the columns under the label. A total of a covered column has no cell of its own.
- `#group-total-{column id}` and `#group-total` fill a cell under a column, in the way of `#foot-{column id}` and `#foot`. They get `group`, `column`, `value`, `text`, `totals`, `expanded`, `level` and `path`. A column without an `aggregate` has an empty cell, with an empty `text`.
- `cellAttrs` gets the kind `group` for the label cell and `group-total` for the cells under a column. The cells carry `data-kind`: `group-label`, `group-total` or `group-blank`.
- `:group-totals="false"` gives one cell as wide as the table, as a table without any `aggregate` has.
- Enter on any cell of a group row opens or closes the group, and Space selects its rows. A group row holds no values: its cells are never marked as part of a cell range, and a copy gives an empty line for it.

The footer, the group rows, `getTotals` and the totals of an export read one function. A total counts the rows that pass the filters, on every page, with their child rows; a pinned row that the filter refuses is in view and not in a total. With rows from a server (`manualFilter`, `manualPage`) the table has one page of rows and its totals are of that page: pass `:totals="{ table: { amount: 1234 }, groups: { 'group/team=Design': { amount: 800 } } }"` for the totals of the server.

## Filter controls

`controller.getFacets(columnId)` answers with what a control offers. The facets follow the search and the filters of the other columns, and never the filter of the column itself. `getFacets(columnId, { rows: 'all' })` gives the facets of every row.

| Control | Read |
| --- | --- |
| A list of values | `values`: each with `value`, `text` in the format of the column, and `count`. A value that the filter names stays in the list with the count 0 when no row holds it any more. A combobox of the design system can search the list by `text`; `fuzzyScore` of `@ui-sdk/core/text-match` is the search of the table |
| A slider | `range`: `min`, `max` and `step`, the smallest change that the format of the column shows. `sliderBounds(range)` gives ends that are whole steps |
| A date picker | `days`: the first and the last day as `YYYY-MM-DD`, in the time zone of the column; `dates` holds the two moments |

A facet is counted when it is asked for, and kept until the search or another filter changes. With `manualFilter`, the rows are what the server sent; the `facets` option gives the choices of every row.

## A search field with a pause

```vue
<script setup lang="ts">
import { createTableController, Table, useTableSearch } from 'ui-sdk-table-vue'

const controller = createTableController()
const search = useTableSearch(controller)
</script>

<template>
	<input
		v-model="search.text.value"
		type="search"
		@keydown.escape="search.clear()"
		@keydown.enter="search.flush()"
	/>
	<Table :rows="people" :columns="columns" :controller="controller" :search-debounce="200" />
</template>
```

The field shows each letter at once. The table filters when the typing pauses for `searchDebounce` milliseconds (200 without the prop), with one change of `filter` and the reason `input-change`. `clear` and `setSearch` act at once and drop a text that waits, and so do `clearFilters` and a new search text from the owner of `v-model:filter`. `search.pending` says that a text waits. The table itself says nothing to a screen reader about a search: announce the rows found when `filter` changes, which is one time after the pause.

Without Vue, the same is `controller.inputSearch(text, event)`, `controller.flushSearch()`, and `search` and `searchPending` of `getView()`. `createDebounce(run, { debounce })` is the utility under it, with `call`, `cancel`, `flush` and `pending`.

## Sort modes

- `multi-sort="modifier"` (the default): a press on a header replaces the sort, and a press with Shift, Control or Command adds the column. `"none"`: one column at a time, whatever key is held. `"always"`: each press adds the column. Enter on a header follows the same rule.
- `always-sorted`: a press on the only column of the sort turns the order and never clears it. Off by default.
- `sortIndex` of the `#header` slot and `data-sort-index` of the header cell hold the place of the column in the sort, from 1, and are absent for a column that is not sorted.
- `toggleSort(event)` of the `#header` slot passes the event, and the table reads the keys. `controller.toggleSort(id, { append: true })` and `sortBy(id, direction, { append: true })` throw in the mode `none`.
- A `sort` of the owner with more columns than the mode allows is left as it is. With `manualSort`, the rules are the same: the state is the request.

## Columns back to their start

`controller.hideAllColumns()` hides every column that can be hidden, in one change; a column with `hideable: false` and a `lead` column stay, and the first column in view stays when no other would. `resetColumnVisibility()`, `resetColumnOrder()` and `resetColumnPinning()` bring a state back to what the table started with (its `default…` prop, else the empty state), with the reason `reset`. `resetColumnWidths()` takes every width away. A `v-model:column-visibility` that hides every column gives a table without columns; the table does not correct the state of its owner.

## A data sheet

```vue
<script setup lang="ts">
import { applyEdits, createTableController, Table, useTableView } from 'ui-sdk-table-vue'

const controller = createTableController()
const view = useTableView(controller)
</script>

<template>
	<button :disabled="!view?.canUndo" @click="controller.undo()">Undo</button>
	<button :disabled="!view?.canRedo" @click="controller.redo()">Redo</button>
	<Table
		:rows="rows"
		:columns="columns"
		:controller="controller"
		sheet
		@cell-edit="(edits) => (rows = applyEdits(rows, edits))"
	/>
</template>
```

`sheet` is the table with the rules of a data sheet, and a preset: `editable`, `cell-selection` and `history` are on unless one is set to false. Each of them also works alone, so `<Table editable history>` is a table with undo. Without them, a table behaves as before.

| Key | With `sheet` |
| --- | --- |
| A character on a cell | Opens the editor with that character (`mode` is `replace`) |
| Enter in the editor | Saves and moves down, with Shift up. Inside a range it walks the range column by column |
| Tab in the editor | Saves and moves to the next cell. Inside a range it walks the range row by row |
| An arrow in the editor | After a character: saves and moves one cell (reason `list-navigation`). After F2, Enter or a double press: moves the caret. F2 in the editor turns the first into the second |
| Tab on a cell | Leaves the table. With a range of more than one cell it walks the range, and Escape drops the range |
| Delete, Backspace on a cell | Empties the selected cells (reason `clear`) |
| Control or Command with X | Cuts: the text of a copy, then a clear (reason `cut`) |
| Control or Command with V | Pastes. A block repeats over a range that it fits a whole number of times |
| Control or Command with Z; with Y or Shift+Z | Undo and redo, with `history` |

- **The owner applies every change.** An undo is a report through `cell-edit` with the reason `undo` (a redo: `redo`), with the old values as `value`. An owner that puts edits into its rows with `applyEdits` needs no code for undo. `details.cancel()` refuses an undo as it refuses an edit, and the step stays.
- **`applyEdits(rows, edits, getRowId?)`** finds the row of an edit by its object, and by its id when the object was replaced already, as at the second of two reports in one turn. Pass the `getRowId` of the table when it has one.
- **A step** is one report that no listener refused: one edit, one paste, one cut, one clear, one `editCell`. Typing in an open editor is no step; there, Control+Z is the text field's. Sort, filter, column moves and selection are not in the history.
- **An undo runs no `parse` and no schema.** It puts back what the data held. A cell whose row or column left the table is skipped and counted in the announcement; a step with no cell left is dropped. Rows need stable ids.
- **Limits:** `:history="{ limit: 100, maxCells: 100000 }"` are the defaults. A step with more cells than `maxCells` empties the history, and the table says so.
- **Other data:** call `controller.clearHistory()` when the rows become another document. With `manual-page`, another page, sort or filter empties the history.
- **Empty values:** `emptyValue(row, column)` is what a clear writes: the `parse` of the column for an empty text, else `null` for a number or a date, `false` for a boolean and an empty text for the rest. It goes through the schema, and one refusal stops the whole clear.
- **Controller:** `undo()`, `redo()`, `clearHistory()`, `getHistory()`, `clearCells()`, `cutCells()` (returns the text), `selectAllCells()`, `selectCellRows(from, to?)`, `selectCellColumns(from, to?)`. `undo` and `redo` throw with the reason: no history, nothing to undo, a refused report, a check that runs.
- **View:** `canUndo`, `canRedo`, `activeCell` (`{ rowId, columnId }` or `null`) and `cellSelection` (`{ from, to, rows, columns }`, by id, data rows only).
- **Slots:** `#header` gets `selectColumn(event?)`, for a control that selects the cells of the column (with Shift, from the active cell on). `#editor` and `#edit-{id}` get `mode` (`replace` or `edit`) and `typed`, the character that opened the editor; `save(value, event)` with an Enter key moves down.
- **Attributes:** `data-sheet` on the table.
- **Messages:** `cellsCleared`, `cellsCut`, `clearRefused`, `clearNowhere`, `undone`, `redone`, `undoRefused`, `nothingToUndo`, `nothingToRedo`, `historyBusy`, `historyTooLarge`.

Not built yet: row numbers, the fill handle, the summary of a selection, the function of the sum row at run time, and formats of cells.
