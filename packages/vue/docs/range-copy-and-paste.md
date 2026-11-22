# Range, copy and paste

Let a person select a block of cells, copy it, paste into it and read its sum.

Use it with `cell-selection` for any table whose cells a person compares or moves to a spreadsheet, and with `editable` too for a table that takes a paste.

```vue title="range.vue"
<script setup lang="ts">
import {
	applyEdits,
	createTableController,
	Table,
	useSelectionSummary,
	type CellEdit,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Week = { id: string; name: string; mon: number; tue: number; wed: number }

const columns: ColumnDef<Week>[] = [
	{ id: 'name', header: 'Name', editable: false },
	{ id: 'mon', header: 'Mon', format: 'decimal' },
	{ id: 'tue', header: 'Tue', format: 'decimal' },
	{ id: 'wed', header: 'Wed', format: 'decimal' },
]

const rows = shallowRef<Week[]>([
	{ id: 'w1', name: 'Ada', mon: 7.5, tue: 8, wed: 6 },
	{ id: 'w2', name: 'Ben', mon: 8, tue: 7.5, wed: 8 },
	{ id: 'w3', name: 'Cleo', mon: 6, tue: 6, wed: 7.5 },
])

const controller = createTableController()
// Counts once the selection rests, so a long drag counts one time.
const summary = useSelectionSummary(controller)
</script>

<template>
	<Table
		:rows="rows"
		:columns="columns"
		:controller="controller"
		cell-selection
		editable
		aria-label="Hours of the week"
		@cell-edit="(edits: readonly CellEdit<Week>[]) => (rows = applyEdits(rows, edits))"
	/>
	<p data-testid="summary">
		<template v-if="summary && summary.numbers > 1">
			{{ summary.numbers }} cells, sum {{ summary.texts.sum }}, average {{ summary.texts.mean }}
		</template>
		<template v-else>Select two cells or more.</template>
	</p>
</template>
```

Press 7.50 under Mon and press Shift with the right arrow twice: three cells are selected, and the line under the table gives their sum and average. Copy with Control or Command with C, press a cell of Cleo, and paste.

## Select a range

- A drag over cells, or Shift with an arrow, selects a range.
- The cells of a range have `data-selected` and `data-range-edge` (`top`, `right`, `bottom`, `left`), so a line around a range is one rule for each side.
- The state is `cellRange`. The view gives `cellSelection` (`{ from, to, rows, columns }`), by id, data rows only.
- `controller.selectCells(from, to?)` selects from code; `selectAllCells`, `selectCellRows` and `selectCellColumns` select whole rows or columns, and move the active cell into the range.
- Escape drops the range.
- A group row holds no values: its cells are never marked as part of a range.

## Copy, cut and paste

- Control or Command with C copies the range as text, with tabs between cells and line breaks between rows. A group row gives an empty line. `controller.copyCells()` does the same.
- A copy holds the plain value of a cell, as the editor shows it, so a paste into the same columns gives the same values.
- Control or Command with V pastes. A block repeats over a range that it fits a whole number of times: copy two cells, select six, paste, and there are three copies.
- A paste is all or nothing. Each value passes the `parse` and the schema of its column; one refusal stops the paste before any cell changes.
- A paste is one report through `@cell-edit` with the reason `paste`, and one step of the history.
- Control or Command with X cuts: the text of a copy, then a clear (reason `cut`). A cut and a paste in another place move the block.
- A cell that cannot be edited keeps its value.

## A summary of the selected cells

`useSelectionSummary(controller, { debounce = 100 })` is a ref with `{ cells, count, numbers, sum, mean, min, max, texts }` or `null`.

- `cells` is how many cells of data rows are selected, `count` how many hold a value, `numbers` how many hold a number. The rest is of the numbers.
- It counts after the selection rests, so a drag over 50,000 rows counts one time. It follows an edit inside the selection.
- `texts` are in the format of the column when the selection is inside one column of numbers. Else they are plain numbers of the locale, where the average has two decimals more than the values have (`35,391.67` for whole amounts) and six at most.
- Show it in a plain element and not in a live region.
- `controller.getSelectionSummary()` is the same answer on request, kept for the same selection and rows.

## Attributes

- `data-cell-selection` on the table, `data-active` on the active cell.
- `data-selected` and `data-range-edge` on the cells of a range.

See the [Sheet tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=sheet).

## Names

- **Exports:** `useSelectionSummary`, `summarize`, and the type `SelectionSummaryOptions`.

Every option, event, slot, controller method and view field of this page is in the reference: [Table](./reference-table.md), [Controller](./reference-controller.md) and [View](./reference-view.md).
