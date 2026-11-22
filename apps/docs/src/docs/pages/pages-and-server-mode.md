# Pages and server mode

Show the rows a page at a time, and take the rows, the pages, the sort and the filters from a server.

## Pages

A `page` state of `{ page, pageSize }` shows one page of the rows. Without it, the table shows every row. The page counts from 1.

<Example name="pages-and-server-mode/pages" caption="Press 3 or Next to go to another page. The line under the pages says where you are: page 3 of 5, 23 invoices." />

- The controls of the pages read the view: `page`, `pageCount`, `rowCount` and `pageSize`. The `Pagination` component of UI SDK draws them.
- `setPage`, `nextPage`, `previousPage`, `firstPage` and `lastPage` move. `setPageSize(size)` starts again from the first page, and `setPageSize(null)` shows every row.
- A new search starts on the first page.
- What the pages count is `pageUnit` of the view: `rows`, `groups` (each group, with its rows on the page of the group), `parents` (each top-level row, with its child rows on its page) or `mixed`.

## Rows from a server

<Example name="pages-and-server-mode/server" caption="Press Score to sort, or Next for the next page. The table asks for nothing itself: the app watches the sort and the page, asks its server, and passes the rows that come back." />

Three options tell the table that a server did the work:

- `manualSort`: the rows come in sort order. The table does not sort them. The `sort` state still changes, so the app knows what to ask for.
- `manualFilter`: the rows come with the search and the filters applied. The table does not filter them.
- `manualPage`: the rows are one page. The table shows them all, and the pages come from `rowCount`, the number of rows the server has after its filter.

A manual stage keeps the state: the sort, the filter and the page are requests to the owner.

- Without `rowCount`, a full page has a next page and a page that is not full is the last. An empty page after the first then sends the table one page back, so keep the rows of the page before, or set `loading`, while a page loads. `lastPage` needs the count.
- A step to the page that the table is on reports no change, so a listener that loads rows does not load them twice.
- `loading` tells assistive technology that rows are on their way (`aria-busy`), and the table keeps its rows. Without rows, the `#loading` slot shows.
- Every other feature works on the rows that the table has: an export, the totals and "select all" are of the page. Give `totals` for the totals of the server, and `facets` for the choices of every row of a filter control.
- With `manualPage`, a change of the page, the sort or the filter empties the history of a sheet.

## Names

- **Types:** `PageUnit`, `ColumnFacetsSource`, `TableTotalsSource`.

Every option, event, slot, controller method and view field of this page is in the reference: [Table](./reference-table.md), [Controller](./reference-controller.md) and [View](./reference-view.md).

See the [Rows tiles](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=rows) and the [Server tiles](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=server) of the sink.
