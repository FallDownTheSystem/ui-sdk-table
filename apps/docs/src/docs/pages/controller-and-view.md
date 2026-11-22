# Controller and view

Change the table from a control beside it, and read what it shows now.

A toolbar, a search field, a filter control and the pages of a table live outside the table. They act through a controller and read a view. The same controller is what an agent calls.

<Example name="controller-and-view/outside" caption="Press Most delayed first, then Only delayed. The line above the table reads the view: how many flights pass and the sort. Every flight brings the rows back." />

## The controller

```ts
import { createTableController } from 'ui-sdk-table-vue'

const controller = createTableController()
```

Pass it as the `controller` prop. Then call its methods from anywhere:

- **Sort and filter:** `sortBy`, `toggleSort`, `setSearch`, `inputSearch`, `flushSearch`, `setColumnFilter`, `clearFilters`, `clearColumnFilters`.
- **Groups and pages:** `setGroupBy`, `setPage`, `setPageSize`, `nextPage`, `previousPage`, `firstPage`, `lastPage`.
- **Rows:** `expand`, `collapse`, `toggleExpanded`, `expandAll`, `collapseAll`, `select`, `toggleSelected`, `selectAll`, `selectRows`, `deselectRows`, `clearSelection`, `pinRow`, `scrollToRow`.
- **Columns:** `setColumnVisibility`, `toggleColumnVisibility`, `showAllColumns`, `hideAllColumns`, `moveColumn`, `setColumnOrder`, `setColumnWidth`, `pinColumn`, the `reset…` methods, `setColumnAggregate`.
- **Cells:** `editCell`, `startEdit`, `cancelEdit`, `selectCells`, `copyCells`, `pasteCells` and the methods of the data sheet.
- **Reads:** `getView`, `getFacets`, `getTotals`, `getSelectionSummary`, `exportData`, `subscribe`.

A method that gets a wrong argument throws a message that lists the valid values, such as `No column "age" to sort by. Columns: name, score.`

A controller can be made before the table mounts. Before the table exists, a call does nothing and answers `undefined`. `subscribe` is safe to call early: its listener waits for the table, runs once when the table is there, and then after each change. A table that comes in place of another (a new `key`) takes over every listener.

## The view

`useTableView(controller)` is a ref of `getView()` that follows the table. It holds `undefined` until the table is there.

| Field | What it holds |
| --- | --- |
| `sort`, `filter`, `groupBy`, `expanded`, `selected` | The state |
| `search`, `searchPending` | The text of a search field, and whether it waits for a pause |
| `page`, `pageSize`, `pageCount`, `rowCount`, `pageUnit`, `lastPageKnown` | The pages |
| `dataRowCount` | How many data rows pass the filters, child rows too |
| `columns`, `visibleColumns` | Every column that holds cells, and the columns in view in their order |
| `selectable` | The ids of the rows that `selectAll` selects |
| `hasExpandable`, `hasExpanded` | Whether something can open, and whether something is open |
| `loading` | The `loading` prop |
| `activeCell`, `cellSelection`, `canUndo`, `canRedo` | For a sheet |

A read that depends on the table, such as `controller.getFacets(id)`, goes in a `computed` that reads the view first. It is then asked again after each change.

Without Vue, `controller.subscribe(listener)` runs the listener after each change of the state, the rows or the columns, with the keys that changed. It returns the function that stops it.

## Names

- **Vue:** `createTableController`, `useTableView`, `useTableSearch`, `useSelectionSummary`.
- **Types:** `TableController`, `TableView`, `CellSelectionView`, `PageUnit`.

See the [More tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=more).
