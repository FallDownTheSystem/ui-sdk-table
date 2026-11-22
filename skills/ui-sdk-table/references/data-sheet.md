# Build a data sheet

A data sheet is the same `Table` with more options. There is no `Sheet` component. Read `docs/sheet-options.md` first; this file holds the order of the work and the faults that are easy to make.

## The order of the work

1. **Editing with an owner.** `editable` and `@cell-edit` that puts the edits into your rows, for example with `applyEdits`. Without a listener that writes, nothing changes. See `docs/cell-editing.md`.
2. **The preset.** `sheet` turns on `editable`, `cell-selection`, `history` and `fill-handle`. Set one to false to leave it out. Each also works alone.
3. **Checks of a value.** `parse` and `schema` of a column. A refusal keeps the editor open with its words.
4. **Formats**, when people format cells: `v-model:cell-formats` and a toolbar. See `docs/formats.md`.
5. **Row numbers and letters**, when people read addresses: `rowNumberColumn()` and `column-letters`. See `docs/row-numbers-and-letters.md`.
6. **Formulas** last: the entry `ui-sdk-table-vue/formulas`, the option `formulas` and a formula bar. See `docs/sheet-formulas.md` and, for a file, `docs/excel-formulas.md`.

## Rules that are easy to break

- **A paste, a fill and a clear are all or nothing.** One refused cell refuses the whole act. Do not apply part of a report.
- **An undo is a report too.** It reaches `@cell-edit` with the reason `undo` or `redo`. An owner that applies every report needs no code for undo.
- **Save the formats and the formulas with the document.** `cellFormats` and `cellFormulas` are data, by row id and column id, as the values are. Pass them back when the document opens.
- **One formula engine for the life of the table.** Create it once in `<script setup>` or a module. A new engine at each render computes every formula again.
- **A column that can hold a formula can hold an error text**, such as `#DIV/0!`. Type its rows so.
- **Never `type="number"` for an editor.** Use `numberKeyboard` of the column. A number field refuses a decimal comma, a percent sign and a paste.
- **Pages from a server limit the sheet.** With `manual-page`, a formula is refused, another page empties the history, and a format of every row formats only the rows the table has.
- **Focus back to the cell.** After a toolbar button, a formula bar commit or a cancel, give focus to the active cell (`[data-active]`).
- **The summary of a selection is no live region.** A new sum at each step of a selection is noise. Read it with `useSelectionSummary`.
- **An entry form.** For editing many cells and then Save or Cancel, use `entry` with `useEditDraft`, not a draft of your own. See `docs/cell-editing.md#an-entry-mode-with-save-and-cancel`.

## Find the page

| Need | Page |
| --- | --- |
| Keys of a sheet, the function of a total, a number keyboard | `docs/sheet-options.md` |
| A range, copy, cut, paste, the summary | `docs/range-copy-and-paste.md` |
| The fill handle | `docs/fill.md` |
| Undo and redo | `docs/history.md` |
| Bold, colours, number formats | `docs/formats.md` |
| Row numbers, the row of letters | `docs/row-numbers-and-letters.md` |
| Formulas, functions, the formula bar | `docs/sheet-formulas.md`, `docs/reference-formulas.md` |
| An Excel file with formulas | `docs/excel-formulas.md` |

The list of functions is on `docs/sheet-formulas.md`, and `controller.getFormulaFunctions()` gives it at run time. Do not guess a function from Excel: check that the page lists it.
