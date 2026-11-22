# Editing

Let a person change the value of a cell, check it first, and put it into your rows.

The table never writes a row. It reports each edit through `@cell-edit`, and the app puts the value into its rows. `applyEdits` does that for plain rows.

<Example name="cell-editing/prices" caption="Double-press a price, type 7, and press Enter. The line under the table says what changed. Type -1 and the editor stays open with the reason. Product names cannot be edited." />

## Turn it on

- `editable` on the table lets a person edit every cell. `editable` on a column says otherwise for its cells: `false`, or a function `(row) => boolean` for some rows.
- `@cell-edit` gets `(edits, details)`. Each edit has `rowId`, `columnId`, `row` (your object, as it was before), `column`, `value` and `previous`. `details.reason` says how it came: `enter-key`, `tab-key`, `focus-out`, `paste` or `imperative`. `details.cancel()` refuses the edit.
- `applyEdits(rows, edits, getRowId?)` returns a new array with a new object for each row that changed. The other rows stay the same objects. It finds the row of an edit by its object, and by its id when the object was replaced already. Pass the `getRowId` of the table when it has one. It reads the top level only: the child rows of a tree need your own code.

## Keys

| Key | On a cell that can be edited |
| --- | --- |
| Enter, F2 or a double press | Opens the editor with the value |
| A character | Opens the editor with that character |
| Enter in the editor | Saves, and focus goes back to the cell |
| Tab, Shift+Tab in the editor | Saves and goes to the next or the cell before |
| Escape in the editor | Closes it and puts the value back |
| A press elsewhere | Saves |

The arrows in the editor move the caret. Without an editor, Tab leaves the table.

## Check a value

A text becomes a value in two steps:

1. `parse(text, row)` of the column makes the value. Without it, the value that the cell holds now decides: a number stays a number, a boolean a boolean, a date a date, and anything else gets the text. An empty text empties a number or a date.
2. `schema` of the column checks the value. Any Standard Schema works: Zod, Valibot, ArkType. A refusal keeps the editor open with the message of the schema.

A check can answer with a promise. The editor then waits (`data-checking`), and Escape takes the edit back.

`numberKeyboard: true` on a column gives the field of its editor `inputmode="decimal"`, so a phone shows its number keyboard. The field stays a text field and never `type="number"`.

## Your own editor

`#editor` and `#edit-{column id}` fill the editor of a cell. They get `row`, `column`, `value`, `text`, `error`, `checking`, `mode`, `typed`, `inputMode`, `save(value, event)` and `cancel()`. The control must take focus itself. A `save` goes through the same check as the field of the table.

## From code

`controller.editCell(rowId, columnId, value)` gives a cell a value with the check of its column, and reports it with the reason `imperative`. It throws with the reason when the value is refused. `startEdit` opens the editor of a cell in view, and `cancelEdit` closes it.

## Attributes

- `data-editable` on a cell that can be edited, `data-editing` while its editor is open, `data-checking` while a check runs.
- The editor is `[data-slot='table-editor']`, with `aria-invalid` and `data-invalid` after a refusal. Its name is "Edit Price" (message `editCell`).
- The reason of a refusal is `[data-slot='table-edit-error']`, which the editor names with `aria-errormessage`.

## Names

- **Options:** `editable`, `onCellEdit` (`@cell-edit`); column keys `editable`, `parse`, `schema`, `numberKeyboard`.
- **Controller:** `editCell`, `startEdit`, `cancelEdit`.
- **Slots:** `#editor`, `#edit-{column id}`.
- **Exports:** `applyEdits`, `cellValue`, `emptyValue`, and the types `CellEdit`, `TableEditDetails`, `TableEditReason`, `StandardSchemaV1`, `EditorSlotProps`.

See the [Edit tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=edit).
