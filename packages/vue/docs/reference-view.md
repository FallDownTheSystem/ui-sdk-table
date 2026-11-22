# View

Every field of `getView()`, the plain data that the controls beside a table read.

Read the view again in `subscribe`, or with `useTableView(controller)`. See [Controller and view](./controller-and-view.md).

## TableView

- `sort` (`readonly SortRule[]`): The sort: the columns in the order in which they sort.
- `filter` (`FilterState`): The filter: the search and the filter of each column.
- `search` (`string`): The text that a search field shows: the text that waits from `inputSearch`, else the search of the filter.
- `searchPending` (`boolean`): Whether a text from `inputSearch` waits for its pause, so the rows do not follow `search` yet.
- `groupBy` (`readonly string[]`): The ids of the columns that group the rows, in order.
- `expanded` (`readonly string[]`): The ids of the open tree rows, groups and rows with a detail row.
- `selected` (`readonly string[]`): The ids of the selected rows.
- `page` (`number`): The page in view, from 1. A table without pages has one page.
- `pageSize` (`number | undefined`): How many rows a page holds, or `undefined` for a table without pages.
- `pageCount` (`number`): How many pages there are. A table without pages has one.
- `rowCount` (`number`): How many entries the pages divide: what `pageUnit` names. With pages from a server, its `rowCount`.
- `pageUnit` (`PageUnit`): What the pages count. `rows`: each row. `groups`: each group, with its rows on the page of the group. `parents`: each top-level row, with its child rows on the same page. `mixed`: groups, and rows outside every group.
- `dataRowCount` (`number`): How many data rows pass the filters, child rows too. With `rows`, it is `rowCount`.
- `lastPageKnown` (`boolean`): Whether the last page is known. It is not for pages from a server that gave no count.
- `columns` (`readonly ColumnDef[]`): Every column that holds cells, hidden ones too, in definition order.
- `visibleColumns` (`readonly ColumnDef[]`): The columns in view, in display order.
- `selectable` (`readonly string[]`): The ids of the rows that `selectAll` selects: the rows that pass the filters and can be selected.
- `hasExpandable` (`boolean`): Whether the table has a group or a row with child rows: what `expandAll` opens.
- `hasExpanded` (`boolean`): Whether one of them is open now. An id in `expanded` that no group or row has any more does not count.
- `loading` (`boolean`): The `loading` option: whether new rows are on their way.
- `columnAggregates` (`ColumnAggregates`): The functions of the totals that were chosen at run time, by column id.
- `cellFormats` (`CellFormats`): The formats of cells and columns that were set at run time.
- `formulas` (`boolean`): Whether the table has the `formulas` option.
- `cellFormulas` (`CellFormulas`): The formulas of the table.
- `formula` (`FormulaView | null`): The formula of the active cell or of its column, for a formula bar. `null` without formulas and without an active cell.
- `canUndo` (`boolean`): Whether `undo` has a step to take back. Always false without the `history` option.
- `canRedo` (`boolean`): Whether `redo` has a step to bring back. Always false without the `history` option.
- `activeCell` (`CellRef | null`): The cell that has the tab stop, when it is a cell of a data row.
- `cellSelection` (`CellSelectionView | null`): The selected cells of a table with `cellSelection`: the range, or the active cell alone. `null` when no cell of a data row is selected.

## CellSelectionView

- `from` (`CellRef`): The first selected cell that holds a value, at the top and the start.
- `to` (`CellRef`): The last selected cell that holds a value, at the bottom and the end.
- `rows` (`number`): How many data rows the selection covers.
- `columns` (`number`): How many columns the selection covers.

## RangeSummary

- `cells` (`number`): How many cells of data rows the selection holds.
- `count` (`number`): How many of them hold a value.
- `numbers` (`number`): How many hold a number. The four values after it are of these cells.
- `sum` (`number`): The sum of the numbers. 0 without a number.
- `mean` (`number | undefined`): The mean of the numbers, or `undefined` without a number.
- `min` (`number | undefined`): The smallest number, or `undefined` without a number.
- `max` (`number | undefined`): The largest number, or `undefined` without a number.
- `texts` (`{ sum: string; mean: string; min: string; max: string }`): Each value as text: in the format of the column when the selection is inside one column that shows numbers, else as a plain number of the locale, where the mean has the decimals of `meanDecimals`. An empty text for a value that does not exist.

## TableSearch

What `useTableSearch(controller)` gives.

- `text` (`WritableComputedRef<string>`): The text of the search field, for `v-model`. A new text shows at once, and the table filters when the typing pauses (`searchDebounce` of the table). A search text that the table gets from elsewhere shows here too.
- `pending` (`Readonly<ShallowRef<boolean>>`): Whether a text waits for its pause, so the rows do not follow the field yet.
- `clear` (`() => void`): Empties the search at once, for a clear button and for Escape.
- `flush` (`() => void`): Filters now by the text that waits, for Enter.

## EditDraft

What `useEditDraft` gives.

- `rows` (`ComputedRef<Row[]>`): The rows to pass to the table: the rows of the owner with the values of the draft in them.
- `count` (`ComputedRef<number>`): How many cells hold another value than the rows of the owner.
- `changed` (`(rowId: string, columnId: string) => boolean`): Whether a cell holds another value than the rows of the owner, by the row id and the column id.
- `onCellEdit` (`(edits: readonly CellEdit<Row>[]) => void`): Pass it as the `cell-edit` listener of the table. It takes every report: an edit, a paste, a fill, a clear and an undo. It throws for an edit of a row that is not in the rows of the owner, such as a child row.
- `save` (`() => CellEdit<Row>[]`): The edits against the rows of the owner, one for each cell that differs, and an empty draft.
- `cancel` (`() => void`): Empties the draft.

## EditDraftOptions

- `getRowId?` (`(row: Row, index: number, parent: null) => string | number`): The `getRowId` of the table, when it has one. Without it, a row is found by its `id`, else by its place.

## Rows

### DataRow

- `kind` (`'row'`): Always `'row'`: a row of the data.
- `id` (`string`): The id of the row, from `getRowId`.
- `row` (`Row`): The row object of the data, as the owner passed it.
- `index` (`number`): Position among its siblings in the source data.
- `depth` (`number`): Tree depth in the source data, 0 for a top-level row.
- `parentId` (`string | null`): The id of the tree row above this row, or `null`.
- `children?` (`readonly DataRow<Row>[]`): The child rows, for a tree row.

### GroupRow

- `kind` (`'group'`): Always `'group'`: a group of rows.
- `id` (`string`): The id of the group, such as `group/team=Design`. `expanded` holds it.
- `columnId` (`string`): The id of the column that makes the group.
- `value` (`unknown`): The value of that column that the rows of the group share.
- `depth` (`number`): Grouping level, 0 for the first `groupBy` column.
- `parentId` (`string | null`): The id of the group above this one, or `null`.
- `parent` (`GroupRow<Row> | null`): The group that holds this group, or `null` for a group of the first `groupBy` column.
- `children` (`readonly TableRow<Row>[]`): The groups or the rows right under this group.
- `leaves` (`readonly DataRow<Row>[]`): Every data row under the group, in order, without their tree children.

### GroupPathEntry

- `group` (`GroupRow<Row>`): The group.
- `column` (`ColumnDef<Row> | undefined`): The column that the group is made from. `undefined` when the table has no such column any more.
- `value` (`unknown`): The value that the rows of the group share.
- `text` (`string`): The value as text, with the format of its column.
