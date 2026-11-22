# Export

Write the rows of the table to a CSV or an Excel file, with the text that the screen shows.

`controller.exportData()` collects the cells as plain data. The writers are in the entry `ui-sdk-table-vue/export`, so a page without an export does not carry them: load it with `import()` where a person asks for a file.

```vue title="files.vue"
<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Order = { id: string; customer: string; city: string; total: number }

const orders: Order[] = [
	{ id: 'o1', customer: 'Northway', city: 'Oslo', total: 1240 },
	{ id: 'o2', customer: 'Sola', city: 'Seville', total: 860.5 },
	{ id: 'o3', customer: 'Arc', city: 'Lyon', total: 2310 },
]

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer', sortable: true },
	{ id: 'city', header: 'City' },
	{ id: 'total', header: 'Total', format: 'decimal', aggregate: 'sum' },
	// The id is for the screen only.
	{ id: 'id', header: 'Id', exportable: false },
]

const controller = createTableController()
const csv = shallowRef('')

async function preview() {
	// The writers are an entry of their own: they load at the first export.
	const { toCsv } = await import('ui-sdk-table-vue/export')
	csv.value = toCsv(controller.exportData({ totals: true }))
}

async function download() {
	const { downloadXlsx } = await import('ui-sdk-table-vue/export')
	await downloadXlsx(controller.exportData(), 'orders')
}
</script>

<template>
	<div>
		<Button @click="preview">Show the CSV</Button>
		<Button @click="download">Download Excel</Button>
	</div>
	<Table
		:rows="orders"
		:columns="columns"
		:controller="controller"
		locale="en-US"
		aria-label="Orders to export"
	/>
	<pre v-if="csv" data-testid="csv">{{ csv }}</pre>
</template>
```

Press Show the CSV. The file holds the customer, the city and the total of each order and a row of totals, and no id. Download Excel saves the same rows as orders.xlsx.

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
- `toXlsx(data, options)` returns the bytes of the file. Its options: `sheetName`, `freezeHeader` (true), `compress` (true), and `formula` for a table with formulas: see [An Excel file with formulas](./excel-formulas.md).
- `downloadCsv(data, filename, options)` and `downloadXlsx(data, filename, options)` save a file in the browser.

With `manualPage`, the table has one page of a server, so each set of rows is of that page.

## Names

- **Export entry:** `toCsv`, `toXlsx`, `downloadCsv`, `downloadXlsx`, `downloadFile`, `zip`, `XLSX_TYPE`, and the type `XlsxFormulas`.

Every option, event, slot, controller method and view field of this page is in the reference: [Table](./reference-table.md), [Controller](./reference-controller.md) and [View](./reference-view.md).

See the [More tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=more).
