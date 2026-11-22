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
	<Table :rows="people" :columns="columns" aria-label="People" />
</template>
```

## Docs

The docs are at https://falldownthesystem.github.io/ui-sdk-table/. The same pages ship in this package as Markdown in `docs`: start with `docs/llms.txt`, and `docs/README.md` lists every page.

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

`sheet` is the table with the rules of a data sheet, and a preset: `editable`, `cell-selection`, `history` and `fill-handle` are on unless one is set to false. Each of them also works alone, so `<Table editable history>` is a table with undo. Without them, a table behaves as before.

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
| Control or Command with D; with R | Fills the selected cells down from their first row; forward from their first column, with `fill-handle`. With one line selected the keys stay the browser's |
| Control or Command with B; with I | Makes the selected cells bold; italic. On, unless every selected cell has it, and then off |

- **The owner applies every change.** An undo is a report through `cell-edit` with the reason `undo` (a redo: `redo`), with the old values as `value`. An owner that puts edits into its rows with `applyEdits` needs no code for undo. `details.cancel()` refuses an undo as it refuses an edit, and the step stays.
- **`applyEdits(rows, edits, getRowId?)`** finds the row of an edit by its object, and by its id when the object was replaced already, as at the second of two reports in one turn. Pass the `getRowId` of the table when it has one.
- **A step** is one report that no listener refused: one edit, one paste, one cut, one clear, one fill, one `editCell`, and one change of formats. Typing in an open editor is no step; there, Control+Z is the text field's. Sort, filter, column moves and selection are not in the history.
- **An undo runs no `parse` and no schema.** It puts back what the data held. A cell whose row or column left the table is skipped and counted in the announcement; a step with no cell left is dropped. Rows need stable ids.
- **Limits:** `:history="{ limit: 100, maxCells: 100000 }"` are the defaults. A step with more cells than `maxCells` empties the history, and the table says so.
- **Other data:** call `controller.clearHistory()` when the rows become another document. With `manual-page`, another page, sort or filter empties the history.
- **Empty values:** `emptyValue(row, column)` is what a clear writes: the `parse` of the column for an empty text, else `null` for a number or a date, `false` for a boolean and an empty text for the rest. It goes through the schema, and one refusal stops the whole clear.
- **Controller:** `undo()`, `redo()`, `clearHistory()`, `getHistory()`, `clearCells()`, `cutCells()` (returns the text), `selectAllCells()`, `selectCellRows(from, to?)`, `selectCellColumns(from, to?)`. `undo` and `redo` throw with the reason: no history, nothing to undo, a refused report, a check that runs.
- **View:** `canUndo`, `canRedo`, `activeCell` (`{ rowId, columnId }` or `null`) and `cellSelection` (`{ from, to, rows, columns }`, by id, data rows only).
- **Slots:** `#header` gets `selectColumn(event?)`, for a control that selects the cells of the column (with Shift, from the active cell on). `#editor` and `#edit-{id}` get `mode` (`replace` or `edit`) and `typed`, the character that opened the editor; `save(value, event)` with an Enter key moves down.
- **A number keyboard on a phone.** A column with `numberKeyboard: true` holds numbers: the field of its editor gets `inputmode="decimal"`, so a phone shows its number keyboard. The `#editor` and `#edit-{id}` slots get the same answer as `inputMode` (`'decimal'` or `undefined`), for a field that an app draws itself. The table holds the attribute back where the number keyboard has no key that a person needs: in a cell that can hold a formula (it takes a text with `=`, or it is a cell of a computed column whose field shows the formula of the column; `allowFormula: false` gives the keyboard back), and in a cell whose format is set and is no number format (`integer`, `decimal`, `number`, `currency`, `percentage`), such as a cell that a person gave a date format. The field stays a text field and never `type="number"`: such a field refuses a decimal comma in some locales, a percent sign and a pasted text.
- **Attributes:** `data-sheet` on the table.
- **Messages:** `cellsCleared`, `cellsCut`, `clearRefused`, `clearNowhere`, `undone`, `redone`, `undoRefused`, `nothingToUndo`, `nothingToRedo`, `historyBusy`, `historyTooLarge`.

### Row numbers

```ts
const columns = [rowNumberColumn<Row>(), { id: 'name' }, { id: 'price' }]
```

`rowNumberColumn(options?)` is a column with `lead: true` and `rowHeader: true`: it stays first, sticks with the start pins, and is outside every range, copy, paste, fill, format and export. Its cells are `th` elements with the role `rowheader` and `data-row-header`, with the name "Row 3" (message `rowNumber`), so a screen reader says the number with each cell of the row. The number is the place of the row among the data rows, counted over the pages; group rows have none. A press on a number selects the cells of its row, with Shift the rows from the active cell on, and a drag over numbers selects those rows. The `#row-header` slot gets `{ row, node, column, number, selectRow }`. Give the cell `position: sticky; inset-inline-start: 0` and an opaque background to keep it in view without a pinned column.

### Column letters

```vue
<Table :columns="[rowNumberColumn<Row>(), ...columns]" cell-selection column-letters />
```

`column-letters` adds a row of letters above the header rows: A, B, C, then AA. It is not part of `sheet`; turn it on as you add `rowNumberColumn()`. The letters are where a person selects whole columns, as the row numbers are for rows; a press on a header still sorts, moves and resizes.

- **Pointer:** a press on a letter selects the cells of its column, with Shift the columns from the active cell to it, and a drag over letters selects those columns (it stays whole columns when the pointer goes down into the rows). The corner, the letter cell above a first column that leads, selects every column with a letter, so a column of row numbers or of checkboxes stays out. The letter cell of another column that leads is empty and selects nothing.
- **Keys:** the arrows reach the letters from the header rows. Space, Control+Space, Shift+Space and Enter select the column of a letter (every column from the corner); Shift with Left or Right grows the selection by a column, also from right to left; Control+A selects what the corner does; Escape drops the range. Delete, a cut, a copy, a fill and the format keys act on the selected cells, as from a row number. Tab leaves the table.
- **The letter** is the place of the column among the columns in view: a moved column, and the columns after a hidden one, take the letter of their new place. `lettersByColumn(layout)` gives the letters by column id; it is the one rule for them.
- **The grid:** the row of letters is grid row 0, so the header rows start at row 1, `aria-rowcount` is one more, and `cellRange` counts it. It sticks with `sticky-header`, pinned columns pin their letter, and an export does not hold it.
- **Slot:** `#letter` gets `{ column, letter, corner, selectColumn }`; `letter` is `undefined` for a column that leads. `selectColumn(event?)` selects what a press selects, and throws for a column that leads and is no corner.
- **Attributes:** the row has `data-kind="letters"`; a letter cell is a `th` with the role `columnheader`, `data-kind="letter"`, `data-column`, and `data-selected` when every row of its column is selected. The corner has `data-corner` and the name "All cells" (message `cornerCell`); the cells of leading columns have `data-lead`. `rowAttrs` gets `{ kind: 'letters' }` and `cellAttrs` gets `{ kind: 'letter', column, letter, corner }`.
- **Styling:** the row needs no style to work. A styled table gives the letters a small centred text, a look for `[data-selected]`, and an opaque background where the row sticks (`tr[data-sticky]`) or a cell is pinned (`[data-pinned]`), plus `position: sticky; inset-inline-start: 0` on `[data-corner]` when the row numbers stick that way.

### Fill

The fill handle is the part `[data-slot='table-fill-handle']`, an empty `span` inside the cell at the end corner of the selected cells. Place it with `position: absolute` at `inset-block-end` and `inset-inline-end` of its cell, which needs `position: relative`; the logical sides put it at the left corner from right to left. Give it `touch-action: none`.

- **A drag** fills along the rows or along the columns, whichever the pointer went further on. While it runs, the table has `data-filling` and each cell that would be filled has `data-fill-target` and `data-fill-edge` (`top`, `right`, `bottom`, `left`, as `data-range-edge`), so a line around the target is the same CSS as the line around a range. Near an edge of the scroll frame the table scrolls, also with a row window. Escape ends the drag and changes nothing.
- **What it writes:** a source of one line repeats. A source of two or more lines goes on when it is numbers with one step (also negative, a fraction, upward and backward) or days with one step (`2028-02-22`, `2028-02-29` goes on with `2028-03-07`); everything else repeats in its order. The step of a series is counted without the noise of floats.
- **All or nothing, one step.** Each value passes the schema of its column. One refusal stops the fill before any cell changes, and the table says which column refused which text. A fill is one report through `cell-edit` with the reason `fill` and one step of the history; its undo puts back exactly the values of before, also for rows that were sorted, filtered or removed since.
- **`fill-handle="vertical"`** or `"horizontal"` keeps the handle and the keys on one axis. `:fill-handle="false"` with `sheet` takes both away.
- **Controller:** `fillCells('down' | 'up' | 'forward' | 'back', source = 1)` fills the selected cells from their first `source` lines. It works without the `fill-handle` option, which is about the handle and the keys. It throws for one selected line, for a wrong direction (with the valid ones), and with the reason of a refusal.
- A cell that cannot be edited keeps its value and its place in the line. A fill from pinned rows into the rows of the list is refused: they are no neighbours in the data.

### A summary of the selected cells

```vue
<script setup lang="ts">
const summary = useSelectionSummary(controller)
</script>

<template>
	<p v-if="summary && summary.numbers > 1">Sum {{ summary.texts.sum }}, average {{ summary.texts.mean }}</p>
</template>
```

`useSelectionSummary(controller, { debounce = 100 })` is a ref with `{ cells, count, numbers, sum, mean, min, max, texts }` or `null`: how many cells of data rows are selected, how many hold a value, how many hold a number, and what the numbers add up to. It counts after the selection rests, so a drag over 50,000 rows counts one time, and it follows an edit inside the selection. `texts` are in the format of the column when the selection is inside one column of numbers, else plain numbers of the locale, where the average has two decimals more than the values have (`35,391.67` for whole amounts) and six at most. Show it in a plain element and not in a live region. `controller.getSelectionSummary()` is the same answer on request, kept for the same selection and rows.

### The function of a total at run time

```vue
<Table v-model:column-aggregates="aggregates" :rows="rows" :columns="columns">
	<template #foot="{ column, text, aggregate, setAggregate }">
		<MyPicker :value="aggregate" @change="(name) => setAggregate(name)" />
		{{ text }}
	</template>
</Table>
```

`columnAggregates` is a record by column id: `'sum' | 'mean' | 'min' | 'max' | 'count' | 'uniqueCount' | 'first'`, or `null` for no total. An entry wins over the `aggregate` of the column definition, and a column without an entry keeps its definition. The footer, the group rows, `getTotals` and an export follow; the footer row goes away with its last total. `setAggregate(name | null | undefined, event?)` of the `#foot` slot and `controller.setColumnAggregate(columnId, name)` change it (`undefined` gives the definition back). `#foot` and `#group-total` get `aggregate` (a name, `custom` for a function of the column, or `undefined`). A footer cell has `data-aggregate`, and a cell whose function a person chose has the name "Average: 12.40" (messages `aggregateLabel`, `totalLabel`). A change of the function is no step of the history.

### Formats of cells

```vue
<Table v-model:cell-formats="formats" :format-colors="['red', 'green']" sheet ... />
```

```ts
controller.formatCells({ bold: true, fill: 'green' })                  // the selected cells
controller.formatCells({ format: 'percentage', decimals: 1 }, { columns: ['share'] })
controller.formatCells({ fill: null }, { from: { rowId: 'a', columnId: 'price' } })
controller.clearCellFormats()
controller.toggleCellFormat('bold')                                    // for a toolbar button
controller.getCellFormat(rowId, columnId)                              // for the pressed state
```

- **The value** is `CellFormats`: `{ columns?: { [columnId]: CellFormat }, cells?: { [rowId]: { [columnId]: CellFormat } } }`. A property of a cell wins over the same property of its column, and both win over the `format` and `formatOptions` of the column definition. A format follows its row through a sort, a filter and a page. It is plain data that an app saves with its document: pass it back as `cell-formats` or `default-cell-formats`.
- **`CellFormat`:** `format` (`text`, `integer`, `decimal`, `currency`, `percentage`, `date`, `datetime`), `decimals` (0 to 10), `currency` (an ISO code), `dateStyle` (`short`, `medium`, `long`, `full`), `align` (`start`, `center`, `end`), `bold`, `italic`, `color` and `fill`. A patch with `null` for a key takes that property away. A wrong property, name or colour throws with the valid ones.
- **Looks are attributes.** A cell has `data-align`, `data-bold`, `data-italic`, `data-color`, `data-fill`, and `data-format` with the name that decides its text. The table writes no class and no style. A colour is a name of `format-colors` and nothing of CSS: the style of the app gives each name its colours for light and dark, and holds the contrast. Give a fill an opaque background, so a pinned cell with a fill hides what scrolls under it, and decide what a selected cell with a fill looks like. `cellAttrs` of the caller cannot overwrite these attributes.
- **The text** of a cell with a format is made by the format: 0.342 with `{ format: 'percentage', decimals: 1 }` reads `34.2%`. The footer and the totals of a group follow the column layer. A CSV and an Excel file hold the text of the screen; a copy holds the plain value, as the editor shows it, so a paste into the same columns gives the same values. In an Excel file a cell whose own format decides its text is written as text. The `#cell` and `#col-{id}` slots get `format`, the format that the cell has of its own, and `text`.
- **The text field shows a percentage as the screen has it.** A cell that shows `25%` opens with `25`, and `30` or `30%` in the field is 0.3, as in a column with the `percentage` format. Every other text holds the value itself: a paste, a fill and `editCell` read `0.3` as 0.3, as a copy gives it, and a text with a percent sign (`30%`) is that percentage. A column with a `parse`, or with `scale: 'percent'` in its `formatOptions`, keeps the plain value in its field. The `#editor` and `#edit-{id}` slots get the plain value as `text`, and their `save` takes a value. A search and the label of a group read the column definition and do not follow a format of a cell.
- **Whole columns.** When the selected cells are every row that the table has, `formatCells` formats the columns, so the format holds for rows that come later and the value stays small. Never with `manual-page`, where the table does not have every row. Format a column, not 50,000 cells, when the value is saved as JSON: cells that share a format share one object in memory, but JSON writes one entry for each row.
- **History.** A change of formats is one step (`getHistory()` entries have `formats: true` and `cells: 0`). An undo reports the formats of before through `update:cell-formats` and `cell-formats-change` with the reason `undo`, property by property, so a format that the owner gave another cell meanwhile stays. `details.cancel()` in `cell-formats-change` refuses a change.
- **Rows that left.** The table keeps the format of a row that is gone, because the row can come back with the next page. `pruneFormats(formats, rowIds, columnIds)` drops them when the owner knows better. `setFormats(formats, place, patch)` and `revertFormats` are the pure functions behind the controller.
- **With `v-model:cell-formats` the table renders whole at a change**, as for every prop that the owner holds. With `default-cell-formats` the table keeps the value and only the changed cells render. For a large sheet with a row window either is fast; without a window, prefer `default-cell-formats` and listen to `cell-formats-change`.

### New names of the sheet, in one list

- **Options:** `column-letters`, `fill-handle`, `column-aggregates` and `default-column-aggregates` (`v-model:column-aggregates`), `cell-formats` and `default-cell-formats` (`v-model:cell-formats`), `format-colors`; column key `rowHeader`.
- **Events:** `column-aggregates-change`, `cell-formats-change`.
- **Controller and agent actions:** `fillCells`, `setColumnAggregate`, `formatCells`, `clearCellFormats`, `toggleCellFormat`, `getCellFormat`, `getSelectionSummary`.
- **View:** `columnAggregates`, `cellFormats`.
- **Slots:** `#row-header`, `#letter`; `aggregate` and `setAggregate` in `#foot`, `aggregate` in `#group-total`, `format` in `#cell`.
- **Attributes:** `data-row-header`, `data-corner`, `data-kind="letters"` on a row and `data-kind="letter"` on a cell, `data-filling`, `data-fill-target`, `data-fill-edge`, `data-aggregate`, `data-align`, `data-bold`, `data-italic`, `data-color`, `data-fill`; the part `table-fill-handle`.
- **Messages:** `rowNumber`, `cornerCell`, `cellsFilled`, `fillRefused`, `fillNowhere`, `fillOverPinned`, `cellsFormatted`, `aggregateLabel`, `totalLabel`.
- **Exports:** `rowNumberColumn`, `columnLetter`, `lettersByColumn`, `useSelectionSummary`, `summarize`, `fillValues`, `fillLine`, `setFormats`, `revertFormats`, `pruneFormats`, `resolveFormat`, `aggregateName`, `CELL_FORMAT_NAMES`, `CELL_ALIGNS`, `CELL_DATE_STYLES`, `TableFillHandle`, and the types `CellFormat`, `CellFormats`, `CellFormatPatch`, `CellFormatName`, `FormatPlace`, `FormatTarget`, `ColumnAggregates`, `AggregateName`, `RangeSummary`, `FillWay`, `FillDirection`, `FillDraft`, `RowHeaderSlotProps`, `LetterSlotProps`, `TableStepReason`.

## Formulas

Formulas as in a spreadsheet, in two kinds. A **column formula** makes a computed column: every row gets the value of the formula of its own row, also a row that comes later, and a group, a sort, a filter and a total read it as any column. A **cell formula** belongs to one cell: the table computes it, reports the result through `cell-edit` as a plain value in the row, and reports again the cells that follow when a cell they read changes.

The engine is an entry of its own, so a table without formulas does not carry it:

```ts
import { createFormulaEngine, formulaColumn, useFormulaBar } from 'ui-sdk-table-vue/formulas'
```

`ui-sdk-table-vue/formulas` holds everything of `ui-sdk-table-core/formulas` and `useFormulaBar`. Create one engine for the life of the table; a new engine at each render computes every formula again.

### A column formula

```vue
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { formulaColumn } from 'ui-sdk-table-vue/formulas'

type Order = { id: string; product: string; price: number; qty: number }
const base: ColumnDef<Order>[] = [
	{ id: 'product', header: 'Product' },
	{ id: 'price', header: 'Price', format: 'currency' },
	{ id: 'qty', header: 'Quantity', format: 'integer' },
]
const columns = [
	...base,
	formulaColumn({ id: 'total', header: 'Total', format: 'currency', aggregate: 'sum', formula: '=[price]*[qty]' }, base),
	formulaColumn(
		{ id: 'band', header: 'Band', groupable: true, formula: '=IFS([price]<10, "small", [price]<100, "medium", TRUE, "large")' },
		base,
	),
]
</script>

<template>
	<Table :rows="orders" :columns="columns" label="Orders" />
</template>
```

`formulaColumn(definition, columns, { timeZone? })` needs no engine and no option of the table: it is a column with a `value` function. It reads the columns of its own row by id (`[price]`) or by header (`[Price]`), throws with the words that say why for a formula that cannot be read, and keeps the value of each row object, so an owner that changes a row passes a new object for it. Its cells cannot be edited.

A column formula that a person sets at run time is state instead: `cell-formulas` with a `columns` layer, and `controller.setColumnFormula(columnId, text | null)`, which throws with the words of the issue. The column is a plain column of the owner (`{ id: 'custom', header: 'Custom' }`); the formula gives it its values. It is one change of `cellFormulas` and one step of the history, and it reports no value. When the column of the owner can be edited (`editable`, or a table with `sheet` or `editable`), a cell of it opens with the formula of the column, as a person reads it (`=[Quantity]*2`): Enter on a text with `=` sets the formula of the column, as one step that Control+Z takes back, and a value is refused with words (issue `columnCell`). `editCell` still refuses a value there. A formula of the owner that cannot be read, or column formulas that read each other in a circle, show an error in every row of the column.

### A date group with the `period` format

```ts
const week = formulaColumn({ id: 'week', header: 'Week', groupable: true, sortable: true, formula: '=WEEKOF([created], 2)' }, base)
```

```vue
<Table :rows="orders" :columns="[...base, week]" :group-by="['week']" :sort="[{ id: 'week', desc: false }]" label="Orders" />
```

`WEEKOF`, `MONTHOF`, `QUARTEROF`, `YEAROF` and `DAYOF` give the first day of the period as a day (`2026-11-16`), so each period is one group, a sort puts the groups in time order, and the date filter, the facets, a fill and an export treat it as a day. `HOUROF` gives the moment at which the hour began. A column formula whose outer function gives a period gets the format `period` when its definition has no `format`: "Nov 16 – 22, 2026", "November 2026", "Q4 2026", "2026". Set it by hand with `format: 'period'` and `formatOptions: { unit: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'weekday', weekdays?, timeZone? }`; `unit: 'weekday'` writes the name of the day for a number of `WEEKDAY` (`weekdays` is the type that gave it). The label of a group is the text of the format.

- **The zone.** A date function that reads a column reads the moment on the clock of the `timeZone` of that column's `formatOptions`, so a moment that reads 23:30 on the 21st falls on the 21st. Any other date uses the `timeZone` of `formulaColumn` or of `createFormulaEngine`, else local time. Pass a zone when a saved result must be the same for every person.
- **The week.** `WEEKOF(d, [type])` takes the type of `WEEKNUM` of Excel for the first day: Sunday without it or with 1, Monday with 2 or 11, 12 to 16 Tuesday to Saturday, 17 Sunday, 21 Monday; another type gives `#NUM!`. The locale never changes what a formula computes, only what a person types and reads.

### Cell formulas

```vue
<script setup lang="ts">
import { applyEdits, createTableController, rowNumberColumn, Table, type CellFormulas } from 'ui-sdk-table-vue'
import { createFormulaEngine } from 'ui-sdk-table-vue/formulas'
import { shallowRef } from 'vue'

const engine = createFormulaEngine()
const formulas = shallowRef<CellFormulas>({ cells: { l1: { total: '=[price]*[qty]' } } })
const columns = [rowNumberColumn<Line>(), { id: 'item' }, { id: 'price' }, { id: 'qty' }, { id: 'total' }]
</script>

<template>
	<Table
		v-model:cell-formulas="formulas"
		:formulas="engine"
		:rows="lines"
		:columns="columns"
		sheet
		column-letters
		label="Lines"
		@cell-edit="(edits) => (lines = applyEdits(lines, edits))"
	/>
</template>
```

- **Typing.** A text that starts with `=` in the editor of a cell, the formula bar, a paste, a fill or `editCell` is a formula: `=C1*D1`, `=SUM(D1:D4)`, `=$C$1*D2`, `=SUM(D:D)`. A refusal keeps the editor open with the words of the issue. `'=text` is the text `=text`. A column with `allowFormula: false` keeps such a text as its value; a cell that cannot be edited, a computed column and a table with `manual-page` hold no formula. A formula that would read its own cell is refused, with its path ("D2 reads B2, and B2 reads D2").
- **Addresses** are places in the document, not on the screen: the number of a row is its place in `rows` (children after their parent), and the letter of a column its place among `columns`, without the columns that lead. A sort, a filter, a page, a pin and a move change neither: after a sort the row numbers read 7, 2, 9, and a hidden column leaves a gap in the row of letters (A, C). Without `formulas`, the numbers and the letters are places of the view, as before.
- **The stored form** holds ids, so it survives a sort and a new row before it: `=C1*D1` in row 1 is `=[price]*[qty]` ("this row"), another row is `[price@l3]`, a whole column `[price@*]`, and `$` signs stay. `.` is the decimal sign and `,` separates arguments in every locale. A person types and reads the signs of the `locale` of the table: with a decimal comma (`fi-FI`) a number is `1,5` and only `;` separates arguments. Function names are English in every locale.
- **One act, one report.** An edit reports its cell and every formula cell that follows, in order, through one `cell-edit` (`CellEdit.formula` is the formula that was set, or `null` for one that went), then `cellFormulas` changes. A listener that refuses the values refuses all of it; one that refuses the formulas keeps the values. It is one step of the history, and its undo puts the values and the formulas back without computing.
- **Fill, paste, cut, copy, clear.** A copy puts the values on the clipboard and remembers the formulas; a paste of that same text pastes the formulas, with each reference without `$` moved by the distance the cell moved (past the edge, `#REF!`). A cut moves its formulas once, unmoved. A fill gives the formula of its source to its targets, moved. Delete takes values and formulas. A paste of the formula that a cell holds is no change.
- **New rows of the owner.** After new `rows` the table checks the formula cells that they change, in a microtask, and reports the differences with the reason `recalculate`, which is no step. A row that a formula names and that is gone turns it into `#REF!`. An owner that does not take a result gets it once, not in a loop. At the mount nothing is computed: `controller.recalculate()` checks every formula cell, for a check after a load. With `manual-page` there is no check.
- **Errors** are texts in the row: `#DIV/0!`, `#VALUE!`, `#REF!`, `#NAME?`, `#NUM!`, `#N/A`, `#CYCLE!` (`FORMULA_ERRORS`, `isFormulaError`). A formula that reads an error passes it on, a sum skips it, a range filter leaves it out, and the text of the cell is the code in every format. Type a column that can hold a formula so that it can hold such a text.
- **Rendering.** A new formula renders its cell and the cells that read it, when the table holds the formulas (`default-cell-formulas`). `v-model:cell-formulas` renders the table at each change, as every prop of the owner does.

### A formula bar

```vue
<script setup lang="ts">
const controller = createTableController()
const bar = useFormulaBar(controller)
</script>

<template>
	<form @submit.prevent="bar.commit()">
		<output>{{ bar.address.value }}</output>
		<input
			:value="bar.text.value"
			:disabled="!bar.ready.value"
			:aria-invalid="!!bar.error.value"
			@input="bar.input(($event.target as HTMLInputElement).value)"
			@keydown.escape.prevent="bar.cancel()"
		/>
		<output role="status">{{ bar.error.value }}</output>
	</form>
	<Table :controller="controller" :formulas="engine" sheet ... />
</template>
```

`useFormulaBar(controller)` gives `address` (`D7`), `text` (the draft, else the formula as a person reads it, else the value as the field of the cell shows it), `error` (why the last commit was refused, in the words for a person), `dirty`, `ready` (a cell is active), `input(text)`, `commit()` (saves through `editCell`, so a text with `=` is a formula and any other text a value; returns whether it saved) and `cancel()`. A draft stays with the cell where it started, also when the active cell moves. After a commit or a cancel, give focus back to the active cell (`[data-active]`).

### An Excel file with formulas

```ts
const { downloadXlsx } = await import('ui-sdk-table-vue/export')
await downloadXlsx(controller.exportData(), 'lines', { formula: excelFormulas() })
```

`excelFormulas()` of the formulas entry is the `formula` option of `toXlsx` and `downloadXlsx`. A cell with a formula, of its own or of its column, gets the formula of the file (`<f>`) with its result beside it, when all of the formula means the same in Excel: every cell that it reads is in the file and holds there the value that it holds in the table (no day, no cell written as its text), a range is one column whose rows are in the file in the order of the document and next to each other, and each function is in `EXCEL_FUNCTIONS`. Else the cell holds its result, as without the option. The addresses are places in the file, so a sorted or filtered export keeps the formulas that read their own row. An error of a formula is an error cell of the file with the option; `#CYCLE!` stays a text. `ExportCell.formula` and `ExportRow.id` and `ExportData.document` carry the formulas to a writer of your own. A CSV holds the results.

With or without the option, a column with the format `period` whose unit is `day`, `month` or `year` is a date cell with a pattern when a spreadsheet shows the pattern as the screen does (`Nov 21, 2026`, `November 2026` and `2026` in `en-US`), else its text; a week, a quarter, an hour and a day of the week are texts.

### Functions

`controller.getFormulaFunctions()` and `FORMULA_FUNCTIONS` list each with its arguments and one line of help.

| Group | Functions |
| --- | --- |
| Operators | `+ - * / ^`, a leading `-`, `%` after a number, `&` (joins texts), `= <> < <= > >=` |
| Numbers | `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `FLOOR`, `CEILING`, `ABS`, `INT`, `MOD` |
| Conditions | `IF`, `IFS`, `SWITCH`, `AND`, `OR`, `NOT`, `IFERROR`, `ISBLANK`, `ISNUMBER`, `ISTEXT`, `ISERROR` |
| Texts | `CONCAT`, `LEN`, `LEFT`, `RIGHT`, `MID`, `UPPER`, `LOWER`, `TRIM` |
| Periods of a date | `DAYOF`, `WEEKOF(d, [type])`, `MONTHOF`, `QUARTEROF`, `YEAROF`, `HOUROF` |
| Parts of a date | `YEAR`, `QUARTER`, `MONTH`, `DAY`, `HOUR`, `MINUTE`, `WEEKDAY(d, [type])`, `ISOWEEKNUM`, `ISOYEAR` |
| Date math | `DATE(year, month, day)`, `DAYS(end, start)`, `DATEADD(date, count, unit)` |

A function whose name Excel has behaves as in Excel, with its arguments and edges: `MONTH` gives 1 to 12, `WEEKDAY` counts from Sunday by default and takes the types of Excel, `IF`, `IFS`, `SWITCH`, `AND`, `OR` and `IFERROR` read only the arguments they need. The differences:

- `DAYOF`, `WEEKOF`, `MONTHOF`, `QUARTEROF`, `YEAROF`, `HOUROF`, `QUARTER`, `ISOYEAR` and `DATEADD` are not in Excel. `DATEADD` takes the units `year`, `quarter`, `month`, `week`, `day`, `hour` and `minute`; a month at its end stays at the end of a shorter month.
- A day is a text `YYYY-MM-DD` and a moment a `Date`, not a serial number: `DATE(2026, 11, 21)` gives `2026-11-21`, and `DAYS` and the parts read both kinds. A date before 1900 gives `#NUM!`, and a year under 1900 gets 1900 added, as in Excel.
- The date functions read the clock of a zone (above); Excel has no zone.
- `#CYCLE!` is not in Excel: a circle that comes with the `cell-formulas` of the owner. Excel stores such a formula and warns; here an entry that makes a circle is refused.
- No other sheets, names, arrays, lookups, `SUMIF`, `TODAY()` or `NOW()`.

### Names

- **Options:** `formulas` (the engine), `cell-formulas` and `default-cell-formulas` (`v-model:cell-formulas`), column key `allowFormula`. `createFormulaEngine({ timeZone?, maxReads? })`: `maxReads` (5,000,000 by default) refuses one change that would read more cells, such as a running sum by ranges over 50,000 rows.
- **Value:** `CellFormulas` is `{ columns?: { [columnId]: formula }, cells?: { [rowId]: { [columnId]: formula } } }`, in the stored form: plain data that an app saves with its document. `setFormulas`, `revertFormulas`, `pruneFormulas` and `formulaAt` of the formulas entry are the pure functions behind it.
- **Events:** `cell-formulas-change` (`details.cancel()` refuses), `update:cell-formulas`; `cell-edit` with `CellEdit.formula` and the reason `recalculate` for a check.
- **Controller and agent actions:** `getCellFormula`, `setCellFormula`, `getColumnFormula`, `setColumnFormula`, `getAddress`, `cellAt`, `recalculate`, `getFormulaSummary`, `evaluateFormula`, `getFormulaFunctions`. Each throws "This table has no formulas: pass `formulas`." without an engine. `getFormulaSummary(limit?)` gives each text of a column once with its count, so an agent reads 50,000 cells as one line.
- **View:** `formulas` (the option is on), `cellFormulas`, `formula` (`FormulaView` of the active cell: `rowId`, `columnId`, `address`, `formula`, `text`, `value`, `error`, `ofColumn`).
- **Slot props:** `formula` in `#cell` and `#col-{id}` (`{ text, error?: { code, message } }`), in `#editor` and `#edit-{id}` (the formula as a person reads it; a save of a text with `=` sets a formula), and in `#header` (the formula of a computed column).
- **Attributes:** `data-formulas` on the table; `data-formula` on a cell with a formula of its own; `data-formula-error` (`div0`, `value`, `ref`, `name`, `num`, `na`, `cycle`) with the words of the error as `aria-description`; `data-formula-column` on the header and the cells of a computed column.
- **Messages:** `formulaIssue(issue)`, `formulaError(code)`, `recalculated({ cells })`. Without them, the English words of the engine (`describeFormulaIssue`).
- **Words of a refusal.** `editCell`, `setCellFormula` and `setColumnFormula` throw an `Error` whose `message` is for a developer or an agent: it names the column, the row and the text (`Column "total" refuses "=SUMM(B2)" for row "l2": No function …`). Its `cause` is a text with the words for a person, the words that the editor of the cell shows. A control beside the table shows the `cause`; `useFormulaBar().error` does that already.

  ```ts
  try {
  	controller.setColumnFormula('band', text)
  } catch (error) {
  	shown.value = error instanceof Error && typeof error.cause === 'string' ? error.cause : String(error)
  }
  ```

- **Own words for one kind of issue.** `messages.formulaIssue` gets the issue as data (`code` and its fields) and decides for every kind; `describeFormulaIssue` of the formulas entry gives the words of the engine for the rest. They reach the editor, the formula bar and the `cause` of a refusal alike:

  ```ts
  const messages = {
  	formulaIssue: (issue: FormulaIssue) =>
  		issue.code === 'unknownFunction' ? `No function ${issue.name}.` : describeFormulaIssue(issue),
  }
  ```
- **Exports of the formulas entry:** `createFormulaEngine`, `formulaColumn`, `compileRowFormula`, `parseFormula`, `printFormula`, `formulaShows`, `formulaSigns`, `describeFormulaIssue`, `FORMULA_FUNCTIONS`, `setFormulas`, `revertFormulas`, `pruneFormulas`, `formulaAt`, `excelFormulas`, `EXCEL_FUNCTIONS`, `useFormulaBar`. Of the export entry: the `formula` option of `toXlsx` and the type `XlsxFormulas`.

### What a styled table needs

- A formula bar: the address, a text field bound to `useFormulaBar`, the words of an error in a plain element with `role="status"`.
- A look for `[data-formula]` (a small mark in a corner), for `[data-formula-error]` (a colour of the alert kind; the `aria-description` as a tooltip if you want one) and for `[data-formula-column]` in a header.
- A field or a menu item for the formula of a column (`setColumnFormula`, and the `error` of `getColumnFormula`), and a list of functions from `getFormulaFunctions()`.
- A choice "group by day, week, month, quarter, year" for a date column: it sets a column formula (`=WEEKOF([created], 2)`) and `groupBy`.
- The row numbers (`rowNumberColumn()`) and `column-letters`, so a person sees the addresses that a formula names.
