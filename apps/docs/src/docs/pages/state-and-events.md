# State and events

Start a state where you want it, hold it in your app, and hear each change with its reason.

Every state of the table works the same way, as the state of a UI SDK component does. Use `default<Key>` to choose where a state starts, and `v-model:<key>` to hold it in your app.

<Example name="state-and-events/controlled" caption="Press a header to sort. The line under the table says the sort and its reason. Press Club alone and the app refuses it; press Goals, then Club with Shift, and the sort holds both." />

## Three props for each state

| Prop | What it does |
| --- | --- |
| `<key>` | The value of the state. With it, the app holds the state: `v-model:<key>` |
| `default<Key>` | Where the state starts when the table holds it |
| `@<key>-change` | Runs at each change, with `(value, details)` |

The keys are `sort`, `filter`, `groupBy`, `page`, `expanded`, `selected`, `columnVisibility`, `columnOrder`, `columnWidths`, `columnPinning`, `rowPinning`, `columnAggregates`, `cellFormats`, `cellFormulas` and `cellRange`.

`columnWidths` and `cellRange` change at each step of a drag. Their `@column-widths-commit` and `@cell-range-commit` run once, when the drag ends.

## The details of a change

- `details.reason` says why the state changed: `press`, `item-press`, `list-navigation`, `input-change`, `imperative` (a call of the controller), `reset`, `drag`, `move-key`, `resize-key`, `escape-key`, `shortcut`, `undo` or `redo`. The type is `TableReason`.
- `details.event` is the event behind the change, when there was one.
- `details.source` says how the person caused it: `mouse`, `touch`, `pen`, `keyboard`, `virtual`, `agent` for a call of an agent, or `programmatic`. Read it for analytics, never for behavior.
- `details.cancel()` refuses the change. The table then sends no `update:<key>`, so a `v-model` keeps its value.

## The table never changes your data

The rows and the columns are yours. The table never copies or changes a row object. Each row needs a stable id: the `id` property, or what `getRowId(row, index, parent)` returns.

An edit of a cell is no state. The table reports it through `@cell-edit`, and the app puts the value into its rows: see [Editing](./cell-editing.md).

With `v-model:<key>`, the table renders whole at each change, as for every prop that the owner holds. With `default<Key>`, the table keeps the value itself. For a large table, prefer `default<Key>` and listen to `@<key>-change` where the app only needs to hear a change.

## Keep going

- [Controller and view](./controller-and-view.md) changes a state from code, and reads what the table shows.
