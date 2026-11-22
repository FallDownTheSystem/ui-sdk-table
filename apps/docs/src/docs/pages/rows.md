# Rows

Show rows with child rows, a detail row under a row, rows pinned to an edge, and many thousand rows in a window.

Each row needs a stable id: its `id` property, or what `getRowId(row, index, parent)` returns. The table never copies or changes a row object.

## Tree rows

`getChildren(row)` gives the child rows of a row. With it, the table is a tree. The root then has the role `treegrid`, and each row has `aria-level`, `aria-posinset` and `aria-setsize`.

<Example name="rows/tree" caption="Press the arrow before docs to open the folder. Sort by Size: the child rows sort inside their folder." />

- `expanded` holds the ids of the open rows. `expand`, `collapse`, `toggleExpanded`, `expandAll` and `collapseAll` change it.
- The `#cell` slot gets `expandable`, `expanded`, `level` and `toggleExpanded`. Put the button that opens a row in a slot of your own.
- A row of a tree has `aria-level`, `aria-posinset` and `aria-setsize`, and `aria-expanded` when it has child rows.
- `sortChildren: false` keeps the child rows in their order.

## Detail rows

`hasDetail(row)` names the rows that have a detail row: one wide row under the row, which opens and closes as a tree row does.

<Example name="rows/detail" caption="Press the arrow before Sola to open its note. Northway is paid and has no note, so it has no arrow." />

- The `#detail` slot fills the detail row. It gets `row`, `node` and `toggleExpanded`.
- The detail row has `data-kind="detail"`.
- Pass the same function while its answers are the same: a new function makes the table list its rows again.

## Pinned rows

`rowPinning` holds the ids of the rows that stay at the top or the bottom edge: `{ top?: ids, bottom?: ids }`.

<Example name="rows/pinned" caption="Press the star before Honey to pin it. It moves to the top with Dark coffee, and a sort leaves both there." />

- A filter or a page does not hide a pinned row. The totals are of the rows that pass the filter, so a pinned row that the filter refuses is in view and not in a total.
- A row with child rows cannot be pinned.
- `controller.pinRow(rowId, 'top' | 'bottom' | null)` pins and frees a row. The `#cell` slot gets `pinned`.
- A pinned row has `data-pinned` and `data-sticky` with its edge. Style it as a sticky row: see [Styling](./styling.md).

## The row window

`rowWindow` renders only the rows near the scroll frame, with a spacer row for the rest.

<Example name="rows/window" caption="Scroll the frame, or press Row 5,000. The table renders a few dozen rows at a time, and a jump takes one step." />

- The frame is the nearest parent whose content is higher than itself, or the page.
- `rowHeight` gives every row one height in pixels. Without it, the window measures each row, and `estimatedRowHeight` (36 by default) is the height of a row that it did not measure yet. With `hasDetail` it measures too.
- `overscan` is how many rows more than the frame shows it renders on each side, 8 by default.
- `controller.scrollToRow(rowId, align)` scrolls a row into view in one step, also when the row is not rendered yet. `align` is `start`, `center`, `end` or `nearest` (the default).
- The table has `data-row-window` and the CSS variable `--table-row-height`. A spacer row is `[data-slot='table-spacer']` and needs `block-size: var(--table-spacer-size)`.
- `aria-rowcount` and `aria-rowindex` count every row, so a screen reader says the place of a row among all of them.

## Sticky header and footer

`stickyHeader` and `stickyFooter` keep the header rows and the footer row in view while the rows scroll. The rows get `data-sticky`; the style makes them stick.

## Names

- **Types:** `TableRow`, `RowPin`.

Every option, event, slot, controller method and view field of this page is in the reference: [Table](./reference-table.md), [Controller](./reference-controller.md) and [View](./reference-view.md).

See the [Rows tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=rows).
