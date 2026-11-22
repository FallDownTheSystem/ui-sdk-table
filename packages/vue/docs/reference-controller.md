# Controller

Every method of the controller that `createTableController()` makes.

Pass the controller to the table as `controller`. A method checks its arguments and throws with a message that names the valid values. An agent calls the same methods. See [Controller and view](./controller-and-view.md).

## TableController

- `sortBy` (`(columnId: string, direction?: SortDirection | null, options?: { append?: boolean }) => void`): Sorts by a column in a direction, `'asc'` by default. Without `append: true`, the column replaces the sort, whatever the `multiSort` mode. With `append`, `null` takes the column out of the sort; without it, `null` empties the sort.
- `toggleSort` (`(columnId: string, options?: { append?: boolean; event?: Event }) => void`): Sorts by a column as a press on its header does: ascending, descending, not sorted. Without `append`, the `multiSort` option of the table and the keys of the event decide whether the column joins the sort or replaces it. With `alwaysSorted`, the last column of the sort turns back to ascending and the sort is never empty.
- `setSearch` (`(text: string) => void`): Gives the table a search text at once. A text that waits from `inputSearch` is dropped.
- `inputSearch` (`(text: string, event?: Event) => void`): Takes the text of a search field while a person types. `getView().search` holds the text at once, and the table filters when the typing pauses for `searchDebounce` milliseconds. Pass the event of the field for the details of the change.
- `flushSearch` (`() => void`): Filters now by the text that waits from `inputSearch`, for example on Enter. Without one, nothing happens.
- `setColumnFilter` (`(columnId: string, value: unknown) => void`): Sets the filter of one column. A value that asks for nothing (see `isEmptyFilter`) takes the filter of the column away.
- `clearFilters` (`() => void`): Takes the search and the filter of every column away, in one change. A search text that waits from `inputSearch` goes too.
- `clearColumnFilters` (`() => void`): Takes the filter of every column away, in one change. The search stays.
- `setGroupBy` (`(columnIds: readonly string[]) => void`): Groups the rows by these columns, in this order. An empty list takes the groups away.
- `setPage` (`(page: number) => void`): Goes to a page, from 1. A page past the last goes to the last. It throws when the table has no pages or the page is not a whole number.
- `setPageSize` (`(pageSize: number | null) => void`): Gives the table pages of a size, from its first page. `null` takes the pages away: every row shows.
- `nextPage` (`() => void`): Goes to the next page. On the last page, nothing changes.
- `previousPage` (`() => void`): Goes to the page before. On the first page, nothing changes.
- `firstPage` (`() => void`): Goes to the first page.
- `lastPage` (`() => void`): Goes to the last page. It throws with `manualPage` and no `rowCount`: the table does not know its last page.
- `expand` (`(rowId: string) => void`): Opens a tree row, a group or a row with a detail row. It throws for a row that cannot open.
- `collapse` (`(rowId: string) => void`): Closes a tree row, a group or a row with a detail row. It throws for a row that cannot open.
- `toggleExpanded` (`(rowId: string, event?: Event) => void`): Opens a row that is closed and closes one that is open. Pass the event of a press for the details of the change.
- `expandAll` (`() => void`): Opens every tree row and group, in one change. A detail row stays as it is.
- `collapseAll` (`() => void`): Closes every row and group, detail rows too, in one change.
- `select` (`(rowId: string) => void`): Selects one row in place of the selection. It throws without the `selection` option, and for a row that `canSelect` refuses.
- `toggleSelected` (`(rowId: string, event?: Event) => void`): Adds a row to the selection, or takes a selected row away. Pass the event of a press for the details of the change.
- `selectAll` (`() => void`): Selects every row of the list that can be selected, in one change. It needs `selection: 'multiple'`. A selected row that the filter hides stays selected.
- `clearSelection` (`() => void`): Takes every row out of the selection.
- `setColumnVisibility` (`(columnId: string, visible: boolean) => void`): Shows or hides a column, or every column of a header group.
- `toggleColumnVisibility` (`(columnId: string) => void`): Hides a column that shows and shows one that is hidden.
- `showAllColumns` (`() => void`): Shows every column, in one change.
- `hideAllColumns` (`() => void`): Hides every column that can be hidden, in one change. A column with `hideable: false` and a column that leads the table stay. A table needs one column: when no other column would be left, the first one in view stays.
- `resetColumnVisibility` (`() => void`): Brings the hidden columns back to what the table started with: `defaultColumnVisibility`, or every column in view.
- `resetColumnOrder` (`() => void`): Brings the column order back to what the table started with: `defaultColumnOrder`, or the order of the definitions.
- `resetColumnPinning` (`() => void`): Brings the pinned columns back to what the table started with: `defaultColumnPinning`, or no pinned column.
- `moveColumn` (`(columnId: string, index: number) => void`): Moves a column to a place among the columns that can move, from 0.
- `setColumnOrder` (`(columnIds: readonly string[]) => void`): Puts the columns in this order. Columns that are not listed come after, in the order of the definitions. It throws for an id that is listed twice.
- `setColumnWidth` (`(columnId: string, width: number | null) => void`): Gives a column a width in pixels. `null` takes the width away again.
- `resetColumnWidths` (`() => void`): Takes every width that a resize or `setColumnWidth` gave away, so each column has the width of its definition again.
- `pinColumn` (`(columnId: string, side: ColumnPin | null) => void`): Pins a column to the start or the end of the table. `null` frees it.
- `pinRow` (`(rowId: string, edge: RowPin | null) => void`): Pins a row to the top or the bottom of the rows. `null` frees it.
- `scrollToRow` (`(rowId: string, align?: RowAlign) => void`): Scrolls a row into view, in one step, also when the row is not rendered yet.
- `editCell` (`(rowId: string, columnId: string, value: unknown) => void | Promise<void>`): Gives a cell a new value, with the check of its column, and reports it through `onCellEdit`. A text is read as the editor reads it. It throws with the reason when the value is refused; when the schema of the column answers with a promise, the result is a promise that rejects.
- `startEdit` (`(rowId: string, columnId: string) => void`): Opens the editor of a cell that is in view.
- `cancelEdit` (`() => void`): Closes the editor without a save.
- `selectCells` (`(from: CellRef, to?: CellRef) => void`): Selects the cells from one cell to another, or one cell. Needs the `cellSelection` option.
- `clearCellSelection` (`() => void`): Takes the range of cells away.
- `copyCells` (`() => string`): The text of the selected cells, with tabs between cells and line breaks between rows.
- `pasteCells` (`(text: string) => void | Promise<void>`): Puts tab-separated text into the cells from the first selected cell on, as a paste does. It throws with the reason when a value is refused, and then no cell changes.
- `clearCells` (`() => void | Promise<void>`): Empties the selected cells, as Delete does in a sheet: each gets the empty value of its column (`emptyValue`), with the check of the column. It throws with the reason when a column refuses an empty value, and then no cell changes. Cells that cannot be edited are left as they are.
- `cutCells` (`() => string | Promise<string>`): Empties the selected cells and returns their text, as `copyCells` gives it. A caller puts the text on the clipboard. It throws as `clearCells` does.
- `fillCells` (`(direction: FillWay, source?: number) => void | Promise<void>`): Fills the selected cells from their first line: `'down'` from the first row, `'up'` from the last row, `'forward'` from the first column, `'back'` from the last column. `source` is how many lines the fill starts from, 1 without it; with two or more, numbers and days with one step go on, and everything else repeats. Each value passes the check of its column, and one refusal stops the fill before any cell changes. It throws when the selected cells are one line in that direction.
- `selectAllCells` (`() => void`): Selects every cell of the body. Needs the `cellSelection` option.
- `selectCellRows` (`(fromRowId: string, toRowId?: string) => void`): Selects every cell of a row, or of the rows from one to another as the list shows them.
- `selectCellColumns` (`(fromColumnId: string, toColumnId?: string) => void`): Selects every cell of a column, or of the columns from one to another as the table shows them.
- `undo` (`() => void`): Takes the last change of cell values back: it reports the old values through `onCellEdit` with the reason `undo`, and the owner of the rows puts them in, as for an edit. Needs the `history` option. It throws when there is nothing to undo, when a listener refuses the report, and while the check of a value runs.
- `redo` (`() => void`): Puts the change on again that `undo` took back last, with the reason `redo`.
- `clearHistory` (`() => void`): Forgets every step. Call it when the rows become other data, such as another document.
- `getHistory` (`() => { entries: readonly HistoryEntry<TableStepReason>[]; position: number }`): The steps of the history, oldest first, and how many of them are applied: `undo` takes back the last of those.
- `setColumnAggregate` (`(columnId: string, aggregate: AggregateName | null | undefined) => void`): Chooses the function of the total of a column, in the footer, in the group rows and in an export: `sum`, `mean`, `min`, `max`, `count`, `uniqueCount` or `first`. `null` takes the total of the column away, and `undefined` gives the column the `aggregate` of its definition back.
- `getColumnFormula` (`(columnId: string) => { formula: string; text: string; error: string | null } | null`): The formula of a computed column, as a person reads it (the headers of the columns, the signs of the locale) and in the stored form, or `null` for a column without one. `error` says why the formula gives an error in every row. Needs the `formulas` option.
- `setColumnFormula` (`(columnId: string, formula: string | null) => void`): Sets the formula of a column, as a person types it or in the stored form, or takes it away with `null`: one change of `cellFormulas` and one step of the history. It throws when the formula cannot be read, reads another row, or reads its own column through other formulas. Needs the `formulas` option.
- `getAddress` (`(rowId: string, columnId: string) => string | null`): The address of a cell, such as `D7`: the letter of its column among the columns of the owner and the number of its row in the document. `null` for a column without a letter. Needs the `formulas` option.
- `cellAt` (`(address: string) => CellRef`): The cell of an address such as `D7`. It throws for an address that the table does not have. Needs the `formulas` option.
- `getCellFormula` (`(rowId: string, columnId: string) => FormulaView | null`): The formula of a cell: the stored form, the text as a person reads it, the address, the value and the words of its error. `null` for a cell without a formula of its own. Needs the `formulas` option.
- `setCellFormula` (`(rowId: string, columnId: string, formula: string | null) => void`): Gives a cell a formula, as a person types it or in the stored form, or takes it away with `null` (the cell keeps its value). One report with every cell that follows, and one step. It throws when the cell cannot hold a formula, the formula cannot be read, or it reads its own cell.
- `recalculate` (`() => number`): Computes every formula of a cell and reports each cell whose value is not the one its formula gives, with the reason `recalculate`. Returns how many cells it reported. The table does this by itself after new rows, for the cells that they change; this is for a check after a load.
- `getFormulaSummary` (`(limit?: number) => { lines: FormulaSummaryLine[]; more: number }`): The formulas as a short list: each text of a column once, with how many cells hold it. `limit` is 1 to 500, 100 by default.
- `evaluateFormula` (`(formula: string, at?: CellRef) => unknown`): The value that a formula would give at a cell, the active cell by default. Nothing is written.
- `getFormulaFunctions` (`() => readonly FormulaFunctionInfo[]`): The functions of the formulas: name, arguments as a text and as a list, one line of help, and group.
- `getRangeAddress` (`(cells?: CellPick | null) => string | null`): The text that a person types for cells: `B2`, `B2:C5`, or `B:C` for whole columns. It reads a pick of `pickedCells`, else the selected cells (the selected range, or the active cell); selected cells are whole columns when they hold every row of the document, and more than one. The corners are the first and the last cell that hold values. `null` without cells, for a column without a letter, and with `manualPage`, where no address names a row. Needs the `formulas` option.
- `movePick` (`(key: PickKey, options?: PickMoveOptions) => CellPick | null`): Moves the pick of the pick mode with an arrow key, as a field that writes a formula does it while a person points with the keys. The first move, and a move with `start`, picks the cell next to the cell of the field (the cell that is edited, else the active cell) in the direction of the key; a later move takes the pick one cell further. `extend` (Shift) keeps the first cell and grows a range, and `edge` (Control) goes to the edge of the body. The keys follow the direction of the table, as for the active cell: in a right-to-left table `ArrowLeft` goes to the next column, so a field passes the key that it got. It changes `pickedCells` with the reason `list-navigation`, scrolls the cell into view, and leaves focus, the caret, the active cell and the selected cells where they are. A first move with no cell in its direction (Up from the first row) picks nothing and returns `null`; a later move at the edge keeps the pick. Returns the pick. Needs `pickCells`; the text field of the table's own editor calls it itself.
- `getFormulaReferences` (`(text: string, at?: CellRef) => FormulaReference[]`): The references of a formula text as a person types it at a cell, the active cell by default: the place of each in the text, from `start` up to `end`, and the cells that it names by ids, from the first to the last. It reads a text that is not a whole formula yet. A field colours a reference and its cells with one colour. Needs the `formulas` option.
- `getReferenceMarks` (`(references: readonly FormulaReference[]) => (rowId: string, columnId: string) => FormulaReferenceMark | undefined`): Which of these references holds a cell, and at which edges of its block, for `cellAttrs`: give it the references of `getFormulaReferences`, then ask the function by row id and column id. It gives `undefined` for a cell that no reference holds, and for a column that leads. It reads the places in the document once, so each question is cheap, also for whole columns of 50,000 rows. Ask again when the references or the rows change. Needs the `formulas` option.
- `formatCells` (`(patch: CellFormatPatch, target?: FormatTarget) => void`): Changes the format of cells: how their values become text (`format`, `decimals`, `currency`, `dateStyle`) and how they look (`align`, `bold`, `italic`, `color`, `fill`). A key with `null` takes that property away. Without a target, the selected cells get it; when those are every row that the table has, the format goes to the whole columns and holds for rows that come later. It throws for a property, a format name or a colour that the table does not know, and lists the valid ones.
- `clearCellFormats` (`(target?: FormatTarget) => void`): Takes every format of cells away: of the target, or of the selected cells.
- `toggleCellFormat` (`(property: 'bold' | 'italic') => void`): Makes the selected cells bold or italic, for a button of a toolbar, as the keys of a sheet do: on, unless every selected cell has it, and then off.
- `getCellFormat` (`(rowId: string, columnId: string) => CellFormat`): The format that a cell has of its own: the format of its column in `cellFormats` with the format of the cell over it. An empty object when neither says anything, and for the number of a row. The `format` of the column definition is not in it.
- `getSelectionSummary` (`() => RangeSummary | null`): What the selected cells add up to: how many hold a value and a number, and the sum, the mean, the smallest and the largest of the numbers, each also as text. Counted when it is asked for, and kept for the same selection and the same rows. `null` when no cell of a data row is selected. Group rows and the numbers of the rows are left out.
- `exportData` (`(options?: ExportOptions) => ExportData`): The cells of the table as plain data, for a file: every row that passes the filters and the visible columns, or what the options ask for. The writers are in the `export` entry of the package (`toCsv`, `toXlsx`).
- `selectRows` (`(rowIds: readonly string[]) => void`): Selects rows in one change, beside the rows that are selected. It throws for a row that cannot be selected.
- `deselectRows` (`(rowIds: readonly string[]) => void`): Takes rows out of the selection in one change.
- `getView` (`() => TableView`): What the table shows now, for a control beside it: a search field, a list of columns, the pages. It answers at the time of the call; `subscribe` says when to ask again.
- `getFacets` (`(columnId: string, options?: FacetOptions) => ColumnFacets`): What a filter control of a column offers: its kind, and the values, the numbers or the dates that the column holds. They follow the search and the filters of the other columns, and never the filter of the column itself, so a filter does not take away its own choices. `rows: 'all'` gives the facets of every row of the table. A column that the `facets` option names has the facets of the owner, for both.
- `getTotals` (`(groupId?: string) => Readonly<Record<string, ColumnTotal>>`): The total of each column that has an `aggregate`, with its text in the format of the column: of the rows that pass the filters, as the footer shows them, or of one group by its id.
- `subscribe` (`(listener: (changed: readonly string[]) => void) => () => void`): Runs the listener after each change of the state, of the rows or of the columns, with the keys of the state that changed. Returns the function that stops it. A table that is destroyed stops every listener itself.

## FacetOptions

- `rows?` (`'filtered' | 'all'`): `'filtered'` (the default): the rows that pass the search and the filters of the other columns. `'all'`: every row of the table.

## ColumnFacets

- `kind` (`FilterKind`): The filter of the column: its `filter` option, or what its format says. A column of dates filters by a range of dates, a column of numbers by a range, any other column by text.
- `values` (`readonly ColumnFacetValue[]`): Each different value, sorted. Filled for the kind `select`.
- `range` (`{ min: number; max: number; step: number } | null`): The lowest and the highest number, and the step of a slider between them: the smallest change that the format of the column shows. Filled for the kind `range`. `sliderBounds` gives ends that are whole steps.
- `dates` (`{ from: Date; to: Date } | null`): The earliest and the latest date. Filled for the kind `dateRange`.
- `days` (`{ from: string; to: string } | null`): The days of `dates` as `YYYY-MM-DD`, in the zone of the column (the `timeZone` of its format options) or in local time: the days that a range of dates on this column is matched by.

## ColumnFacetValue

- `value` (`unknown`): The value as the rows hold it.
- `text` (`string`): The value as text, as a cell of the column shows it.
- `count?` (`number`): How many rows hold the value.

## ColumnTotal

- `value` (`unknown`): The total as a value.
- `text` (`string`): The total as text, with the format of the column.

## CellEdit

- `rowId` (`string`): The id of the row of the cell.
- `columnId` (`string`): The id of the column of the cell.
- `row` (`Row`): The caller's own row object, as it is before the edit.
- `column` (`ColumnDef<Row>`): The definition of the column.
- `value` (`unknown`): The new value, after `parse` and the schema of the column.
- `previous` (`unknown`): The value of the cell before the edit.
- `formula?` (`string | null`): With formulas: the formula that the cell holds now (a text in the stored form), or `null` when its formula went. Not set for a value and for a result that followed from other cells.

## CellRef

- `rowId` (`string`): The id of the row.
- `columnId` (`string`): The id of the column.

## HistoryEntry

- `id` (`number`): The number of the step: the steps of a table count up from 1.
- `reason` (`Reason`): What made the step: the reason of its edit, `shortcut` or `formula`.
- `source` (`ChangeSource`): Who made it: a person with a key or a pointer, code, or an agent.
- `cells` (`number`): How many cells got a new value. 0 for a step of formats.
- `formats` (`boolean`): Whether the step changed formats and no value.
- `formulas` (`boolean`): Whether the step changed formulas.
