# History

Let a person take a change back with Control+Z and put it on again with Control+Y.

Use it in any table that a person edits. It needs no code in the owner beyond `applyEdits`.

<Example name="history/undo" caption="Press One seat more in each room, then Undo three times: each room goes back, and the line says that each report came with the reason undo. Redo puts a seat back." />

## Turn it on

`history` on the table, or `sheet`. `:history="{ limit: 100, maxCells: 100000 }"` are the defaults.

## How an undo reaches the owner

- An undo is a report through `@cell-edit` with the reason `undo` (a redo: `redo`), with the old values as `value`. An owner that puts edits into its rows with `applyEdits` needs no code for undo.
- `details.cancel()` refuses an undo as it refuses an edit, and the step stays. The table says so.
- An undo runs no `parse` and no schema. It puts back what the data held.
- A cell whose row or column left the table is skipped and counted in the announcement. A step with no cell left is dropped. Rows need stable ids.
- An undo of a row that the sort moved finds the row. An undo of a row far away in a row window scrolls to it.

## What a step is

- One report that no listener refused: one edit, one paste, one cut, one clear, one fill, one `editCell`, one change of formats.
- Typing in an open editor is no step. There, Control+Z is the text field's.
- Sort, filter, column moves and selection are not in the history.
- A step with more cells than `maxCells` empties the history, and the table says so.
- While a check of a slow server runs, a key does nothing and `undo()` throws. The step is there after the answer.

## Another document

Call `controller.clearHistory()` when the rows become another document. With `manual-page`, another page, sort or filter empties the history.

## Read the steps

`controller.getHistory()` returns `{ entries, position }`. Each entry has `id`, `reason`, `source`, `cells` (how many cells got a new value), `formats` and `formulas` (whether the step changed them). The view has `canUndo` and `canRedo` for the buttons.

## Keys

| Key | On a cell, with `history` |
| --- | --- |
| Control or Command with Z | Undo |
| Control or Command with Y, or with Shift+Z | Redo |

The keys act on a cell only. In the editor and in a control inside a cell, Control+Z is the field's.

See the [Sheet tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=sheet).

## Names

- `undo` and `redo` throw with the reason: no history, nothing to undo, a refused report, a check that runs.
- **Types:** `TableStepReason`.

Every option, event, slot, controller method and view field of this page is in the reference: [Table](./reference-table.md), [Controller](./reference-controller.md) and [View](./reference-view.md).
