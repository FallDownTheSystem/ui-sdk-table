# ui-sdk-table for Vue

> ui-sdk-table-vue is a headless table for Vue, built on UI SDK. It renders a real `<table>` with the roles, the keyboard and the state of a grid, and no looks. A styled table is the work of the app.

This file is the context an agent needs to build a table with ui-sdk-table-vue: what the library is and the conventions every page shares, then the pages of "Get started", then every page with one line. Read the pages of the features you use. It is generated from the docs of the repository, for this commit.

## Conventions

- `Table` takes `rows`, `columns` and `aria-label`. Each row has a stable `id`. The table never copies or changes a row object.
- Each state has three props: `<key>`, `default<Key>` and the event `<key>-change` with `(value, details)`. `details.reason` says why it changed, and `details.cancel()` refuses it. `v-model:<key>` controls it.
- An edit reaches the owner of the rows through `@cell-edit`. The table never writes a row; `applyEdits` is a helper for the owner.
- Every cell is a slot: `#cell`, `#col-<column id>`, `#header`, `#header-<column id>`, `#foot` and more. A slot gets the row, the column, the value and the text.
- Looks come from `data-slot` on every part and from state as `aria-*` and `data-*` attributes and a few CSS variables. The table sets no class and no inline style for state.
- `createTableController()` gives every action and read to code outside the table: `getView()`, `getFacets()`, `getTotals()` and `subscribe()` for the controls beside a table.
- An action that gets a wrong argument throws a message that lists the valid values.
- The controls around a table, such as a search field, a select or a pagination, come from the design system of the app. UI SDK ships them as headless components too.

The UI SDK docs for Vue are at `node_modules/@ui-sdk/vue/docs/llms.txt`.
