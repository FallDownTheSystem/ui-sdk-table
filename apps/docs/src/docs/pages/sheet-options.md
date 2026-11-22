# The sheet options

Turn a table into a data sheet: cells that a person types into, ranges, undo and a fill handle.

Use it for data that people change cell by cell, as in a spreadsheet: prices, stock, a budget. A data sheet is the same `Table` with more options. There is no second component.

<Example name="sheet-options/sheet" caption="Press a price and type 5: the editor opens with that character. Press Enter to save and move down. Select two cells with Shift and an arrow, press Delete, then Undo." />

## Turn it on

- `sheet` is a preset: `editable`, `cell-selection`, `history` and `fill-handle` are on unless one is set to false.
- Each of them also works alone, so `<Table editable history>` is a table with undo.
- Without these options, a table behaves as before. The keys of a sheet do nothing in a plain table.
- The table has `data-sheet` with the option.
- The owner applies every change. Pass `@cell-edit` and put the edits into your rows, for example with `applyEdits`. See [Editing](./cell-editing.md).

## Keys

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

Delete and Backspace inside an open editor remove a character. A key in a control inside a cell belongs to that control.

## Empty a cell

`emptyValue(row, column)` is what a clear writes: the `parse` of the column for an empty text, else `null` for a number or a date, `false` for a boolean and an empty text for the rest. It goes through the schema of the column, and one refusal stops the whole clear. The table then says why and changes nothing.

## The function of a total at run time

A person can change the function of a total, for example from a sum to an average.

<Example name="sheet-options/totals" caption="Press mean under Nights: the footer shows the average. Press sum to go back." />

- `columnAggregates` is a record by column id: `'sum' | 'mean' | 'min' | 'max' | 'count' | 'uniqueCount' | 'first'`, or `null` for no total. Use `v-model:column-aggregates` or `default-column-aggregates`.
- An entry wins over the `aggregate` of the column definition. A column without an entry keeps its definition.
- The footer, the group rows, `getTotals` and an export follow. The footer row goes away with its last total.
- `setAggregate(name | null | undefined, event?)` of the `#foot` slot and `controller.setColumnAggregate(columnId, name)` change it. `undefined` gives the definition back.
- `#foot` and `#group-total` get `aggregate`: a name, `custom` for a function of the column, or `undefined`.
- A footer cell has `data-aggregate`. A cell whose function a person chose has the name "Average: 12.40" (messages `aggregateLabel`, `totalLabel`).
- A change of the function is no step of the history.

## Your own editor

`#editor` and `#edit-{column id}` get `mode` (`replace` or `edit`) and `typed`, the character that opened the editor. `save(value, event)` with an Enter key moves down. `#header` gets `selectColumn(event?)`, for a control that selects the cells of the column, with Shift from the active cell on.

## A number keyboard on a phone

A column with `numberKeyboard: true` gives the field of its editor `inputmode="decimal"`. The `#editor` and `#edit-{id}` slots get the same answer as `inputMode` (`'decimal'` or `undefined`).

The table holds the attribute back where the number keyboard has no key that a person needs:

- in a cell that can hold a formula: it takes a text with `=`. `allowFormula: false` gives the keyboard back;
- in a cell whose format is set and is no number format (`integer`, `decimal`, `number`, `currency`, `percentage`), such as a cell that a person gave a date format.

The field stays a text field and never `type="number"`: such a field refuses a decimal comma in some locales, a percent sign and a pasted text.

## The view

`getView()` and `useTableView` hold `canUndo`, `canRedo`, `activeCell` (`{ rowId, columnId }` or `null`), `cellSelection` (`{ from, to, rows, columns }`, by id, data rows only) and `columnAggregates`.

See the [Sheet tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=sheet).

## Names

- **Attributes:** `data-sheet`, `data-aggregate`.
- **Exports:** `emptyValue`, `aggregateName`, and the types `ColumnAggregates`, `AggregateName`, `TableStepReason`.

Every option, event, slot, controller method and view field of this page is in the reference: [Table](./reference-table.md), [Controller](./reference-controller.md) and [View](./reference-view.md).
