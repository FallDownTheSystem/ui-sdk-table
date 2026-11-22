# Sort, filter and search

Sort by one or more columns, filter each column, and search every column with a pause in the typing.

The rows pass a sort, then the filters. Sort is first on purpose: a filter keeps the order of its input, so a key in the search field never sorts. The `sort` and `filter` states hold what a person chose.

## Sort

A column with `sortable: true` gets a button in its header. A press sorts up, the next press down, and the third press takes the sort away.

<Example name="sort-filter-and-search/sort" caption="Press Club, then hold Shift and press 10 km. The clubs stay together, and inside each club the fastest runner comes first. The number before each header is its place in the sort." />

- `sort` is a list of `{ id, desc? }`. The first rule sorts first.
- `multiSort` decides how a press adds a column. `'modifier'` (the default): a press replaces the sort, and a press with Shift, Control or Command adds the column. `'none'`: one column at a time, whatever key is held. `'always'`: each press adds the column. Enter on a header follows the same rule.
- `alwaysSorted`: a press on the only column of the sort turns the order and never clears it. It does not sort a table that starts without a sort; give `defaultSort` for that.
- `compare(a, b, rowA, rowB)` on a column gives it its own order, such as Urgent before Low.
- `sortChildren: false` keeps the child rows of a tree in their order.
- `toggleSort(event)` of the `#header` slot passes the event, and the table reads the keys. `controller.toggleSort(id, { append: true })` and `sortBy(id, direction, { append: true })` throw in the mode `none`.
- A `sort` of the owner with more columns than the mode allows is left as it is.

## Search with a pause

<Example name="sort-filter-and-search/search" caption="Type desi. The field shows each letter at once, and the table filters when the typing pauses. Escape clears the field, and Enter filters without the wait." />

`useTableSearch(controller)` gives a search field what it needs:

- `text`: the text of the field. A new text shows at once. The table filters when the typing pauses for `searchDebounce` milliseconds, 200 without the prop. With 0, each letter filters.
- `pending`: whether a text waits for its pause.
- `clear()`: empties the search at once, for a clear button and for Escape.
- `flush()`: filters now, for Enter.

The filter changes once, after the pause, with the reason `input-change`. `clear`, `setSearch`, `clearFilters` and a new search text from the owner of `v-model:filter` act at once and drop a text that waits.

- The search reads the text of each cell, as the screen shows it. `searchable: false` leaves a column out.
- `searchMode: 'fuzzy'` also finds near matches, with letters in order but apart. `fuzzyThreshold` (0 to 1) is the score that a match needs.
- The table says nothing to a screen reader about a search. Announce the rows found when `filter` changes, which is one time after the pause.

Without Vue, the same is `controller.inputSearch(text, event)`, `controller.flushSearch()`, and `search` and `searchPending` of `getView()`. `createDebounce(run, { debounce })` is the timer under it, with `call`, `cancel`, `flush` and `pending`.

## Filter a column

`filter.columns` holds one value for each column that filters. `controller.setColumnFilter(columnId, value)` sets it. The shape of the value decides how it matches, unless the column says otherwise with `filter`:

| Value | Kind | Matches |
| --- | --- | --- |
| A text | `text` | Cells whose text holds it |
| A list | `select` | Cells whose value is in the list |
| `{ min, max }` | `range` | Numbers between the ends. One end can be left out |
| `{ from, to }` | `dateRange` | Dates between the days. A day as `YYYY-MM-DD` means the whole day |

A function `filter(value, filterValue, row)` on a column decides for itself. An empty text, an empty list and an object of empty ends ask for nothing.

## Facets for filter controls

<Example name="sort-filter-and-search/facets" caption="Press Northway. The colors list counts only the shoes of Northway. Press Black too: two shoes match both. Press Northway again to let it go." />

`controller.getFacets(columnId)` answers with what a control offers:

| Control | Read |
| --- | --- |
| A list of values | `values`: each with `value`, `text` in the format of the column, and `count`. A combobox can search the list by `text`; `fuzzyScore` of `@ui-sdk/core/text-match` is the search of the table |
| A slider | `range`: `min`, `max` and `step`, the smallest change that the format of the column shows |
| A date picker | `days`: the first and the last day as `YYYY-MM-DD`, in the time zone of the column; `dates` holds the two moments |

- The facets follow the search and the filters of the other columns, and never the filter of the column itself, so a filter does not take away its own choices. `getFacets(columnId, { rows: 'all' })` gives the facets of every row.
- A value that the filter names stays in the list with the count 0 when no row holds it any more.
- `kind` says which filter fits the column: its `filter` option, or what its format says. A column of dates gives `dateRange`, a column of numbers `range`, any other column `text`.
- `sliderBounds(range, { steps: 100 })` gives a slider its ends and a step that a thumb can use: 1, 2 or 5 times a power of ten of the step of a cell, and about a hundred stops.
- A facet is counted when it is asked for, and kept until the search or another filter changes.

## Names

- **Exports:** `useTableSearch`, `createDebounce`, `sliderBounds`, `isEmptyFilter`, and the types `FilterKind`, `FilterMatcher`, `MultiSortMode`.
- **Attributes:** `aria-sort`, `data-sorted` and `data-sort-index` on a header cell.

Every option, event, slot, controller method and view field of this page is in the reference: [Table](./reference-table.md), [Controller](./reference-controller.md) and [View](./reference-view.md).

See the [Sort tiles](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=sort) and the [Filter tiles](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=filter) of the sink.
