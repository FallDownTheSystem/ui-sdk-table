# Formulas

Compute values with formulas as in a spreadsheet: a computed column, or a formula in one cell.

Use a column formula for a value that every row has, such as a total of price and quantity. Use a cell formula for a sheet where a person types `=` into a cell. A **column formula** makes a computed column: every row gets the value of the formula of its own row, also a row that comes later, and a group, a sort, a filter and a total read it as any column. A **cell formula** belongs to one cell: the table computes it, reports the result through `@cell-edit` as a plain value in the row, and reports again the cells that follow when a cell they read changes.

```vue title="column.vue"
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { formulaColumn } from 'ui-sdk-table-vue/formulas'

type Order = { id: string; product: string; price: number; qty: number }

const orders: Order[] = [
	{ id: 'o1', product: 'Desk lamp', price: 39, qty: 4 },
	{ id: 'o2', product: 'Chair', price: 249, qty: 1 },
	{ id: 'o3', product: 'Cable', price: 6, qty: 10 },
]

const base: ColumnDef<Order>[] = [
	{ id: 'product', header: 'Product' },
	{ id: 'price', header: 'Price', format: 'decimal', sortable: true },
	{ id: 'qty', header: 'Quantity', format: 'integer' },
]

// A computed column: each row gets the value of the formula of its own row.
const columns: ColumnDef<Order>[] = [
	...base,
	formulaColumn(
		{
			id: 'total',
			header: 'Total',
			format: 'decimal',
			aggregate: 'sum',
			sortable: true,
			formula: '=[price]*[qty]',
		},
		base,
	),
	formulaColumn(
		{
			id: 'band',
			header: 'Band',
			formula: '=IFS([price]<10, "small", [price]<100, "medium", TRUE, "large")',
		},
		base,
	),
]
</script>

<template>
	<Table :rows="orders" :columns="columns" locale="en-US" aria-label="Orders" />
</template>
```

Total is the price times the quantity of its row, and Band an IFS of the price. Press Total: the column sorts like any other, and the footer adds it up.

## The entry

The engine is an entry of its own, so a table without formulas does not carry it:

```ts
import { createFormulaEngine, formulaColumn, useFormulaBar } from 'ui-sdk-table-vue/formulas'
```

`ui-sdk-table-vue/formulas` holds everything of `ui-sdk-table-core/formulas` and `useFormulaBar`. Create one engine for the life of the table: a new engine at each render computes every formula again.

## A column formula

`formulaColumn(definition, columns, { timeZone? })` needs no engine and no option of the table: it is a column with a `value` function.

- It reads the columns of its own row by id (`[price]`) or by header (`[Price]`).
- It throws with the words that say why for a formula that cannot be read.
- It keeps the value of each row object, so an owner that changes a row passes a new object for it.
- Its cells cannot be edited.

A column formula that a person sets at run time is state instead: `cell-formulas` with a `columns` layer, and `controller.setColumnFormula(columnId, text | null)`, which throws with the words of the issue.

- The column is a plain column of the owner (`{ id: 'custom', header: 'Custom' }`); the formula gives it its values.
- It is one change of `cellFormulas` and one step of the history, and it reports no value.
- When the column of the owner can be edited, a cell of it opens with the formula of the column as a person reads it (`=[Quantity]*2`). Enter on a text with `=` sets the formula of the column, as one step that Control+Z takes back. A value is refused with words (issue `columnCell`). `editCell` still refuses a value there.
- A formula of the owner that cannot be read, or column formulas that read each other in a circle, show an error in every row of the column.

## A date group with the `period` format

```ts
const week = formulaColumn(
	{ id: 'week', header: 'Week', groupable: true, sortable: true, formula: '=WEEKOF([created], 2)' },
	base,
)
```

```vue
<Table
	:rows="orders"
	:columns="[...base, week]"
	:group-by="['week']"
	:sort="[{ id: 'week', desc: false }]"
	aria-label="Orders"
/>
```

- `WEEKOF`, `MONTHOF`, `QUARTEROF`, `YEAROF` and `DAYOF` give the first day of the period as a day (`2026-11-16`). Each period is one group, a sort puts the groups in time order, and the date filter, the facets, a fill and an export treat it as a day. `HOUROF` gives the moment at which the hour began.
- A column formula whose outer function gives a period gets the format `period` when its definition has no `format`: "Nov 16 – 22, 2026", "November 2026", "Q4 2026", "2026".
- Set it by hand with `format: 'period'` and `formatOptions: { unit: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'weekday', weekdays?, timeZone? }`. `unit: 'weekday'` writes the name of the day for a number of `WEEKDAY` (`weekdays` is the type that gave it).
- The label of a group is the text of the format.
- **The zone.** A date function that reads a column reads the moment on the clock of the `timeZone` of that column's `formatOptions`, so a moment that reads 23:30 on the 21st falls on the 21st. Any other date uses the `timeZone` of `formulaColumn` or of `createFormulaEngine`, else local time. Pass a zone when a saved result must be the same for every person.
- **The week.** `WEEKOF(d, [type])` takes the type of `WEEKNUM` of Excel for the first day: Sunday without it or with 1, Monday with 2 or 11, 12 to 16 Tuesday to Saturday, 17 Sunday, 21 Monday. Another type gives `#NUM!`.

## Cell formulas and a formula bar

```vue title="cells.vue"
<script setup lang="ts">
import {
	applyEdits,
	createTableController,
	rowNumberColumn,
	Table,
	type CellEdit,
	type CellFormulas,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { createFormulaEngine, useFormulaBar } from 'ui-sdk-table-vue/formulas'
import { shallowRef, useTemplateRef } from 'vue'

// A cell that can hold a formula can hold the text of an error, such as `#DIV/0!`.
type Line = { id: string; item: string; price: number | null; qty: number | null; total?: unknown }

const lines = shallowRef<Line[]>([
	{ id: 'l1', item: 'Desk lamp', price: 39, qty: 4, total: 156 },
	{ id: 'l2', item: 'Monitor arm', price: 89, qty: 2, total: 178 },
	{ id: 'l3', item: 'Keyboard', price: 59, qty: 3, total: 177 },
	{ id: 'sum', item: 'Order total', price: null, qty: null, total: 511 },
])

const columns: ColumnDef<Line>[] = [
	rowNumberColumn<Line>(),
	{ id: 'item', header: 'Item', allowFormula: false },
	{ id: 'price', header: 'Price', format: 'decimal' },
	{ id: 'qty', header: 'Qty', format: 'integer' },
	{ id: 'total', header: 'Total', format: 'decimal' },
]

// The stored form holds ids: `[price]` is "this row", `[total@l1]` the total of row l1.
const formulas = shallowRef<CellFormulas>({
	cells: {
		l1: { total: '=[price]*[qty]' },
		l2: { total: '=[price]*[qty]' },
		l3: { total: '=[price]*[qty]' },
		sum: { total: '=SUM([total@l1]:[total@l3])' },
	},
})

// One engine for the life of the table.
const engine = createFormulaEngine()
const controller = createTableController()
const bar = useFormulaBar(controller)
const frame = useTemplateRef<HTMLElement>('frame')

// After the bar, focus goes back to the active cell.
const backToCell = () => frame.value?.querySelector<HTMLElement>('[data-active]')?.focus()
function commit() {
	if (bar.commit()) backToCell()
}
function cancel() {
	bar.cancel()
	backToCell()
}
</script>

<template>
	<form @submit.prevent="commit">
		<output data-testid="address">{{ bar.address.value || '—' }}</output>
		<input
			aria-label="Formula of the active cell"
			placeholder="Press a cell"
			:value="bar.text.value"
			:disabled="!bar.ready.value"
			:aria-invalid="!!bar.error.value"
			@input="bar.input(($event.target as HTMLInputElement).value)"
			@keydown.escape.prevent="cancel"
		/>
		<p role="status">{{ bar.error.value }}</p>
	</form>
	<div ref="frame">
		<Table
			v-model:cell-formulas="formulas"
			:formulas="engine"
			:rows="lines"
			:columns="columns"
			:controller="controller"
			locale="en-US"
			sheet
			column-letters
			aria-label="An order with formulas"
			@cell-edit="(edits: readonly CellEdit<Line>[]) => (lines = applyEdits(lines, edits))"
		/>
	</div>
</template>
```

Press the price of the Desk lamp (B1) and type 49, then Enter: its total and the order total change. Press D4 and type =SUMM(D1:D3) in the field above: the bar shows why it refuses.

- **Typing.** A text that starts with `=` in the editor of a cell, the formula bar, a paste, a fill or `editCell` is a formula: `=B1*C1`, `=SUM(D1:D4)`, `=$C$1*D2`, `=SUM(D:D)`. A refusal keeps the editor open with the words of the issue. `'=text` is the text `=text`.
- A column with `allowFormula: false` keeps such a text as its value. A cell that cannot be edited, a computed column and a table with `manual-page` hold no formula. A formula that would read its own cell is refused, with its path ("D2 reads B2, and B2 reads D2").
- **Addresses** are places in the document, not on the screen. The number of a row is its place in `rows` (children after their parent), and the letter of a column its place among `columns`, without the columns that lead. A sort, a filter, a page, a pin and a move change neither: after a sort the row numbers read 7, 2, 9, and a hidden column leaves a gap in the row of letters (A, C). Without `formulas`, the numbers and the letters are places of the view.
- **The stored form** holds ids, so it survives a sort and a new row before it: with the columns item, price, qty and total after the row numbers, `=B1*C1` in row 1 is `=[price]*[qty]` ("this row"), another row is `[price@l3]`, a whole column `[price@*]`, and `$` signs stay.
- **The locale.** In the stored form `.` is the decimal sign and `,` separates arguments, in every locale. A person types and reads the signs of the `locale` of the table: with a decimal comma (`fi-FI`) a number is `1,5` and only `;` separates arguments. Function names are English in every locale. The locale never changes what a formula computes.
- **One act, one report.** An edit reports its cell and every formula cell that follows, in order, through one `@cell-edit` (`CellEdit.formula` is the formula that was set, or `null` for one that went), then `cellFormulas` changes. A listener that refuses the values refuses all of it; one that refuses the formulas keeps the values. It is one step of the history, and its undo puts the values and the formulas back without computing.
- **Fill, paste, cut, copy, clear.** A copy puts the values on the clipboard and remembers the formulas. A paste of that same text pastes the formulas, with each reference without `$` moved by the distance the cell moved (past the edge, `#REF!`). A cut moves its formulas once, unmoved. A fill gives the formula of its source to its targets, moved. Delete takes values and formulas. A paste of the formula that a cell holds is no change.
- **New rows of the owner.** After new `rows` the table checks the formula cells that they change, in a microtask, and reports the differences with the reason `recalculate`, which is no step. A row that a formula names and that is gone turns it into `#REF!`. An owner that does not take a result gets it once, not in a loop. At the mount nothing is computed: `controller.recalculate()` checks every formula cell, for a check after a load. With `manual-page` there is no check.
- **Errors** are texts in the row: `#DIV/0!`, `#VALUE!`, `#REF!`, `#NAME?`, `#NUM!`, `#N/A`, `#CYCLE!` (`FORMULA_ERRORS`, `isFormulaError`). A formula that reads an error passes it on, a sum skips it, a range filter leaves it out, and the text of the cell is the code in every format. Type a column that can hold a formula so that it can hold such a text.
- **Rendering.** A new formula renders its cell and the cells that read it, when the table holds the formulas (`default-cell-formulas`). `v-model:cell-formulas` renders the table at each change, as every prop of the owner does.

`useFormulaBar(controller)` gives:

- `address` (`D7`) and `ready` (a cell is active);
- `text`: the draft, else the formula as a person reads it, else the value as the field of the cell shows it;
- `error`: why the last commit was refused, in the words for a person;
- `dirty`, `input(text)`, `cancel()`, and `commit()`, which saves through `editCell` (a text with `=` is a formula and any other text a value) and returns whether it saved.

A draft stays with the cell where it started, also when the active cell moves. After a commit or a cancel, give focus back to the active cell (`[data-active]`).

## Functions

`controller.getFormulaFunctions()` and `FORMULA_FUNCTIONS` list each with its arguments and one line of help.

| Group | Functions |
| --- | --- |
| Operators | `+ - * / ^`, a leading `-`, `%` after a number, `&` (joins texts), `= <> < <= > >=` |
| Numbers | `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `FLOOR`, `CEILING`, `ABS`, `INT`, `MOD` |
| Conditions | `IF`, `IFS`, `SWITCH`, `AND`, `OR`, `NOT`, `IFERROR`, `IFNA`, `ISBLANK`, `ISNUMBER`, `ISTEXT`, `ISERROR` |
| Ranges with criteria | `COUNTIF`, `COUNTIFS`, `SUMIF`, `SUMIFS`, `AVERAGEIF`, `AVERAGEIFS`, `COUNTBLANK` |
| Lookups | `XLOOKUP`, `VLOOKUP`, `INDEX`, `MATCH` |
| Texts | `CONCAT`, `TEXTJOIN`, `LEN`, `LEFT`, `RIGHT`, `MID`, `UPPER`, `LOWER`, `TRIM`, `SUBSTITUTE`, `FIND`, `SEARCH`, `VALUE`, `TEXT` |
| Periods of a date | `DAYOF`, `WEEKOF(d, [type])`, `MONTHOF`, `QUARTEROF`, `YEAROF`, `HOUROF` |
| Parts of a date | `YEAR`, `QUARTER`, `MONTH`, `DAY`, `HOUR`, `MINUTE`, `WEEKDAY(d, [type])`, `ISOWEEKNUM`, `ISOYEAR` |
| Date math | `DATE(year, month, day)`, `DAYS(end, start)`, `DATEADD(date, count, unit)`, `EOMONTH(date, months)`, `TODAY()`, `NOW()` |

A function whose name Excel has behaves as in Excel, with its arguments and edges: `MONTH` gives 1 to 12, `WEEKDAY` counts from Sunday by default and takes the types of Excel, `IF`, `IFS`, `SWITCH`, `AND`, `OR` and `IFERROR` read only the arguments they need. The differences:

- `DAYOF`, `WEEKOF`, `MONTHOF`, `QUARTEROF`, `YEAROF`, `HOUROF`, `QUARTER`, `ISOYEAR` and `DATEADD` are not in Excel. `DATEADD` takes the units `year`, `quarter`, `month`, `week`, `day`, `hour` and `minute`; a month at its end stays at the end of a shorter month.
- A day is a text `YYYY-MM-DD` and a moment a `Date`, not a serial number: `DATE(2026, 11, 21)` gives `2026-11-21`, and `DAYS` and the parts read both kinds. A date before 1900 gives `#NUM!`, and a year under 1900 gets 1900 added, as in Excel.
- The date functions read the clock of a zone (above); Excel has no zone.
- `#CYCLE!` is not in Excel: a circle that comes with the `cell-formulas` of the owner. Excel stores such a formula and warns; here an entry that makes a circle is refused.
- **Criteria** of `COUNTIF` and its family are those of Excel: `5`, `">5"`, `"<>done"`, `""` for the empty cells, `"a*"` and `"?"` as wildcards and `~` before one of them; capital and small letters are the same, and a criterion of a number takes a text of that number. A date is no number here, so a day text in a criterion (`">2026-01-31"`) compares with the days of a range, and a number never takes a date. The ranges of one call have the same rows and columns: `SUMIF` and `AVERAGEIF` give `#VALUE!` where Excel would stretch a smaller range of values.
- **Lookups** give one cell. A result that Excel spills into the cells beside it, such as `XLOOKUP` with results of two columns or `INDEX` with a row or a column 0 of a range of more than one, is `#VALUE!`. A value matches a cell of its own kind only. `MATCH` and `VLOOKUP` with an approximate match, and `XLOOKUP` with the search `2` or `-2`, give what Excel gives on sorted data; Excel searches such data in halves, and on data that is not sorted it can give another cell, where these look at every cell. A lookup of an empty value is `#N/A`.
- **`VALUE`** reads a text as a formula reads a number: `12.5`, `-3`, `1e3`, with spaces around it. It reads no comma of thousands, no currency, no percent and no date, in any locale: those are `#VALUE!`.
- **`TEXT`** knows these codes, the same in every locale. A number: `0`, `#`, the decimal point, a comma between the digits (thousands, as in `#,##0.00`) and `%`. A date: `yy`, `yyyy`, `m` to `mmmmm`, `d` to `dddd` (the months and days in English), `h`, `hh`, `m` and `mm` after an hour or before a second (the minutes), `s`, `ss` and `AM/PM`. Both take text in quotes, a character after `\`, a space and the characters `$-+()/:` (and `.` and `,` in a date); `General` gives the plain text. Any other code is `#VALUE!`: no colours, no sections with `;`, no `E+`, no comma at the end. A date with a number code and a number with a date code are `#VALUE!`, because a date is no number here. A half goes away from zero.
- **`TODAY()` and `NOW()`** hold the moment when they were computed: after an entry, after rows came or went, or at `controller.recalculate()`. Nothing computes them on a timer and a render does not. `TODAY()` is the day in the zone of the formula (`timeZone` of the engine), `NOW()` a `Date`. A test passes a clock: `createFormulaEngine({ now: () => Date.UTC(2026, 10, 22) })`.
- **Left out:** `FILTER`, `UNIQUE`, `SORT`, `SORTBY`, `SEQUENCE` and `TRANSPOSE` give a list that Excel spills into the cells beside the formula; a cell of the table holds one value and the rows belong to the owner. `SUBTOTAL` skips the rows that a filter hides; a formula reads places of the document and never the view, and the footer, `getTotals` and the selection summary already follow the filter. No other sheets, names or arrays.


## What a styled table needs

- A formula bar: the address, a text field bound to `useFormulaBar`, the words of an error in a plain element with `role="status"`.
- A look for `[data-formula]` (a small mark in a corner), for `[data-formula-error]` (a colour of the alert kind; the `aria-description` as a tooltip if you want one) and for `[data-formula-column]` in a header.
- A field or a menu item for the formula of a column (`setColumnFormula`, and the `error` of `getColumnFormula`), and a list of functions from `getFormulaFunctions()`.
- A choice "group by day, week, month, quarter, year" for a date column: it sets a column formula (`=WEEKOF([created], 2)`) and `groupBy`.
- The row numbers (`rowNumberColumn()`) and `column-letters`, so a person sees the addresses that a formula names.

## Attributes

- `data-formulas` on the table.
- `data-formula` on a cell with a formula of its own.
- `data-formula-error` (`div0`, `value`, `ref`, `name`, `num`, `na`, `cycle`) with the words of the error as `aria-description`.
- `data-formula-column` on the header and the cells of a computed column.

See the [Formula tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=formula).

## Names

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
