# A formula writer

Build a field that helps a person write a formula: suggestions of functions, a hint for the argument at the caret, references picked with the pointer, and the cells of each reference in colour.

Use it for a formula bar above a sheet, or for the editor of a cell. The library gives the logic and the state; the field, the list and the colours are the app's. Everything here needs the `formulas` option, except the pick mode.

<Example name="formula-writer/writer" caption="Press the total of the Order total (D4), type =SUM( in the field, then drag from D1 to D3: the field gets D1:D3 and the three cells get a colour. Type ) and press Enter. Type =su in the field: the list shows SUM and SUBSTITUTE." />

## Suggest functions

`formulaHelp(text, caret, { locale })` of the formulas entry reads the text of the field, also a text that is not a whole formula yet (`=SUM(B2;` or `=IF(A1>2, "ope`), and tells what the caret is at:

- `token`: the token that ends at the caret or holds it, with its `kind`, `text`, `start` and `end`. When its kind is `name` or `function`, filter `FORMULA_FUNCTIONS` (or `controller.getFormulaFunctions()`) by its text, and put the choice in its place with `insertReference(text, token, 'SUM(')`.
- `call`: the innermost call around the caret: its `name`, `start`, the `index` of the argument at the caret, and `argument`, the place of that argument in `info.arguments`. A hint marks that argument.
- `reference`: whether a reference fits at the caret: the text starts with `=` and the caret follows `=`, `(`, a sign between arguments or an operator, and is not inside a text in quotes.

Each function of `FORMULA_FUNCTIONS` has its `name`, `args` as a text, `help`, its `group` (`math`, `condition`, `lookup`, `logic`, `text` or `date`) and `arguments` as a list. An argument has a `name`, `optional`, and `repeats`: the arguments with `repeats` come again as a group, as `range2, criterion2` of `COUNTIFS` do, and `argument` counts them again.

The locale decides the signs, as for the table: with a decimal comma (`fi-FI`), `;` separates the arguments.

## Pick cells with the pointer

Turn on `pick-cells` while a reference fits at the caret. While it is on, a press or a drag on cells of the body picks them, and a press on a letter of `column-letters` picks its column. A pick changes nothing else: the active cell, the selected cells, an open editor, focus and the caret of the field stay where they are.

- `@picked-cells-change` hears the press and each step of a drag; `@picked-cells-commit` the end of a drag. `v-model:picked-cells` holds the pick. A pick is places in the grid, as `cellRange` is, with `columns` for whole columns. It goes back to `null` when `pick-cells` goes off.
- `controller.getRangeAddress(pick)` gives its text: `B2`, `B2:C5`, or `B:B` for a column. Without an argument it reads the selected cells.
- `insertReference(text, selection, address)` puts the address in place of the selection of the field and gives the new text with the place of the reference. During a drag, pass the place of the last step as the selection of the next one, so each step replaces the reference of the step before. After a pick, a press on another cell replaces it again until the person types.
- A press on a row number, on the corner and inside a field in a cell picks nothing. A double press opens no editor.

It works the same for the field of the table's own editor (`[data-slot='table-editor']`), for a control in the `editor` slot, and for a field outside the table such as `useFormulaBar`. The press is prevented, so focus never leaves the field.

## Colour the references

`controller.getFormulaReferences(text, at?)` gives each reference of the text with its `start` and `end` in the text and the cells that it names by ids, from the first (`from`) to the last (`to`), and `columns` for whole columns. `at` is the cell of the formula, the active cell by default; `useFormulaBar().cell` is the cell of the bar. A reference to a column or a row that the document does not hold is left out.

Give the cells of each reference one colour through `cell-attrs`. The cells of a reference are the rows from `from` to `to` in the order of `rows` and the columns between them in the order of `columns`: the app knows both. Pass a new `cell-attrs` function when the references change, and the same one while they stay.

## What a styled table needs

- A list of functions under the field, and a hint with the argument at the caret marked.
- A look for `[data-pick]` on the table (a cursor) and for `[data-picked]` on the picked cells (a dashed line; `data-pick-edge` holds `top`, `bottom`, `left` and `right` for a line around them).
- One colour for each reference, through `cell-attrs`.

## Attributes

- `data-pick` on the table while `pick-cells` is on.
- `data-picked` on each picked cell, and `data-pick-edge` on the cells at its edges.

## Keys

The pick mode adds no key: a person picks with the pointer, and the keys of the field stay its own.

See the [Formula tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=formula).

## Names

- **Options:** `pick-cells`, `picked-cells`, `default-picked-cells`; events `picked-cells-change` and `picked-cells-commit`. `CellPick` is `{ anchor, end, columns }`.
- **Controller:** `getRangeAddress(cells?)` (`null` without cells, for a column without a letter, and with `manual-page`), `getFormulaReferences(text, at?)`, `getFormulaFunctions()`.
- **Formulas entry:** `formulaHelp`, `insertReference`, `FORMULA_FUNCTIONS`; the types `FormulaHelp`, `FormulaHelpOptions`, `FormulaToken`, `FormulaTokenKind`, `FormulaReference`, `FormulaArgument`, `FormulaFunctionGroup`.
- **Vue:** `useFormulaBar(controller).cell`.
- **Attributes:** `data-pick`, `data-picked`, `data-pick-edge`.
