# An Excel file with formulas

Download a sheet as an Excel file whose cells keep their formulas, where Excel computes them the same way.

Use it for a sheet with formulas that a person goes on with in a spreadsheet. Without it, the file holds the results only.

<Example name="excel-formulas/file" caption="Press Download Excel. In profit.xlsx, each cell under Profit holds the formula of its row, such as B2-C2, with its result beside it." />

## Turn it on

```ts
const { downloadXlsx } = await import('ui-sdk-table-vue/export')
await downloadXlsx(controller.exportData(), 'profit', { formula: excelFormulas() })
```

- `excelFormulas()` of the formulas entry is the `formula` option of `toXlsx` and `downloadXlsx`.
- A cell with a formula, of its own or of its column, gets the formula of the file (`<f>`) with its result beside it, when the formula means the same in Excel (below).
- The addresses are places in the file. A sorted or filtered export keeps the formulas that read their own row.
- An error of a formula is an error cell of the file. `#CYCLE!` stays a text.
- A CSV holds the results.
- `ExportCell.formula`, `ExportRow.id` and `ExportData.document` carry the formulas to a writer of your own.

## Dates of the `period` format

With or without the option, a column with the format `period` whose unit is `day`, `month` or `year` is a date cell with a pattern when a spreadsheet shows the pattern as the screen does: `Nov 21, 2026`, `November 2026` and `2026` in `en-US`. Else it is its text. A week, a quarter, an hour and a day of the week are texts.

## When a formula goes into the file

A cell gets the formula of the file only when the whole formula means the same in Excel:

- every cell that it reads is in the file and holds there the value that it holds in the table: no day, no cell written as its text;
- a range is one column whose rows are in the file in the order of the document and next to each other;
- each function is in `EXCEL_FUNCTIONS`.

A function that came after Excel 2007 (`CONCAT`, `IFS`, `SWITCH`, `IFNA`, `TEXTJOIN`) is written with the prefix `_xlfn.` that the file format asks for. `SUMIF`, `AVERAGEIF`, the lookups, `VALUE`, `TEXT`, `TODAY`, `NOW`, `EOMONTH` and the date functions go as their result: Excel stretches a smaller range of `SUMIF`, searches sorted data in halves, reads its own locale in `VALUE` and `TEXT`, computes `TODAY` and `NOW` again when it opens the file, and has no day text.

Else the cell holds its result, as without the option. A file without the option holds the same bytes as the file of a table without formulas.

See the [Formula tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=formula) and the page [Export](./export.md).

## Names

- **Options of `toXlsx` and `downloadXlsx`:** `formula`, with `excelFormulas()` of the formulas entry.
- **Exports of the formulas entry:** `excelFormulas`, `EXCEL_FUNCTIONS`.
- **Exports of the export entry:** the type `XlsxFormulas`.
- **Fields of the data:** `ExportCell.formula`, `ExportRow.id`, `ExportData.document`.
