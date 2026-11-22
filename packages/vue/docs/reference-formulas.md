# Formulas

The types of the entry `ui-sdk-table-vue/formulas`.

See [Formulas](./sheet-formulas.md) for how they work together.

## FormulaEngineOptions

What `createFormulaEngine(options)` takes.

- `timeZone?` (`string`): The zone of a date that is no reference to a column with a zone of its own (`formatOptions.timeZone`), such as a date that a function gives. Without it, local time: a result that is saved should not depend on the computer that made it, so pass one when a formula reads a moment.
- `now?` (`() => number`): The clock of `TODAY` and `NOW`, in milliseconds since 1970: `Date.now` by default. A test passes a clock of its own.
- `maxReads?` (`number`): The most cells that one change may read, 5,000,000 by default. A formula in each row that sums from the first row to its own reads the square of the rows; past the limit the change is refused with words.

## CellFormulas

The value of `cellFormulas`.

- `columns?` (`Readonly<Record<string, string>>`): The formula of each computed column, by column id, in the stored form.
- `cells?` (`Readonly<Record<string, Readonly<Record<string, string>>>>`): The formula of each cell, by row id and column id, in the stored form.

## FormulaBar

What `useFormulaBar(controller)` gives.

- `address` (`ComputedRef<string>`): The address of the cell, such as `D7`, or `''` without an active cell.
- `text` (`ComputedRef<string>`): The text of the field: the draft while a person types, else the formula or the value of the cell.
- `error` (`ComputedRef<string>`): Why the last commit was refused, in the words for a person, or `''`.
- `dirty` (`ComputedRef<boolean>`): Whether the text is a draft that is not saved.
- `ready` (`ComputedRef<boolean>`): Whether a cell is active, so the field can be used.
- `input` (`(text: string) => void`): The new text of the field.
- `commit` (`() => boolean`): Saves the draft into its cell, as the editor of the cell does. Returns whether it was saved.
- `cancel` (`() => void`): Drops the draft and the error.

## FormulaFunctionInfo

- `name` (`string`): The name of the function, such as `SUM`.
- `args` (`string`): Its arguments as a person writes them, such as `number, ...`.
- `help` (`string`): One line that says what it gives.
