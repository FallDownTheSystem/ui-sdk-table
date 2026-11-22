# Row numbers and letters

Give a sheet a column of row numbers and a row of column letters, where a person selects whole rows and columns.

Use them together with `cell-selection`, and always with formulas, so a person sees the addresses that a formula names.

```vue title="letters.vue"
<script setup lang="ts">
import {
	createTableController,
	rowNumberColumn,
	Table,
	useTableView,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { computed } from 'vue'

type City = { id: string; city: string; country: string; people: number }

const cities: City[] = [
	{ id: 'c1', city: 'Porto', country: 'Portugal', people: 232000 },
	{ id: 'c2', city: 'Ghent', country: 'Belgium', people: 265000 },
	{ id: 'c3', city: 'Tartu', country: 'Estonia', people: 97000 },
]

const columns: ColumnDef<City>[] = [
	// A column of row numbers: it stays first, and no range, copy or export holds it.
	rowNumberColumn<City>(),
	{ id: 'city', header: 'City' },
	{ id: 'country', header: 'Country' },
	{ id: 'people', header: 'People', format: 'integer' },
]

const controller = createTableController()
const view = useTableView(controller)
const said = computed(() => {
	const cells = view.value?.cellSelection
	return cells ? `${cells.rows} by ${cells.columns} cells` : 'Nothing selected'
})
</script>

<template>
	<Table
		:rows="cities"
		:columns="columns"
		:controller="controller"
		cell-selection
		column-letters
		aria-label="Cities"
	/>
	<p role="status">{{ said }}</p>
</template>
```

Press the letter A: the cells of City are selected and the line says 3 by 1 cells. Press the row number 2, then the row number 3 with Shift: two whole rows. The corner above the numbers selects every cell, without the numbers.

## Row numbers

```ts
const columns = [rowNumberColumn<Row>(), { id: 'name' }, { id: 'price' }]
```

- `rowNumberColumn(options?)` is a column with `lead: true` and `rowHeader: true`. It stays first, sticks with the start pins, and is outside every range, copy, paste, fill, format and export.
- Its cells are `th` elements with the role `rowheader` and `data-row-header`, with the name "Row 3" (message `rowNumber`). A screen reader says the number with each cell of the row.
- The number is the place of the row among the data rows, counted over the pages. Group rows have none. With formulas, it is the place of the row in `rows`: see [Formulas](./sheet-formulas.md).
- A press on a number selects the cells of its row, with Shift the rows from the active cell on. A drag over numbers selects those rows.
- The `#row-header` slot gets `{ row, node, column, number, selectRow }`.
- Give the cell `position: sticky; inset-inline-start: 0` and an opaque background to keep it in view without a pinned column.

## Column letters

`column-letters` adds a row of letters above the header rows: A, B, C, then AA. It is not part of `sheet`; turn it on as you add `rowNumberColumn()`. A press on a header still sorts, moves and resizes.

- **Pointer:** a press on a letter selects the cells of its column, with Shift the columns from the active cell to it. A drag over letters selects those columns, and it stays whole columns when the pointer goes down into the rows.
- **The corner** is the letter cell above a first column that leads. It selects every column with a letter, so a column of row numbers or of checkboxes stays out. The letter cell of another column that leads is empty and selects nothing.
- **The letter** is the place of the column among the columns in view: a moved column, and the columns after a hidden one, take the letter of their new place. `lettersByColumn(layout)` gives the letters by column id. With formulas a letter stays with its column: see [Formulas](./sheet-formulas.md).
- **The grid:** the row of letters is grid row 0, so the header rows start at row 1 and `aria-rowcount` is one more. It sticks with `sticky-header`, pinned columns pin their letter, and an export does not hold it.
- **Slot:** `#letter` gets `{ column, letter, corner, selectColumn }`. `letter` is `undefined` for a column that leads. `selectColumn(event?)` selects what a press selects, and throws for a column that leads and is no corner. Without the slot, the cell shows the letter.

## Keys

| Key | On a letter |
| --- | --- |
| An arrow | Reaches the letters from the header rows |
| Space, Control+Space, Shift+Space, Enter | Selects the column of the letter; every column from the corner |
| Shift with Left or Right | Grows the selection by a column, also from right to left |
| Control or Command with A | Selects what the corner does |
| Escape | Drops the range |
| Delete, a cut, a copy, a fill, the format keys | Act on the selected cells, as from a row number |
| Tab | Leaves the table |

## Attributes

- The row of letters has `data-kind="letters"`. `rowAttrs` gets `{ kind: 'letters' }`.
- A letter cell is a `th` with the role `columnheader`, `data-kind="letter"`, `data-column`, and `data-selected` when every row of its column is selected. `cellAttrs` gets `{ kind: 'letter', column, letter, corner }`.
- The corner has `data-corner` and the name "All cells" (message `cornerCell`). The cells of leading columns have `data-lead`.
- A row number has `data-row-header`.

The row of letters needs no style to work. A styled table gives the letters a small centred text, a look for `[data-selected]`, and an opaque background where the row sticks (`tr[data-sticky]`) or a cell is pinned (`[data-pinned]`). Add `position: sticky; inset-inline-start: 0` on `[data-corner]` when the row numbers stick that way.

See the [Sheet tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=sheet).

## Names

- **Attributes:** `data-row-header`, `data-corner`, `data-kind="letters"` on a row and `data-kind="letter"` on a cell.
- **Exports:** `rowNumberColumn`, `columnLetter`, `lettersByColumn`.

Every option, event, slot, controller method and view field of this page is in the reference: [Table](./reference-table.md), [Controller](./reference-controller.md) and [View](./reference-view.md).
