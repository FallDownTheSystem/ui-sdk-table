# Table

Every prop, event and slot of `Table`, with the props that each slot gets.

Props are written in camel case here; a template takes them in kebab case (`default-sort`). Each state has three members: `<key>` controls it, `default<Key>` starts it when the table holds it, and the event `<key>Change` (`@sort-change`) reports a change that `details.cancel()` can stop. `v-model:<key>` binds the first and `update:<key>`. See [State and events](./state-and-events.md).

## Props

- `rows?` (`readonly Row[]`): The rows of the table. Each row needs a stable id (see `getRowId`). The table never changes or copies a row.
- `columns?` (`readonly ColumnDef<Row>[]`): The columns, in the order of the definitions. A column with `columns` is a header group.
- `getRowId?` (`(row: Row, index: number, parent: DataRow<Row> | null) => string | number`): A stable id for a row. Without it, the `id` property of the row is used.
- `getChildren?` (`(row: Row) => readonly Row[] | undefined`): The child rows of a row. With it, the table is a tree.
- `locale?` (`string`): The locale of the texts that the table writes: numbers, dates, the search without case, and the signs of a formula that a person types. Without it, the formats use `en-US`. A format whose `formatOptions` has a `locale` keeps its own.
- `searchMode?` (`'contains' | 'fuzzy'`): How the search matches. `'contains'` (the default): the text of a cell holds the search, without case. `'fuzzy'`: the letters of the search are in the text in order.
- `fuzzyThreshold?` (`number`): With `searchMode: 'fuzzy'`, the score that a match must pass, from 0 to 1. Defaults to 0: every match in order passes.
- `sortChildren?` (`boolean`): Also sort the tree children of each row. Defaults to true.
- `canGroup?` (`(row: Row) => boolean`): Which rows go into groups. A row that it refuses stays out of every group and comes first, before the groups.
- `selection?` (`'single' | 'multiple'`): Row selection. Without it, rows cannot be selected.
- `canSelect?` (`(row: Row) => boolean`): Which rows can be selected. A row that it refuses has no selection, and `select` throws for it.
- `resizable?` (`boolean`): Whether a person can resize columns. A column can say otherwise. Defaults to false.
- `reorderable?` (`boolean`): Whether a person can move columns. A column can say otherwise. Defaults to false.
- `columnMinWidth?` (`number`): The smallest width of a column that has no `minWidth`, in pixels. Defaults to 48.
- `columnMaxWidth?` (`number`): The largest width of a column that has no `maxWidth`, in pixels. Without it, no limit.
- `messages?` (`Partial<TableMessages>`): Texts of the table in another language, or with other words.
- `controller?` (`TableController`): Gives the actions of the table to code outside it. Create one with `createTableController()`.
- `multiSort?` (`MultiSortMode`): Whether a press on a header can add its column to the sort. `'none'`: one column at a time, and a modifier key changes nothing. `'modifier'` (the default): a press with Shift, Control or Command adds the column. `'always'`: each press adds the column. Enter on a header follows the same rule. A `sort` that the owner sets is never cut to the mode.
- `alwaysSorted?` (`boolean`): Whether the table keeps a sort once it has one. With it, a press on the only column of the sort turns the order, ascending and descending, and never takes the sort away. Without it, the third press does. Defaults to false. It does not sort a table that starts without a sort; give `defaultSort` for that.
- `searchDebounce?` (`number`): How long the typing in a search field must pause before the table filters, in milliseconds, for a text from `inputSearch`. Defaults to 200. With 0, each text filters at once.
- `groupTotals?` (`boolean`): Whether a group row shows the total of each column in a cell under that column, as the footer does. The label of the group then covers the columns before the first total. It applies while a column in view has an `aggregate`; without one, and with `false`, a group row is one cell as wide as the table. Defaults to true.
- `totals?` (`TableTotalsSource`): Totals as the owner of the rows knows them. The footer, the group rows, `getTotals` and the totals of an export show them in place of what the rows of the table give. For rows from a server: the table has one page of them, and its own totals are of that page.
- `sort?` (`readonly SortRule[]`): The sort: the columns in the order in which they sort. Pass it to control the sort.
- `defaultSort?` (`readonly SortRule[]`): The `sort` at first, when the table holds this state itself.
- `filter?` (`FilterState`): The search and the filter of each column. Pass it to control the filter.
- `defaultFilter?` (`FilterState`): The `filter` at first, when the table holds this state itself.
- `groupBy?` (`readonly string[]`): The ids of the columns that group the rows, outermost first. Pass it to control the groups.
- `defaultGroupBy?` (`readonly string[]`): The `groupBy` at first, when the table holds this state itself.
- `page?` (`PageState`): With a page, the table shows one page of rows. Without it, all rows.
- `defaultPage?` (`PageState`): The `page` at first, when the table holds this state itself.
- `expanded?` (`readonly string[]`): The ids of the expanded tree rows and groups.
- `defaultExpanded?` (`readonly string[]`): The `expanded` at first, when the table holds this state itself.
- `selected?` (`string[]`): The ids of the selected rows.
- `defaultSelected?` (`string[]`): The `selected` at first, when the table holds this state itself.
- `columnVisibility?` (`ColumnVisibility`): Columns with `false` are hidden. The id of a header group hides all its columns.
- `defaultColumnVisibility?` (`ColumnVisibility`): The `columnVisibility` at first, when the table holds this state itself.
- `columnOrder?` (`readonly string[]`): Column ids in display order. Columns that are not listed come after, in definition order.
- `defaultColumnOrder?` (`readonly string[]`): The `columnOrder` at first, when the table holds this state itself.
- `columnWidths?` (`ColumnWidths`): Column widths in pixels, by column id. A column without an entry has the width of its definition.
- `defaultColumnWidths?` (`ColumnWidths`): The `columnWidths` at first, when the table holds this state itself.
- `columnPinning?` (`ColumnPinning`): The columns that stay at the start or the end edge while the rest scrolls.
- `defaultColumnPinning?` (`ColumnPinning`): The `columnPinning` at first, when the table holds this state itself.
- `rowWindow?` (`boolean`): Render only the rows near the scroll frame, with a spacer for the rest. The frame is the nearest parent that scrolls, or the page. Defaults to false.
- `rowHeight?` (`number`): One height for every row, in pixels. Without it, the row window measures each row. With `hasDetail` it measures too, because a detail row has a height of its own, and this height is what a row counts with before.
- `estimatedRowHeight?` (`number`): The height of a row that the row window did not measure yet, in pixels. Defaults to 36.
- `overscan?` (`number`): How many rows more than the frame shows the row window renders on each side. Defaults to 8.
- `stickyHeader?` (`boolean`): Whether the header rows stay at the top of the scroll frame. Defaults to false.
- `stickyFooter?` (`boolean`): Whether the footer row stays at the bottom of the scroll frame. Defaults to false.
- `hasDetail?` (`(row: Row) => boolean`): Which rows have a detail row: one wide row under the row, which opens and closes as a tree row does. Pass the same function while its answers are the same: a new function makes the table list its rows again.
- `rowPinning?` (`RowPinning`): The rows that stay at the top or the bottom edge. A filter or a page does not hide them. The totals are of the rows that pass the filter, so a pinned row that the filter refuses is in view and not in the totals. A row with child rows cannot be pinned.
- `defaultRowPinning?` (`RowPinning`): The `rowPinning` at first, when the table holds this state itself.
- `columnAggregates?` (`ColumnAggregates`): The function of the total of a column where a person chose one, by column id: `sum`, `mean`, `min`, `max`, `count`, `uniqueCount` or `first`. An entry wins over the `aggregate` of the column, and `null` takes the total of the column away. The footer, the group rows, `getTotals` and an export all follow it. With `totals` of the owner, the owner hears the change and gives the number of the chosen function.
- `defaultColumnAggregates?` (`ColumnAggregates`): The `columnAggregates` at first, when the table holds this state itself.
- `cellFormats?` (`CellFormats`): The formats of cells and of whole columns: how a value becomes text and how the cell looks, by row id and column id. A property of a cell wins over the same property of its column, and both win over the `format` of the column definition. The looks reach a cell as `data-align`, `data-bold`, `data-italic`, `data-color` and `data-fill`, and the style of the app gives them a meaning. The value is reported whole and shares what did not change, so an owner saves it as it is. Colour alone must not carry a meaning: a screen reader says the text of a cell, not its looks.
- `defaultCellFormats?` (`CellFormats`): The `cellFormats` at first, when the table holds this state itself.
- `formulas?` (`FormulaEngine`): Turns formulas on: the value of `createFormulaEngine()` of the entry `ui-sdk-table-core/formulas`. Pass one engine for the life of the table; a new engine at each render computes every formula again.
- `cellFormulas?` (`CellFormulas`): The formulas of the table, as data of the owner, in the stored form. `columns` makes a column computed: each row gets the value of the formula, also a row that comes later, and its cells cannot be edited. A formula that cannot be read, or column formulas that read each other in a circle, show an error in every row. Read only with `formulas`.
- `defaultCellFormulas?` (`CellFormulas`): The `cellFormulas` at first, when the table holds this state itself.
- `formatColors?` (`readonly string[]`): The names that `color` and `fill` of a cell format can have, such as `['red', 'amber', 'green']`. The table writes a name into `data-color` or `data-fill`, and the style of the app maps it to its own colours for light and dark. Without the option, a format can carry no colour.
- `sheet?` (`boolean`): The rules of a data sheet. In the editor, Enter saves and moves down (with Shift up), and an arrow key saves and moves when a character opened the editor. Inside a selected range, Enter and Tab walk the range and Tab on a cell stays in it; without a range, Tab on a cell leaves the table as before. Delete and Backspace empty the selected cells, a cut empties them too, and a paste repeats a block that fits the range a whole number of times. It is also a preset: `editable`, `cellSelection` and `history` are on unless one of them is set to false. Defaults to false.
- `history?` (`boolean | TableHistoryOptions`): Undo and redo for cell values: Control or Command with Z, and with Shift+Z or Y, on a cell, and `undo` and `redo` of the controller. A step is one report of `onCellEdit` that no listener refused. An undo reports the old values through `onCellEdit` with the reason `undo`, without `parse` and without the schema, and the owner of the rows puts them in. Rows need stable ids for it. With `manualPage`, a change of the page, the sort or the filter empties the history. Pass limits in place of `true` to change them. Defaults to the `sheet` option.
- `fillHandle?` (`boolean | 'vertical' | 'horizontal'`): The fill handle: a small part at the corner of the selected cells that a person drags to fill more cells, and with `sheet` the keys Control+D (fill down) and Control+R (fill forward). `'vertical'` and `'horizontal'` let a fill go along one axis only. Needs cell selection. Defaults to the `sheet` option.
- `editable?` (`boolean`): Whether a person can edit cells. A column can say otherwise. Defaults to the `sheet` option, else to `entry`.
- `entry?` (`boolean`): A mode for entering data, which an app can turn on and off, for example with an Edit button. While it is on, cells can be edited unless `editable` is false or a column says otherwise, one plain press on a cell opens its editor, and Tab and Shift+Tab on a cell and in the editor go to the next and the previous cell that can be edited, across the rows. From the last such cell Tab leaves the table, and from the first Shift+Tab. Inside a selected range of more than one cell, Tab keeps the rule of the range. Defaults to false.
- `cellSelection?` (`boolean`): Whether a person can select a range of cells, to copy it or to paste into it. Defaults to the `sheet` option.
- `columnLetters?` (`boolean`): A row of letters above the header rows, as a spreadsheet has: A, B, C, then AA. It is the place where a person selects whole columns, as the row numbers of `rowNumberColumn()` are for whole rows: a press on a letter selects the cells of its column, with Shift the columns from the active cell to it, and a drag over letters selects those columns. Space on a letter selects its column, and Shift with an arrow takes the next columns. The cell above the row numbers selects every cell. A column that leads the table has an empty letter cell that selects nothing. A letter is the place of the column among the columns in view. The row is grid row 0: it counts in `aria-rowindex`, `aria-rowcount` and the rows of `cellRange`, and it sticks with `stickyHeader`. An export does not hold it. Selecting needs `cellSelection`; this option is not part of `sheet`. Defaults to false.
- `cellRange?` (`CellRange | null`): The selected range of cells, from the cell where it started to the cell it reaches, or `null`. A cell is a place in the grid: `row` counts the header rows first, as `aria-rowindex` does, from 0. A range holds body rows only. It goes away when other rows or columns come to its places.
- `defaultCellRange?` (`CellRange | null`): The `cellRange` at first, when the table holds this state itself.
- `manualSort?` (`boolean`): The rows come from a server in sort order. The table does not sort them. The `sort` state still changes, so the caller knows what to ask for.
- `manualFilter?` (`boolean`): The rows come from a server with the search and the column filters applied. The table does not filter them. Facets and totals are of the rows that the table has; give `facets` for the choices of every row, and `totals` for the totals of every row.
- `facets?` (`Readonly<Record<string, ColumnFacetsSource>>`): The facets of columns as the owner of the rows knows them, by column id. `getFacets` answers with them in place of what the rows of the table hold. A server that filters knows every value of a column; the rows that it sends hold only the values that pass.
- `manualPage?` (`boolean`): The rows are one page from a server. The table shows them all, and the pages come from `rowCount`. Every other feature works on the rows that the table has: an export, the totals and "select all" are of this page. Give `totals` for the totals that the server knows.
- `rowCount?` (`number`): How many rows the server has after its filter, for `manualPage`. Without it, a full page has a next page and a page that is not full is the last. An empty page after the first then sends the table one page back, so keep the rows of the page before, or set `loading`, while a page loads. `lastPage` needs the count.
- `loading?` (`boolean`): Whether new rows are on their way. The table says so to assistive technology and keeps its rows.
- `rowAttrs?` (`(context: RowAttrsContext<Row>) => PartAttrs | undefined`): Attributes of a `tr` element.
- `cellAttrs?` (`(context: CellAttrsContext<Row>) => PartAttrs | undefined`): Attributes of a `th` or `td` element.
- `sectionAttrs?` (`{ head?: PartAttrs; body?: PartAttrs; foot?: PartAttrs }`): Attributes of the `thead`, `tbody` and `tfoot` elements.

`rowAttrs` and `cellAttrs` get a context with the `kind` of the row or the cell. [Attributes of rows and cells](./cells-and-slots.md#attributes-of-rows-and-cells) lists each kind with its fields.

## Events

- `update:sort` (`(value: readonly SortRule[]) => void`): The new `sort`, for `v-model:sort`. It does not run when `sortChange` cancels the change.
- `update:filter` (`(value: FilterState) => void`): The new `filter`, for `v-model:filter`. It does not run when `filterChange` cancels the change.
- `update:groupBy` (`(value: readonly string[]) => void`): The new `groupBy`, for `v-model:groupBy`. It does not run when `groupByChange` cancels the change.
- `update:page` (`(value: PageState | undefined) => void`): The new `page`, for `v-model:page`. It does not run when `pageChange` cancels the change.
- `update:expanded` (`(value: readonly string[]) => void`): The new `expanded`, for `v-model:expanded`. It does not run when `expandedChange` cancels the change.
- `update:selected` (`(value: string[]) => void`): The new `selected`, for `v-model:selected`. It does not run when `selectedChange` cancels the change.
- `update:columnVisibility` (`(value: ColumnVisibility) => void`): The new `columnVisibility`, for `v-model:columnVisibility`. It does not run when `columnVisibilityChange` cancels the change.
- `update:columnOrder` (`(value: readonly string[]) => void`): The new `columnOrder`, for `v-model:columnOrder`. It does not run when `columnOrderChange` cancels the change.
- `update:columnWidths` (`(value: ColumnWidths) => void`): The new `columnWidths`, for `v-model:columnWidths`. It does not run when `columnWidthsChange` cancels the change.
- `update:columnPinning` (`(value: ColumnPinning) => void`): The new `columnPinning`, for `v-model:columnPinning`. It does not run when `columnPinningChange` cancels the change.
- `update:rowPinning` (`(value: RowPinning) => void`): The new `rowPinning`, for `v-model:rowPinning`. It does not run when `rowPinningChange` cancels the change.
- `update:columnAggregates` (`(value: ColumnAggregates) => void`): The new `columnAggregates`, for `v-model:columnAggregates`. It does not run when `columnAggregatesChange` cancels the change.
- `update:cellFormats` (`(value: CellFormats) => void`): The new `cellFormats`, for `v-model:cellFormats`. It does not run when `cellFormatsChange` cancels the change.
- `update:cellFormulas` (`(value: CellFormulas) => void`): The new `cellFormulas`, for `v-model:cellFormulas`. It does not run when `cellFormulasChange` cancels the change.
- `update:cellRange` (`(value: CellRange | null) => void`): The new `cellRange`, for `v-model:cellRange`. It does not run when `cellRangeChange` cancels the change.
- `sortChange` (`(value: readonly SortRule[], details: TableChangeDetails) => void`): Runs when `sort` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `filterChange` (`(value: FilterState, details: TableChangeDetails) => void`): Runs when `filter` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `groupByChange` (`(value: readonly string[], details: TableChangeDetails) => void`): Runs when `groupBy` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `pageChange` (`(value: PageState | undefined, details: TableChangeDetails) => void`): Runs when `page` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `expandedChange` (`(value: readonly string[], details: TableChangeDetails) => void`): Runs when `expanded` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `selectedChange` (`(value: string[], details: TableChangeDetails) => void`): Runs when `selected` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `columnVisibilityChange` (`(value: ColumnVisibility, details: TableChangeDetails) => void`): Runs when `columnVisibility` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `columnOrderChange` (`(value: readonly string[], details: TableChangeDetails) => void`): Runs when `columnOrder` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `columnWidthsChange` (`(value: ColumnWidths, details: TableChangeDetails) => void`): Runs for each step of a resize.
- `columnWidthsCommit` (`(value: ColumnWidths, details: TableCommitDetails) => void`): Runs once when a resize ends: on release of the handle, and after each key.
- `columnPinningChange` (`(value: ColumnPinning, details: TableChangeDetails) => void`): Runs when `columnPinning` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `rowPinningChange` (`(value: RowPinning, details: TableChangeDetails) => void`): Runs when `rowPinning` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `columnAggregatesChange` (`(value: ColumnAggregates, details: TableChangeDetails) => void`): Runs when `columnAggregates` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `cellFormatsChange` (`(value: CellFormats, details: TableChangeDetails) => void`): Runs when `cellFormats` wants to change, with the new value and its details. `details.reason` says why, and `details.cancel()` keeps the old value.
- `cellFormulasChange` (`(value: CellFormulas, details: TableChangeDetails) => void`): A formula that a person entered changes with the reason of the edit (`enter-key`, `paste`).
- `cellRangeChange` (`(value: CellRange | null, details: TableChangeDetails) => void`): Runs for each step of a drag, and for each other change of the range.
- `cellRangeCommit` (`(value: CellRange | null, details: TableCommitDetails) => void`): Runs once when a drag that changed the range ends.
- `cellEdit` (`(edits: readonly CellEdit<any>[], details: TableEditDetails) => void`): Cells got new values. Put them into the rows; `details.cancel()` refuses them.

## Slots

A slot with a column id in its name wins over the slot without one.

- `header-{id}?` (`(props: HeaderSlotProps<Row>) => VNodeChild`): One header cell. `header-{column id}` wins over `header`.
- `col-{id}?` (`(props: CellSlotProps<Row>) => VNodeChild`): One body cell. `col-{column id}` wins over `cell`.
- `foot-{id}?` (`(props: FootSlotProps<Row>) => VNodeChild`): One total in the footer. `foot-{column id}` wins over `foot`.
- `group-total-{id}?` (`(props: GroupTotalSlotProps<Row>) => VNodeChild`): The cell of a group row under one column, which holds the total of the group for that column. `group-total-{column id}` wins over `group-total`.
- `edit-{id}?` (`(props: EditorSlotProps<Row>) => VNodeChild`): The editor of one cell, in place of the text field of the table. `edit-{column id}` wins over `editor`. The control must take focus itself.
- `editor?` (`(props: EditorSlotProps<Row>) => VNodeChild`): The editor of a cell, in place of the text field of the table. The control must take focus itself.
- `header?` (`(props: HeaderSlotProps<Row>) => VNodeChild`): One header cell, for every column without a `header-{column id}` slot.
- `cell?` (`(props: CellSlotProps<Row>) => VNodeChild`): One body cell, for every column without a `col-{column id}` slot.
- `foot?` (`(props: FootSlotProps<Row>) => VNodeChild`): One total in the footer, for every column without a `foot-{column id}` slot.
- `group?` (`(props: GroupSlotProps<Row>) => VNodeChild`): The label cell of a group row.
- `group-total?` (`(props: GroupTotalSlotProps<Row>) => VNodeChild`): The cell of a group row under one column, for every column without a `group-total-{column id}` slot.
- `row-header?` (`(props: RowHeaderSlotProps<Row>) => VNodeChild`): The cell with the number of a row, in a column with `rowHeader`.
- `letter?` (`(props: LetterSlotProps<Row>) => VNodeChild`): A cell of the row of letters, with the `columnLetters` option. Without it, the cell shows the letter.
- `detail?` (`(props: DetailSlotProps<Row>) => VNodeChild`): The detail row of a row, for the rows that `hasDetail` names.
- `empty?` (`() => VNodeChild`): Shown in place of the rows when no row passes the filters.
- `loading?` (`() => VNodeChild`): Shown in place of the rows while `loading` is set and the table has no rows.

## Slot props

### HeaderSlotProps

- `column` (`ColumnDef<Row>`): The definition of the column.
- `label` (`string`): The header text: `column.header`, or the column id.
- `leaf` (`boolean`): False for a header group, which holds columns and no cells.
- `sort` (`SortDirection | undefined`): The direction of the column in the sort, `'asc'` or `'desc'`, or `undefined` when it does not sort.
- `sortIndex` (`number | undefined`): The place of the column in the sort, from 1. With several columns in the sort, the first one sorts first.
- `toggleSort` (`(event?: Event) => void`): Sorts by the column as a press on the header does. Pass the event: with `multiSort`, its keys decide whether the column joins the sort.
- `pin` (`'start' | 'end' | undefined`): The edge that the column is pinned to, or `undefined`.
- `selectColumn` (`(event?: Event) => void`): Selects the cells of the column, for a control in its header. With Shift in the event, the columns from the active cell to this one. It throws for a header group and without the `cellSelection` option.
- `formula` (`string | undefined`): The formula of a computed column, as a person reads it. `undefined` for a column without one.

### CellSlotProps

- `row` (`Row`): The row object of the data, as the owner passed it.
- `node` (`DataRow<Row>`): The node of the row in the row model: its id, its parent and its children.
- `column` (`ColumnDef<Row>`): The definition of the column.
- `value` (`unknown`): The value of the cell: `value` of the column, else the property that `key` names.
- `text` (`string`): The value as text, with the format of the cell, else of its column.
- `format` (`CellFormat | undefined`): The format that the cell has of its own, from `cellFormats`: the format of its column with the format of the cell over it. `undefined` when neither says anything. Its looks are also on the cell as `data-align`, `data-bold`, `data-italic`, `data-color` and `data-fill`.
- `selected` (`boolean`): Whether the row is selected.
- `expanded` (`boolean`): Whether the row is open: its child rows or its detail row show.
- `expandable` (`boolean`): Whether the row can open: it has child rows or a detail row.
- `level` (`number`): Tree and group levels above this row, from 0.
- `pinned` (`RowPin | undefined`): The edge that the row is pinned to.
- `toggleSelected` (`(event?: Event) => void`): Selects the row or takes it out of the selection, for a checkbox in the cell.
- `toggleExpanded` (`(event?: Event) => void`): Opens or closes the row, for a button in the cell.
- `formula` (`{ text: string; error?: { code: FormulaError; message: string } } | undefined`): With formulas: the formula of the cell as a person reads it, and the code and the words of an error value. `undefined` for a cell with neither. The error is also on the cell as `data-formula-error`.

### EditorSlotProps

- `row` (`Row`): The row object of the data, as the owner passed it.
- `node` (`DataRow<Row>`): The node of the row in the row model: its id, its parent and its children.
- `column` (`ColumnDef<Row>`): The definition of the column.
- `value` (`unknown`): The value of the cell now.
- `text` (`string`): The value as plain text, without a format: 0.25 for a cell that shows 25 %. `save` takes a value.
- `error` (`string | undefined`): Why the last value was refused.
- `checking` (`boolean`): A check that takes time runs for a saved value. A save does nothing until it answers.
- `mode` (`'replace' | 'edit'`): How the editor was opened. `replace`: the person typed a character on the cell, which is `typed`, and means to write over the value. `edit`: Enter, F2, a double press or code opened it, to change the value.
- `typed` (`string | undefined`): The character that opened the editor, or `undefined`.
- `save` (`(value: unknown, event?: Event) => void`): Saves a value, with the check of the column, and closes the editor. A value that is refused keeps the editor open, and `error` says why.
- `cancel` (`() => void`): Closes the editor without a save. Focus goes back to the cell.
- `formula` (`string | undefined`): With formulas: the formula of the cell as a person reads it, such as `=C2*D2`. A save of a text that starts with `=` sets a formula.
- `inputMode` (`'decimal' | undefined`): `decimal` when a field of numbers should ask a phone for its number keyboard (`numberKeyboard` of the column), else `undefined`. Put it on the field as `inputmode`.

### GroupSlotProps

- `group` (`GroupRow<Row>`): The group: its id, the column and the value that make it, and its rows.
- `column` (`ColumnDef<Row> | undefined`): The column that makes the group.
- `text` (`string`): The value of the group as text, with the format of its column.
- `expanded` (`boolean`): Whether the group is open.
- `level` (`number`): The groups above this one, from 0.
- `totals` (`Record<string, unknown>`): Column totals of the rows in the group.
- `totalTexts` (`Record<string, string>`): The totals as text, with the format of their columns, by column id.
- `path` (`readonly GroupPathEntry<Row>[]`): The groups from the outermost one down to this group, each with its column, its value and its text: "Europe", then "Finland".
- `covered` (`readonly ColumnDef<Row>[]`): The columns that this cell covers. With totals under their columns, a total of one of these columns has no cell of its own.
- `toggleExpanded` (`(event?: Event) => void`): Opens or closes the group, for a button in the cell.

### GroupTotalSlotProps

- `group` (`GroupRow<Row>`): The group of the row.
- `column` (`ColumnDef<Row>`): The column of the cell.
- `value` (`unknown`): The total of the column over the rows of the group. `undefined` for a column without an `aggregate`.
- `text` (`string`): The total as text, with the format of the column, or an empty text.
- `totals` (`Record<string, unknown>`): The totals of every column that has one, by column id.
- `aggregate` (`AggregateName | 'custom' | undefined`): The function of the total: one of the built-in names, `custom` for a function of the column, or `undefined` without a total.
- `expanded` (`boolean`): Whether the group is open.
- `level` (`number`): The groups above this one, from 0.
- `path` (`readonly GroupPathEntry<Row>[]`): The groups from the outermost one down to this group.

### FootSlotProps

- `column` (`ColumnDef<Row>`): The column of the cell.
- `value` (`unknown`): The total of the column, or `undefined` for a column without an `aggregate`.
- `text` (`string`): The total as text, with the format of the column, or an empty text.
- `totals` (`Record<string, unknown>`): The totals of every column that has one, by column id.
- `aggregate` (`AggregateName | 'custom' | undefined`): The function of the total: one of the built-in names, `custom` for a function of the column, or `undefined` without a total.
- `setAggregate` (`(aggregate: AggregateName | null | undefined, event?: Event) => void`): Chooses the function of the total of this column, for a picker in the footer. `null` takes the total away, and `undefined` gives the column the `aggregate` of its definition back. The group rows and an export follow.

### RowHeaderSlotProps

- `row` (`Row`): The row object of the data, as the owner passed it.
- `node` (`DataRow<Row>`): The node of the row in the row model: its id, its parent and its children.
- `column` (`ColumnDef<Row>`): The definition of the column with `rowHeader`.
- `number` (`number`): The number of the row, from 1: its place among the rows that the table shows, counted over the pages.
- `selectRow` (`(event?: Event) => void`): Selects the cells of the row. With Shift in the event, the rows from the active cell to this one. A press on the cell does the same; this is for a control inside it. It throws without the `cellSelection` option.

### LetterSlotProps

- `column` (`ColumnDef<Row>`): The definition of the column under the letter.
- `letter` (`string | undefined`): The letter of the column: its place among the columns in view. `undefined` for a column that leads the table.
- `corner` (`boolean`): Whether the cell is the corner, above the row numbers, which selects every cell.
- `selectColumn` (`(event?: Event) => void`): Selects what a press on the cell selects: the cells of the column, with Shift in the event from the active cell on, or every cell from the corner. A press on the cell does the same; this is for a control inside it. It throws for an empty cell of a column that leads, and without the `cellSelection` option.

### DetailSlotProps

- `row` (`Row`): The row object of the data, as the owner passed it.
- `node` (`DataRow<Row>`): The node of the row in the row model: its id, its parent and its children.
- `toggleExpanded` (`(event?: Event) => void`): Closes the detail row.
