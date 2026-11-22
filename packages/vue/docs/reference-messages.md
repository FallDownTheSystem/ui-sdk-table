# Messages

Every text that the table writes itself, for the `messages` prop.

Pass the texts that you change; the others keep the English words of `defaultMessages`. Each text is a function, so a language can put the parts in its own order.

## TableMessages

- `formulaIssue?` (`(issue: FormulaIssue) => string`): The words for an issue of a formula. Without it, the words of the engine: a table without formulas carries none.
- `formulaError?` (`(code: FormulaError) => string`): Why a formula gives an error value, for the description of its cell. Without it, the words of the engine.
- `recalculated?` (`(details: { cells: number }) => string`): What the table says after `recalculate()`: how many cells got new values. Without it, the words of the engine.
- `noRows` (`() => string`): What the body says when no row passes the filters.
- `loading` (`() => string`): What the body says while the first rows are on their way.
- `expandRow` (`() => string`): The name of the button that opens a row with child rows or a detail row.
- `collapseRow` (`() => string`): The name of the button that closes such a row.
- `expandSign` (`() => string`): The sign on the button of a closed row.
- `collapseSign` (`() => string`): The sign on the button of an open row.
- `groupRow` (`(details: { text: string; count: number }) => string`): The text of a group row: the value of the group and how many rows it holds.
- `resizeColumn` (`(column: string) => string`): The name of the resize handle of a column.
- `columnResized` (`(details: { column: string; width: number }) => string`): What a screen reader says after a column gets a new width.
- `columnMoved` (`(details: ColumnReorderMessage) => string`): What a screen reader says while a column moves.
- `editCell` (`(details: { column: string }) => string`): The name of the text field that edits a cell.
- `notNumber` (`(text: string) => string`): Why a text is refused in a column of numbers.
- `notDate` (`(text: string) => string`): Why a text is refused in a cell that holds a date.
- `notBoolean` (`(text: string) => string`): Why a text is refused in a cell that holds true or false.
- `invalidValue` (`() => string`): Why a value is refused when its schema gives no message.
- `editRefused` (`() => string`): Why an edit is refused when a listener of `onCellEdit` cancels it.
- `cellsSelected` (`(details: { rows: number; columns: number }) => string`): What a screen reader says after the range of cells changed from the keyboard.
- `cellsCopied` (`(details: { cells: number }) => string`): What a screen reader says after a copy.
- `cellsPasted` (`(details: { cells: number }) => string`): What a screen reader says after a paste.
- `pasteRefused` (`(details: { column: string; text: string; message: string }) => string`): Why a paste did nothing: one of its values was refused.
- `pasteNowhere` (`() => string`): Why a paste did nothing: no cell under it can be edited.
- `pasteTooLarge` (`(details: { rows: number; columns: number }) => string`): Why a paste did nothing: the text has more rows or columns than the table has from the first cell on.
- `pasteOverRow` (`() => string`): Why a paste did nothing: a row under it is a group row or a detail row, which holds no values.
- `editRowGone` (`() => string`): Why an edit was not saved: its row left the table while the value was checked.
- `cellsCleared` (`(details: { cells: number }) => string`): What a screen reader says after Delete or `clearCells` emptied cells.
- `cellsCut` (`(details: { cells: number }) => string`): What a screen reader says after a cut.
- `clearRefused` (`(details: { column: string; message: string }) => string`): Why a clear or a cut did nothing: a column refuses an empty value.
- `clearNowhere` (`() => string`): Why a clear or a cut did nothing: no cell under it can be edited.
- `undone` (`(details: { cells: number; gone: number; hidden: number }) => string`): What a screen reader says after an undo. `cells` got their old value back, `gone` of the step are not in the table any more, and `hidden` of the cells that changed are not in view: a filter, a page or a closed row hides them.
- `redone` (`(details: { cells: number; gone: number; hidden: number }) => string`): What a screen reader says after a redo.
- `undoRefused` (`() => string`): Why an undo or a redo did nothing: a listener of `onCellEdit` refused it.
- `nothingToUndo` (`() => string`): Why an undo did nothing: the history has no step to take back.
- `nothingToRedo` (`() => string`): Why a redo did nothing: the history has no step to bring back.
- `historyBusy` (`() => string`): Why an undo or a redo must wait: the check of a new value runs.
- `historyTooLarge` (`(details: { cells: number }) => string`): What a screen reader says when one change holds more cells than the history keeps, so it cannot be undone.
- `rowNumber` (`(details: { number: number }) => string`): The name of the header of a row: its number, from 1. A screen reader says it with each cell of the row.
- `cornerCell` (`() => string`): The name of the corner cell of the row of letters, which selects every cell.
- `cellsFilled` (`(details: { cells: number }) => string`): What a screen reader says after a fill.
- `fillRefused` (`(details: { column: string; text: string; message: string }) => string`): Why a fill did nothing: a column refuses one of its values.
- `fillNowhere` (`() => string`): Why a fill did nothing: no cell under it can be edited.
- `fillOverPinned` (`() => string`): Why a fill did nothing: it would go from pinned rows to rows of the list, which are no neighbours in the data.
- `cellsFormatted` (`(details: { cells: number }) => string`): What a screen reader says after the formats of cells changed from a key or from code.
- `aggregateLabel` (`(name: string) => string`): The name of a function of the sum row, for a picker and for the name of a footer cell: `sum`, `mean`, `min`, `max`, `count`, `uniqueCount`, `first`, or `custom` for a function of the column.
- `totalLabel` (`(details: { label: string; text: string }) => string`): The name of a footer cell whose function a person chose: the function and the total.
