# Styling

Give the table the looks of your app with CSS that reads its parts and its state.

The table has no looks of its own: no class, no colour and no inline style for state. Every element carries a `data-slot`, and its state shows as `aria-*` and `data-*` attributes and a few CSS variables. A style reads those. Write it in plain CSS, in Tailwind CSS or in the tokens of your design system.

```vue title="sticky.vue"
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Reading = {
	id: string
	station: string
	day: string
	low: number
	high: number
	rain: number
	wind: number
}

const STATIONS = ['Bergen', 'Cork', 'Porto', 'Gdansk', 'Tromso', 'Nantes']
const readings: Reading[] = Array.from({ length: 18 }, (_, index) => ({
	id: `r${index}`,
	station: STATIONS[index % STATIONS.length] ?? '',
	day: `2026-11-${String(10 + Math.floor(index / 6)).padStart(2, '0')}`,
	low: 2 + ((index * 3) % 7),
	high: 8 + ((index * 5) % 9),
	rain: (index * 7) % 13,
	wind: 10 + ((index * 11) % 25),
}))

const columns: ColumnDef<Reading>[] = [
	{ id: 'station', header: 'Station', width: 120 },
	{ id: 'day', header: 'Day', width: 120 },
	{ id: 'low', header: 'Low, °C', width: 110, format: 'integer', aggregate: 'min' },
	{ id: 'high', header: 'High, °C', width: 110, format: 'integer', aggregate: 'max' },
	{ id: 'rain', header: 'Rain, mm', width: 110, format: 'integer', aggregate: 'sum' },
	{ id: 'wind', header: 'Wind, km/h', width: 120, format: 'integer', aggregate: 'max' },
]
</script>

<template>
	<!-- The frame scrolls both ways. The header, the footer and the station stay in view. -->
	<div class="frame">
		<Table
			:rows="readings"
			:columns="columns"
			:default-column-pinning="{ start: ['station'] }"
			sticky-header
			sticky-footer
			aria-label="Weather readings"
		/>
	</div>
</template>

<style scoped>
.frame {
	max-inline-size: 460px;
	max-block-size: 260px;
	overflow: auto;
	border: 1px solid #e4e4e7;
}

/* What sticks needs a background of its own, so the rows that scroll under it do not show through. */
.frame :deep(tr[data-sticky] > *),
.frame :deep([data-pinned]) {
	background: #fff;
}

.frame :deep([data-pinned-edge]) {
	box-shadow: inset -1px 0 0 #a1a1aa;
}
</style>
```

Scroll the frame down and to the side. The header and the footer stay at their edges, and the Station column stays at the start. Each sticky cell has a background, so the rows under it do not show through.

## Parts

| Part | `data-slot` | Element |
| --- | --- | --- |
| The table | `table` | `table` |
| The head, the body and the foot | `table-head`, `table-body`, `table-foot` | `thead`, `tbody`, `tfoot` |
| A column | `table-col` | `col` |
| A header row | `table-header-row` | `tr` |
| A body row and a footer row | `table-row` | `tr` |
| The row of an empty or a loading table | `table-plain-row` | `tr` |
| The stand-in for rows of the row window | `table-spacer` | `tr` |
| A cell | `table-cell` | `th` in the head and for a row number, else `td` |
| The editor of a cell | `table-editor` | `input` |
| Why an edit was refused | `table-edit-error` | `span` |
| The handle of a resize | `table-resizer` | `span` |
| The fill handle of a sheet | `table-fill-handle` | `span` |

A header cell of a sortable column holds a `button` without a `data-slot`. A cell that your slot fills holds what the slot gives.

## State as attributes

| What | Where | Attribute |
| --- | --- | --- |
| Kind of a row | `tr` | `data-kind`: `row`, `group`, `detail`, `empty`, `letters` |
| Kind of a cell of a group row | `td` | `data-kind`: `group-label`, `group-total`, `group-blank` |
| Column of a cell | cell | `data-column` |
| Format | cell | `data-format`, the name of the format that makes the text |
| Sort | header cell | `aria-sort`, `data-sorted` (`asc`, `desc`), `data-sort-index` from 1 |
| A selected row | `tr` | `aria-selected="true"`, `data-selected`. A row that can be selected and is not has `aria-selected="false"` |
| An open tree row, group or detail | `tr` | `aria-expanded`, `data-expanded` |
| The level of a row of a tree or a group | `tr` | `aria-level`, from 1 |
| A pinned cell | cell | `data-pinned` (`start`, `end`), `data-pinned-edge` on the last one |
| A pinned or sticky row | `tr` | `data-pinned` (`top`, `bottom`), `data-sticky` (`top`, `bottom`) |
| A lead column | cell | `data-lead` |
| The cell with the tab stop | cell | `data-active` |
| A cell in a selected range | cell | `data-selected`, `data-range-edge` (`top`, `right`, `bottom`, `left`) |
| A cell that can be edited, or is | cell | `data-editable`, `data-editing`, `data-checking` while a check runs |
| A refused text | editor | `aria-invalid="true"`, `data-invalid` |
| Rows on their way | table | `aria-busy`, `data-loading` |
| Options that change keys | table | `data-cell-selection`, `data-sheet`, `data-row-window` |

The attributes of the data sheet and of formulas are on their own pages.

## CSS variables

| Variable | On | What it holds |
| --- | --- | --- |
| `--table-width` | table | The sum of the widths, for a table whose columns are resized |
| `--table-column-width` | cell | The width of the column of the cell |
| `--table-pin-offset` | pinned cell | How far it sticks from its edge |
| `--table-pin-start-size`, `--table-pin-end-size` | head, body | The widths of the pinned columns at each edge |
| `--table-sticky-offset` | sticky cell | How far it sticks from its edge |
| `--table-sticky-top-size`, `--table-sticky-bottom-size` | head, body | The heights of what sticks at each edge |
| `--table-row-height` | table | The height of a row in the row window |
| `--table-spacer-size` | spacer row | The height of the rows that it stands in for |

A page with a fixed header or footer of its own sets `--table-sticky-top` and `--table-sticky-bottom` on the table or a parent, and the sticky rows stop there.

## Sticky rows and pinned columns

The table marks what sticks. The style makes it stick:

```css
[data-slot='table'] tr[data-sticky] > * {
	position: sticky;
	z-index: 2;
	background: white;
}
[data-slot='table'] tr[data-sticky='top'] > * {
	inset-block-start: var(--table-sticky-offset, 0);
}
[data-slot='table'] tr[data-sticky='bottom'] > * {
	inset-block-end: var(--table-sticky-offset, 0);
}
[data-slot='table-cell'][data-pinned] {
	position: sticky;
	z-index: 1;
	background: white;
}
[data-slot='table-cell'][data-pinned='start'] {
	inset-inline-start: var(--table-pin-offset);
}
[data-slot='table-cell'][data-pinned='end'] {
	inset-inline-end: var(--table-pin-offset);
}
```

- A sticky cell needs an opaque background, so the rows that scroll under it stay hidden.
- A row sticks to the nearest parent that scrolls. A frame with `overflow-x: auto` alone leaves the page as the frame of the rows.
- A cell that gets focus scrolls into view. Give the cells `scroll-margin-block: var(--table-sticky-top-size, 0) var(--table-sticky-bottom-size, 0)` and `scroll-margin-inline: var(--table-pin-start-size, 0) var(--table-pin-end-size, 0)`, so it stops beside what sticks and not under it.

## Right to left

Set `dir="rtl"` on the page or a parent. The arrow keys follow the reading direction, and a pin to the start sticks at the right edge. Use logical properties, such as `inset-inline-start`, in your style.

See the [Style tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=style): four looks of the same table, each in CSS of its own.

## Keep going

- [Cells and slots](./cells-and-slots.md) gives rows and cells a class of your own.
