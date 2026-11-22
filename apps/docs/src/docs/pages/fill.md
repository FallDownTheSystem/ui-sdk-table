# Fill

Let a person drag the corner of a range to fill more cells, with a series where the values have one step.

Use it in a sheet where rows repeat a value or go on with a series: weeks, days, numbers.

<Example name="fill/fill" caption="Press Fill down from two rows: weeks 3, 4 and 5 and the days 2027-01-18, 01-25 and 02-01 follow, and the rooms repeat A1, B2. Or select a cell and drag the small square at its corner down." />

## The handle

The fill handle is the part `[data-slot='table-fill-handle']`: an empty `span` inside the cell at the end corner of the selected cells.

- Place it with `position: absolute` at `inset-block-end` and `inset-inline-end` of its cell, which needs `position: relative`. The logical sides put it at the left corner from right to left.
- Give it `touch-action: none`.
- `fill-handle="vertical"` or `"horizontal"` keeps the handle and the keys on one axis. `:fill-handle="false"` with `sheet` takes both away.

## A drag

- A drag fills along the rows or along the columns, whichever the pointer went further on.
- While it runs, the table has `data-filling`. Each cell that would be filled has `data-fill-target` and `data-fill-edge` (`top`, `right`, `bottom`, `left`), so a line around the target is the same CSS as the line around a range.
- Near an edge of the scroll frame the table scrolls, also with a row window.
- Escape ends the drag and changes nothing.

## What it writes

- A source of one line repeats.
- A source of two or more lines goes on when it is numbers with one step (also negative, a fraction, upward and backward) or days with one step: `2028-02-22`, `2028-02-29` goes on with `2028-03-07`. Everything else repeats in its order.
- A fill along the rows passes values. A fill along the columns passes text through the `parse` of the next column.
- A cell that cannot be edited keeps its value and its place in the line.
- A fill from pinned rows into the rows of the list is refused: they are no neighbours in the data.

## All or nothing, one step

Each value passes the schema of its column. One refusal stops the fill before any cell changes, and the table says which column refused which text. A fill is one report through `@cell-edit` with the reason `fill`, and one step of the history. Its undo puts back the values of before, also for rows that were sorted, filtered or removed since.

## From code

`controller.fillCells('down' | 'up' | 'forward' | 'back', source = 1)` fills the selected cells from their first `source` lines. It works without the `fill-handle` option, which is about the handle and the keys. It throws for one selected line, for a wrong direction (with the valid ones), and with the reason of a refusal.

## Keys

| Key | With `fill-handle` |
| --- | --- |
| Control or Command with D | Fills the selected cells down from their first row |
| Control or Command with R | Fills the selected cells forward from their first column |
| Escape during a drag | Ends the drag and changes nothing |

With one line selected the keys stay the browser's: Control+R is its reload.

See the [Sheet tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=sheet).

## Names

- **Options:** `fillHandle` (`true`, `'vertical'`, `'horizontal'`, `false`).
- **Controller:** `fillCells`.
- **Attributes:** `data-filling` on the table; `data-fill-target` and `data-fill-edge` on a cell; the part `table-fill-handle`.
- **Messages:** `cellsFilled`, `fillRefused`, `fillNowhere`, `fillOverPinned`.
- **Exports:** `fillValues`, `fillLine`, `TableFillHandle`, and the types `FillWay`, `FillDirection`, `FillDraft`.
