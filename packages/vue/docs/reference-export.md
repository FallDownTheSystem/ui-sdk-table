# Export

The types of `exportData` and of the entry `ui-sdk-table-vue/export`.

See [Export](./export.md) for how they work together.

## ExportOptions

What `controller.exportData(options)` takes.

- `rows?` (`'filtered' | 'page' | 'all' | 'selected'`): Which rows to take. `'filtered'` (the default) is every row that passes the filters, on all pages, in the order of the screen. `'page'` is the rows of the page in view. `'all'` is every row of the data, in the order of the data. `'selected'` is the selected rows, in sort order. A table with `manualPage` has one page of a server, so each set is of that page.
- `columns?` (`'visible' | 'all' | readonly string[]`): Which columns to take. `'visible'` (the default) is the columns on the screen in their order. `'all'` adds the hidden columns after them. A list of ids gives those columns in that order. A column with `exportable: false` is in none of them.
- `children?` (`boolean`): Whether the child rows of a tree row come with it, open or not. Defaults to true.
- `groups?` (`boolean`): Whether each group gets a row of its own before its rows, for `'filtered'` and `'page'`. Defaults to false. `'all'` and `'selected'` have no groups.
- `totals?` (`boolean`): Whether a last row holds totals. Defaults to false. For `'filtered'` and `'page'` they are the totals of the footer on the screen. For `'all'` and `'selected'` they are the totals of the rows in the file.

## ExportData

- `columns` (`ExportColumn<Row>[]`): The columns of the export, in the order of the screen.
- `rows` (`ExportRow<Row>[]`): The rows of the export: rows of the data, group rows and the row of totals.
- `locale` (`string | undefined`): The `locale` of the table, which a writer uses for its numbers and dates.
- `document?` (`readonly string[]`): With formulas: the id of every row in the order of the document, for the ranges of the formulas.

## ExportColumn

- `id` (`string`): The id of the column.
- `header` (`string`): The header text of the column.
- `column` (`ColumnDef<Row>`): The definition of the column.

## ExportRow

- `kind` (`'row' | 'group' | 'total'`): `'row'`: a row of the data. `'group'`: a group row. `'total'`: the row of totals, with the `totals` option of the export.
- `row?` (`Row`): The row of the data, for a row of kind `'row'`.
- `level` (`number`): Tree and group levels above this row, from 0.
- `label?` (`string`): The name of a group, for a row of kind `'group'`. It is also in a cell: the first one without a total, or the first one before its total when every column has a total.
- `cells` (`ExportCell[]`): One cell for each column of the export.
- `id?` (`string`): With formulas: the id of a row of kind `'row'`, for the formulas that name it.

## ExportCell

- `value` (`unknown`): The value of the cell, as the row has it.
- `text` (`string`): The text of the cell, as a person sees it on the screen.
- `format?` (`CellFormat`): The format that the cell has of its own, from the `cellFormats` of the table.
- `formula?` (`string`): With formulas: the formula of the cell, or of its column, in the stored form.

## CsvOptions

- `separator?` (`string`): The text between two cells. Defaults to a comma.
- `lineEnd?` (`string`): The text between two rows. Defaults to `\r\n`, as RFC 4180 says.
- `header?` (`boolean`): Whether the first row holds the header texts. Defaults to true.
- `bom?` (`boolean`): Whether the text starts with a byte order mark. Defaults to true: without it, Excel reads a UTF-8 file in the code page of the computer.
- `escapeFormulas?` (`boolean`): Whether a text that a spreadsheet would read as a formula gets a `'` before it. Defaults to true. A cell that a person typed can otherwise run a formula on the computer of the person who opens the file.

## XlsxOptions

- `sheetName?` (`string`): The name of the sheet. Defaults to `Sheet1`.
- `freezeHeader?` (`boolean`): Whether the header row stays in view while the rows scroll. Defaults to true.
- `compress?` (`boolean`): Whether the file is compressed, where the environment can do that. Defaults to true.
- `formula?` (`XlsxFormulas`): Writes the formulas of the cells as formulas of the file, with the result beside each: `excelFormulas()` of the entry `ui-sdk-table-core/formulas`. Without it, a cell holds its result.
