# Export

Write the rows of the table to a CSV or an Excel file, with the text that the screen shows.

`controller.exportData()` collects the cells as plain data. The writers are in the entry `ui-sdk-table-vue/export`, so a page without an export does not carry them: load it with `import()` where a person asks for a file.

<Example name="export/files" caption="Press Show the CSV. The file holds the customer, the city and the total of each order and a row of totals, and no id. Download Excel saves the same rows as orders.xlsx." />

## What goes in

`exportData(options)` takes:

- `rows`: `'filtered'` (the default, every row that passes the filters, on all pages, in the order of the screen), `'page'`, `'all'` (in the order of the data) or `'selected'`.
- `columns`: `'visible'` (the default, in their order), `'all'` (the hidden columns after them) or a list of ids.
- `children`: whether the child rows of a tree come with it, open or not. Defaults to true.
- `groups`: whether each group gets a row of its own before its rows. Defaults to false.
- `totals`: whether a last row holds the totals. Defaults to false.

A column with `exportable: false` is in no file. `exportValue(row)` of a column gives the value of a file in place of the value and its format, for a column whose cell is a slot.

## The text of a cell

The text of a cell in a file is the text of the screen. An Excel cell is a number or a date with a pattern only when a spreadsheet shows it as the screen does; else the cell is text.

## The writers

- `toCsv(data, options)` returns the text. Its options: `separator` (a comma), `lineEnd` (`\r\n`), `header` (true), `bom` (true, so Excel reads UTF-8), `escapeFormulas` (true: a text that a spreadsheet would read as a formula gets a `'` before it).
- `toXlsx(data, options)` returns the bytes of the file. Its options: `sheetName`, `freezeHeader` (true), `compress` (true), and `formula` for a table with formulas: see the page "An Excel file with formulas" of the group "Data sheet".
- `downloadCsv(data, filename, options)` and `downloadXlsx(data, filename, options)` save a file in the browser.

With `manualPage`, the table has one page of a server, so each set of rows is of that page.

## Names

- **Controller:** `exportData`.
- **Column keys:** `exportable`, `exportValue`.
- **Export entry:** `toCsv`, `toXlsx`, `downloadCsv`, `downloadXlsx`, `downloadFile`, `zip`, `XLSX_TYPE`, and the types `CsvOptions`, `XlsxOptions`, `XlsxFormulas`, `ExportData`, `ExportRow`, `ExportColumn`, `ExportCell`, `ExportOptions`.

See the [More tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=more).
