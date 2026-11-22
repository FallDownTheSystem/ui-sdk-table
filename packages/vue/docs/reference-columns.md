# ColumnDef

Every key of a column definition, and the shapes of the state that names columns.

See [Columns](./column-definitions.md) for how they work together.

## ColumnDef

- `id` (`string`): The id of the column: a key of the state (sort, filter, widths) and of the slots `col-{id}`. Give each column an id of its own.
- `header?` (`string`): The text of the header. Defaults to the id.
- `key?` (`string`): The property that holds the cell value. Defaults to `id`.
- `value?` (`(row: Row) => unknown`): Computes the cell value. Wins over `key`.
- `columns?` (`readonly ColumnDef<Row>[]`): Child columns. A column with children is a header group and holds no cells.
- `sortable?` (`boolean`): Whether a press on the header sorts by the column: the header renders a button and gets `aria-sort`. Code can sort by any column with `sortBy`.
- `compare?` (`(a: unknown, b: unknown, rowA: Row, rowB: Row) => number`): Compares two values for the sort, ascending: a negative number puts `a` first. An empty value goes last in both directions and never reaches it. Without it, numbers, dates and texts of the locale.
- `filter?` (`FilterKind | FilterMatcher<Row>`): How a column filter matches. Without it, the shape of the filter value decides.
- `searchable?` (`boolean`): Whether the search reads this column. Defaults to true.
- `groupable?` (`boolean`): A mark for the controls of the app: whether a person may group by the column. The table groups by any column that `groupBy` names.
- `aggregate?` (`AggregateName | AggregateFn<Row>`): The total of the column in the footer and in the group rows: a built-in name, or a function of the values and the rows.
- `format?` (`FormatName`): How the cell value becomes text. Without it, the value is shown as it is.
- `formatOptions?` (`FormatOptions`): The options of the `format`, such as the decimals, the currency or the time zone.
- `width?` (`number`): The width in pixels that the column asks for. A resize by a person wins over it.
- `minWidth?` (`number`): The smallest width in pixels that a resize gives. Without it, the `columnMinWidth` option of the table.
- `maxWidth?` (`number`): The largest width in pixels that a resize gives. Without it, the `columnMaxWidth` option of the table.
- `resizable?` (`boolean`): Whether a person can resize the column. Without it, the `resizable` option of the table decides.
- `reorderable?` (`boolean`): Whether a person can move the column. Without it, the `reorderable` option of the table decides.
- `lead?` (`boolean`): The column leads the table: it stays before every other column, whatever the column order says, and it sticks to the start as soon as another column is pinned there. A column order and the pins do not hold it. For a top-level column that holds a control of its row, such as a checkbox.
- `rowHeader?` (`boolean`): The column holds the number of each row, and its cells are the row headers of the table: a screen reader says the number with each cell of the row. Such a column leads the table, as with `lead`, and it is outside every range of cells: a number is never copied, emptied or filled. A press on a number selects the cells of its row. See `rowNumberColumn`.
- `hideable?` (`boolean`): Whether the column can be hidden. Defaults to true.
- `editable?` (`boolean | ((row: Row) => boolean)`): Whether a person can edit the cells of the column, or which rows have a cell that can be edited. Without it, the `editable` option of the table decides.
- `numberKeyboard?` (`boolean`): Whether the editor of a cell asks a phone for its number keyboard (`inputmode="decimal"`): the cells of the column hold numbers. Off by default. The table holds it back where the field can hold a formula, and for a cell whose format is no number format.
- `allowFormula?` (`boolean`): With formulas: whether a cell of the column takes a text that starts with `=` as a formula. True by default for a cell that can be edited; a column that must keep such a text as its value sets false.
- `schema?` (`StandardSchemaV1`): Checks a new value before the table reports the edit. Any Standard Schema works: Zod, Valibot, ArkType. A value that the schema refuses keeps the editor open, with the message of the schema.
- `parse?` (`(text: string, row: Row) => unknown`): Makes the value of a cell from the text of the editor or of a paste. Without it, see `parseText`.
- `exportable?` (`boolean`): Whether an export holds the column. Defaults to true.
- `exportValue?` (`(row: Row) => unknown`): The value of a cell in an export, in place of the cell value and its format: for a column whose cell is a slot, or whose file value differs from the screen.
- `meta?` (`unknown`): Data of the app for the column. The table does not read it.

## SortRule

- `id` (`string`): The id of the column.
- `desc?` (`boolean`): Whether the column sorts descending. Without it, ascending.

## FilterState

- `search?` (`string`): The search text, which every column with `searchable` reads.
- `columns?` (`Readonly<Record<string, unknown>>`): The filter of each column, by column id. The shape of a value, or `filter` of the column, decides how it matches.

## PageState

- `page` (`number`): The page in view, from 1.
- `pageSize` (`number`): How many rows a page holds.

## ColumnPinning

- `start?` (`readonly string[]`): The ids of the columns that stay at the start edge, in order.
- `end?` (`readonly string[]`): The ids of the columns that stay at the end edge, in order.

## RowPinning

- `top?` (`readonly string[]`): The ids of the rows that stay above the others, in order.
- `bottom?` (`readonly string[]`): The ids of the rows that stay below the others, in order.
