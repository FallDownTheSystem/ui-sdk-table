# Columns

Say what each column shows, how its value becomes text, and how a person can change its place and width.

A column is a plain object of the type `ColumnDef<Row>`. The table reads the list in its order. A person can hide, move, resize and pin columns when the columns allow it, and each of these changes is state with a `v-model`.

<Example name="column-definitions/formats" caption="Press a header to sort by it. Copies, Price and Share sit under one header group, Sales. The dates and the numbers are text of the en-US locale." />

## The value of a cell

- `id` names the column. Without `key` and `value`, it is also the property of the row that holds the value.
- `key` names another property of the row.
- `value(row)` computes the value. It wins over `key`. A sort, a filter, a search and a total read this value.
- `header` is the text of the header cell. Without it, the header shows the id.
- `columns` makes the column a header group: one header cell above the columns that it holds. A header group holds no cells. Its id in `columnVisibility` hides all of its columns.

## Formats

`format` decides how a value becomes text. Without it, the value is shown as it is. The names are `text`, `integer`, `decimal`, `number`, `currency`, `percentage`, `date`, `time`, `datetime`, `url`, `email`, `boolean`, `truncate`, `relativeTime` and `period`.

`formatOptions` fine-tunes the format:

- `currency` takes `currency` (an ISO code) and needs `showUnit: true` to show the sign. Without `showUnit`, the number is a plain decimal.
- `percentage` reads 0.25 as 25 %. `scale: 'percent'` reads 25 as 25 %. It needs `showUnit: true` to show the percent sign.
- `date` and `datetime` take the options of `Intl.DateTimeFormat`, such as `dateStyle` and `timeZone`.
- Every format takes `prefix`, `suffix` and `locale`, and the texts for an empty value (`nullValue`, `emptyValue`).

The `locale` option of the table is the locale of every format. A cell carries the name of its format as `data-format`, for a style that aligns numbers to the end.

## Width, order and pins

<Example name="column-definitions/layout" caption="Drag the edge of a header to resize a column, or drag a header to move it. Press the buttons to hide the country and to pin the city. The page can scroll the table sideways, and a pinned city stays." />

- `resizable` and `reorderable` on the table let a person resize and move every column. The same keys on a column say otherwise for that column.
- `width`, `minWidth` and `maxWidth` are pixels. A resize by a person wins over `width`. `columnMinWidth` is the smallest width of a column without `minWidth`, 48 by default.
- `hideable: false` keeps a column in view.
- `lead: true` puts a column before every other column, whatever the order says. It sticks to the start with the first pinned column. Use it for the checkbox of a row.
- A table whose columns can be resized is as wide as its columns (`inline-size: var(--table-width)`). Do not stretch it to its frame: a drag starts from the width that the column has on the screen.

The state of the columns:

| State | Value | Change |
| --- | --- | --- |
| `columnVisibility` | `{ [columnId]: false }` hides a column | `setColumnVisibility`, `toggleColumnVisibility`, `showAllColumns`, `hideAllColumns` |
| `columnOrder` | Column ids in display order. Columns that are not listed come after them, in definition order | `moveColumn`, `setColumnOrder`, a drag |
| `columnWidths` | `{ [columnId]: pixels }` | `setColumnWidth`, a drag. `columnWidthsCommit` runs once when a drag ends |
| `columnPinning` | `{ start?: ids, end?: ids }` | `pinColumn(id, 'start' \| 'end' \| null)` |

## Back to the start

`controller.hideAllColumns()` hides every column that can be hidden, in one change. A column with `hideable: false` and a `lead` column stay. The first column in view stays when no other would.

`resetColumnVisibility()`, `resetColumnOrder()` and `resetColumnPinning()` bring a state back to what the table started with: its `default…` prop, else the empty state. They report the reason `reset`. `resetColumnWidths()` takes every width away.

A `v-model:column-visibility` that hides every column gives a table without columns. The table does not correct the state of its owner.

## Keys

| Key | On a header cell |
| --- | --- |
| Space | Picks a column up, with `reorderable`. The arrows move it, Space drops it, and Escape puts it back |
| Alt with Left or Right | Makes the column narrower or wider by 10 pixels, with Shift by 50 |
| Enter | Sorts a column that is `sortable` |

## Attributes and CSS variables

- `data-column` on every cell, with the column id. `data-format` on every cell of a column with a format.
- `data-pinned` (`start` or `end`) on a pinned cell, and `data-pinned-edge` on the last pinned cell before the free ones. `--table-pin-offset` is how far the cell sticks from its edge.
- `data-lead` on the cells of a lead column.
- `data-moving` on a header that is picked up, and `data-grabbed` while a pointer drags it.
- `--table-width` on the table and `--table-column-width` on a cell, for a table with widths.
- The handle of a resize is the part `[data-slot='table-resizer']`, with `data-dragging` during a drag. It needs `position: absolute` in a cell with `position: relative`, and `touch-action: none`.

See the [Columns tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=columns).

## Keep going

- [Cells and slots](./cells-and-slots.md) puts your own content in a cell.
- [Styling](./styling.md) lists every attribute that a style reads.
