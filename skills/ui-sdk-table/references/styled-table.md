# Build the styled table of an app

The styled table is the one table component of a design system. A page of the app passes rows, columns and a few options, and gets the looks and the controls. `docs/styled-table.md` lists, for each control, what the library gives and what the app writes. Read it first; this file holds the order of the work and the faults that are easy to make.

## The order of the work

1. **The wrapper.** One component that renders `Table` and passes its props, events, slots and a `controller` through. Take the controller from a prop, else make one with `createTableController()`, and expose it.
2. **The looks** of the parts and the states, from `docs/styling.md`.
3. **The controls beside the table**, one at a time: the search field, the filters, the column menu, the pages, the export menu. Each is a UI SDK component that reads `useTableView(controller)` and calls the controller.
4. **The sheet controls**, when the app needs them (see [data-sheet.md](data-sheet.md)).
5. **The words**: `messages` in the language of the app.

Test each step before the next one (see [testing.md](testing.md)).

## The wrapper

- **A boolean prop that is not set must reach the table as not set.** Vue reads such a prop as `false`, and the table then loses its own default. Give each boolean prop of the wrapper the default `undefined`.
- **Keep `rowAttrs` and `cellAttrs` the same functions for the life of the table.** Read the props inside them. A new function is a new option, and every row renders again.
- **Pass arrays and objects as constants.** A literal in the template of the wrapper or of a page is a new value at each render; with many rows that costs a second for each key.
- **Name clash.** A design system with a `Table` of its own imports this one as `import { Table as HeadlessTable } from 'ui-sdk-table-vue'`.
- **The view is not reactive.** A control reads `useTableView(controller)`. It holds `undefined` until the table is there.

## Looks

- Keep the classes of the design system in one place. A class reaches a row or a cell through `rowAttrs` and `cellAttrs`, which get the `kind` of the row or cell.
- A state shows through a selector of an attribute (`[data-pinned]`, `[aria-selected='true']`, `[data-active]`), never through a class that a script switches. `rowAttrs` runs when rows render, not for a new selection.
- A cell that sticks paints an opaque background, and the tint of its row with it: the fill of the row does not reach under a sticky cell.
- An open editor takes the size of its cell. A field with its own width makes the column wider while it is open.

## Controls

- **Search.** Bind the field to `useTableSearch(controller).text`. Escape calls `clear()`, Enter `flush()`. Use one key listener for both keys. The table announces nothing for a search: announce the rows found in a polite live region when `filter` changes.
- **Filters.** The counts of a list come from `getFacets(columnId)`. The ends of a slider and of a calendar come from `getFacets(columnId, { rows: 'all' })`, so they do not move while a person filters another column. List the filter of a hidden column, so a person can see why rows are gone.
- **Column menu.** `setColumnVisibility` throws for a column with `hideable: false`: leave its box out.
- **Pages.** `controller.setPage` starts at 1. With pages from a server, `lastPageKnown` can be false.
- **Export.** Load `ui-sdk-table-vue/export` with `import()` when a person asks for a file, and show a message when it fails.
- **Focus after a choice.** A control that changes cells gives focus back to the active cell (`[data-active]`).
- **A refusal.** A method that refuses throws. Show the `cause` of the error when it is a text, else its `message`.

## Find the page

| Control | Page |
| --- | --- |
| Search, sort, filters, facets | `docs/sort-filter-and-search.md` |
| Column menu, widths, pins, order | `docs/column-definitions.md` |
| Pages, rows from a server | `docs/pages-and-server-mode.md` |
| Groups and totals | `docs/groups-and-totals.md` |
| Selection, keys | `docs/selection-and-keyboard.md` |
| Export | `docs/export.md` |
| Every method and view field | `docs/controller-and-view.md`, `docs/reference-controller.md`, `docs/reference-view.md` |
