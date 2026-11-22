# Formats

Let a person make cells bold, give them a colour, or show a number as a percentage, and save that with the document.

Use it in a sheet with a toolbar. A format of a cell is data, as the values are: the app saves it and passes it back.

```vue title="formats.vue"
<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import {
	createTableController,
	Table,
	useTableView,
	type CellFormat,
	type CellFormats,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'

type Fund = { id: string; fund: string; fee: number; year: number }

const funds: Fund[] = [
	{ id: 'f1', fund: 'Nordic Index', fee: 0.002, year: 0.0784 },
	{ id: 'f2', fund: 'Global Bonds', fee: 0.0035, year: -0.0136 },
	{ id: 'f3', fund: 'Small Caps', fee: 0.011, year: 0.1207 },
]

const columns: ColumnDef<Fund>[] = [
	{ id: 'fund', header: 'Fund' },
	{ id: 'fee', header: 'Fee', format: 'decimal' },
	{ id: 'year', header: 'One year', format: 'decimal' },
]

const controller = createTableController()
const view = useTableView(controller)
// Formats are plain data that the app saves with its document.
const formats = shallowRef<CellFormats | undefined>({ cells: { f2: { year: { color: 'alert' } } } })

// The format of the active cell gives the pressed state of the buttons.
const active = computed<CellFormat>(() => {
	const at = view.value?.activeCell
	void formats.value
	return at ? controller.getCellFormat(at.rowId, at.columnId) : {}
})
</script>

<template>
	<div>
		<Button :aria-pressed="active.bold === true" @click="controller.toggleCellFormat('bold')">
			Bold
		</Button>
		<Button @click="controller.formatCells({ format: 'percentage', decimals: 1 })">Percent</Button>
		<Button @click="controller.formatCells({ fill: 'accent' })">Mark</Button>
		<Button @click="controller.clearCellFormats()">Clear</Button>
	</div>
	<!-- A colour of a format is a name. The style of the page gives each name its colours. -->
	<Table
		v-model:cell-formats="formats"
		:rows="funds"
		:columns="columns"
		:controller="controller"
		:format-colors="['accent', 'alert']"
		cell-selection
		aria-label="Funds"
	/>
</template>
```

Select the three cells under Fee and press Percent: they read 0.2%, 0.4% and 1.1%. Press Bold: the button shows it pressed. Clear takes the formats of the selected cells away.

## The value

`CellFormats` is `{ columns?: { [columnId]: CellFormat }, cells?: { [rowId]: { [columnId]: CellFormat } } }`.

- A property of a cell wins over the same property of its column, and both win over the `format` and `formatOptions` of the column definition.
- A format follows its row through a sort, a filter and a page.
- Pass it as `v-model:cell-formats`, `cell-formats` or `default-cell-formats`.

`CellFormat` has `format` (`text`, `integer`, `decimal`, `currency`, `percentage`, `date`, `datetime`), `decimals` (0 to 10), `currency` (an ISO code), `dateStyle` (`short`, `medium`, `long`, `full`), `align` (`start`, `center`, `end`), `bold`, `italic`, `color` and `fill`.

## Change formats

```ts
controller.formatCells({ bold: true, fill: 'green' }) // the selected cells
controller.formatCells({ format: 'percentage', decimals: 1 }, { columns: ['share'] })
controller.formatCells({ fill: null }, { from: { rowId: 'a', columnId: 'price' } })
controller.clearCellFormats()
controller.toggleCellFormat('bold') // for a toolbar button
controller.getCellFormat(rowId, columnId) // for the pressed state
```

- A patch with `null` for a key takes that property away.
- A wrong property, name or colour throws with the valid ones.
- Control or Command with B and with I make the selected cells bold and italic, with `sheet`.

## Looks are attributes

- A cell has `data-align`, `data-bold`, `data-italic`, `data-color`, `data-fill`, and `data-format` with the name that decides its text. The table writes no class and no style.
- A colour is a name of `format-colors` and nothing of CSS. The style of the app gives each name its colours and holds the contrast.
- Give a fill an opaque background, so a pinned cell with a fill hides what scrolls under it. Decide what a selected cell with a fill looks like.
- `cellAttrs` of the caller cannot overwrite these attributes.

## The text of a cell

- The format makes the text: 0.342 with `{ format: 'percentage', decimals: 1 }` reads `34.2%`.
- The footer and the totals of a group follow the column layer.
- A CSV and an Excel file hold the text of the screen. In an Excel file a cell whose own format decides its text is written as text.
- A copy holds the plain value, as the editor shows it, so a paste into the same columns gives the same values.
- The `#cell` and `#col-{id}` slots get `format`, the format that the cell has of its own, and `text`.
- A search and the label of a group read the column definition and do not follow a format of a cell.

## A percentage in the text field

A cell that shows `25%` opens with `25`, and `30` or `30%` in the field is 0.3, as in a column with the `percentage` format. Every other text holds the value itself: a paste, a fill and `editCell` read `0.3` as 0.3, as a copy gives it, and a text with a percent sign (`30%`) is that percentage. A column with a `parse`, or with `scale: 'percent'` in its `formatOptions`, keeps the plain value in its field.

## Whole columns

When the selected cells are every row that the table has, `formatCells` formats the columns. The format then holds for rows that come later, and the value stays small. Never with `manual-page`, where the table does not have every row.

Format a column, not 50,000 cells, when the value is saved as JSON: cells that share a format share one object in memory, but JSON writes one entry for each row.

## History

A change of formats is one step: its entry in `getHistory()` has `formats: true` and `cells: 0`. An undo reports the formats of before through `update:cell-formats` and `cell-formats-change` with the reason `undo`, property by property, so a format that the owner gave another cell meanwhile stays. `details.cancel()` in `cell-formats-change` refuses a change.

## Rows that left

The table keeps the format of a row that is gone, because the row can come back with the next page. `pruneFormats(formats, rowIds, columnIds)` drops them when the owner knows better. `setFormats(formats, place, patch)` and `revertFormats` are the pure functions behind the controller.

## Rendering

With `v-model:cell-formats` the table renders whole at a change, as for every prop that the owner holds. With `default-cell-formats` the table keeps the value and only the changed cells render. For a large sheet without a row window, prefer `default-cell-formats` and listen to `cell-formats-change`.

See the [Sheet tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=sheet).

## Names

- **Options:** `cellFormats`, `defaultCellFormats`, `formatColors`.
- **Events:** `cell-formats-change`, `update:cell-formats`.
- **Controller:** `formatCells`, `clearCellFormats`, `toggleCellFormat`, `getCellFormat`.
- **View:** `cellFormats`.
- **Slot props:** `format` in `#cell` and `#col-{id}`.
- **Attributes:** `data-align`, `data-bold`, `data-italic`, `data-color`, `data-fill`, `data-format`.
- **Messages:** `cellsFormatted`.
- **Exports:** `setFormats`, `revertFormats`, `pruneFormats`, `resolveFormat`, `CELL_FORMAT_NAMES`, `CELL_ALIGNS`, `CELL_DATE_STYLES`, and the types `CellFormat`, `CellFormats`, `CellFormatPatch`, `CellFormatName`, `FormatPlace`, `FormatTarget`.
