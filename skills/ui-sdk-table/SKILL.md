---
name: ui-sdk-table
description: Builds data tables in Vue with ui-sdk-table-vue, the headless table on UI SDK. Covers putting a table on a page, building the styled table component of an app's design system with its toolbar, filters, column menu and pages, building a data sheet with editing, ranges, undo, formats and formulas, and testing keyboard, focus, contrast and agent access. Use whenever a project has ui-sdk-table-vue installed, or the user asks for a table, a data grid or a data sheet in a Vue app that uses UI SDK.
---

# Build with ui-sdk-table

ui-sdk-table-vue is a headless table for Vue, built on UI SDK. It renders a real `<table>` with the roles, the keyboard and the state of a grid, and gives no looks: no colours, no fonts, no toolbar. The app writes the looks and the controls beside the table. A data sheet is the same `Table` with more options.

Use it for any table of data that a person sorts, filters, selects, edits or exports. For a short table of text that does nothing, a plain `<table>` is enough.

## Read first

The docs for the installed version ship in the package, as Markdown:

- `node_modules/ui-sdk-table-vue/docs/llms.txt` is the index. Read it first. It holds the conventions that every page shares and the pages of "Get started", and lists every other page with one line.
- Then read only the pages your task needs, such as `docs/sort-filter-and-search.md`.
- For the exact type of a prop, an event, a slot, a controller method, a view field or a column key, read the group "Reference": `docs/reference-table.md`, `docs/reference-columns.md`, `docs/reference-controller.md`, `docs/reference-view.md`. They are generated from the types.
- The package is TypeScript source. When the docs do not answer, read the types in `node_modules/ui-sdk-table-vue/src`, or write a small test that tries it.
- Every control beside a table, such as a search field, a select, a menu or a pagination, is a UI SDK component: follow the `ui-sdk` skill and `node_modules/@ui-sdk/vue/docs/llms.txt` for it.

The same docs are online at https://falldownthesystem.github.io/ui-sdk-table/. Prefer the installed copy: it matches the version in the project.

If the package is not installed yet, follow `docs/installation.md`: the exact beta of `@ui-sdk/core` and `@ui-sdk/vue` that it names, and `lib` at ES2023 or newer.

## Pick your path

1. **Put a table on a page**: rows, columns, a few options and slots. Read `docs/first-table.md`, then the page of each feature. This path needs no reference file.
2. **Build the styled table of an app**, the one component that every page of the app uses: read [references/styled-table.md](references/styled-table.md).
3. **Build a data sheet**, with cells that people type into, ranges, undo, formats or formulas: read [references/data-sheet.md](references/data-sheet.md).

A page of an app that already has a styled table takes path 1, with the component of the app in place of `Table`.

Every path ends the same way:

4. **Test it**: [references/testing.md](references/testing.md).

## Rules for every path

- **A stable id for every row.** The table finds rows, a selection, an edit, a format and a formula by the id, never by a place. Give `getRowId` when the id is not `row.id`.
- **The table never writes your rows.** An edit, a paste, a fill and an undo reach `@cell-edit`; the owner applies them, for example with `applyEdits`. Without a listener nothing changes. Never mutate a row object; pass a new one.
- **A name for every table.** Give `aria-label`. People using screen readers and agents find the table by it.
- **Constants for arrays and objects.** Define `columns`, `messages` and the options of a format once, in `<script setup>` or a module. A literal in a template is a new value at each render, and the table takes each one as a new option.
- **The table is not reactive to read.** `controller.getView()` is the state at the moment of the call. A control reads `useTableView(controller)`, which follows the table.
- **State through its three props.** Start a state with `default<Key>`, or control it with `v-model:<key>`. A change has `details.reason`; `details.cancel()` refuses it. Do not copy a state into a ref of your own to keep it in step.
- **Looks from attributes.** Style the parts by `data-slot` and the state by `data-*` and `aria-*` attributes and the CSS variables of the table. Never a class or an inline style that a script switches for state. `rowAttrs` and `cellAttrs` are for classes of the design system, not for a selection or an active cell. See `docs/styling.md`.
- **A part that sticks is opaque.** A sticky header, footer, pinned row or pinned column needs a background, or the rows under it show through.
- **Load a big entry when it is used.** Import `ui-sdk-table-vue/export` with `import()` when a person asks for a file. The engine of `ui-sdk-table-vue/formulas` is one object for the life of the table.
- **Show the words of a refusal.** An action with a wrong argument throws a message that lists the valid values. Show the `cause` of the error when it is a text, else its `message`.
- **Don't hand-roll what UI SDK ships.** No `role="listbox"`, `"menu"`, `"dialog"` or `"switch"` on a `div` beside the table: use the UI SDK component.

## When you're done

1. **Typecheck** with `vue-tsc`, as the `ui-sdk` skill says. The table types its columns by the row: type the list as `ColumnDef<Row>[]`.
2. **Write and run tests** (see testing.md): every key and focus rule of your table in a real browser, and the agent test.
3. **Check colour** in a real browser: text 4.5:1 against what is behind it, the edge of a control, a focus ring and a state fill 3:1. Check each state that has its own fill, such as a selected row, a range and a pinned column.
4. **Report** each command you ran with its exit code, anything you could not check, and anything the docs got wrong or left out.
