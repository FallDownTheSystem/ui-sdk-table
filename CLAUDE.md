# CLAUDE.md

## What this is

A headless table for Vue, built on UI SDK (`@ui-sdk/core`, `@ui-sdk/vue`, public beta). UI SDK gives the logic primitives, this library builds the headless table on them, and a consumer builds its styled table on this library. Work in progress; nothing is published and every package is `private`.

## Layers

The folder borders are the design. Do not import against the arrows.

```
packages/core    framework-free: table primitive, behaviors, pure row helpers   → @ui-sdk/core only
packages/vue     Vue parts, slots, v-model, controllers                         → core, @ui-sdk/vue, vue
apps/docs        demo pages with plain CSS, benchmark page, browser tests       → everything
docs/proof       frozen feasibility proof; reference only, not built or linted
```

- `packages/core` has no Vue import and no Vue dependency. Its `tsconfig.json` sets `types: []` for that reason.
- The library has no styled table and no control of a toolbar. What a styled table needs is logic here: state, data for controls (`getView`, `getFacets`, `getTotals`, `subscribe`), attributes and CSS variables. A feature that only gives looks belongs to the consumer.
- The docs pages use plain CSS (`apps/docs/src/style.css`) and native controls. No CSS framework, no component library for looks.
- Vue is a first-class citizen: slot-based cells, `v-model` for each controlled state, Vue-idiomatic types. If the framework-free core blocks one of these, stop and say so.

## Design rules (from UI SDK)

Follow the `ui-sdk` skill. Read `node_modules/@ui-sdk/vue/docs/llms.txt`; search `docs/core.md` by heading and never read it whole (over 400 KB); read `docs/rendering.md` and `docs/agents.md` sections as needed.

- One `definePrimitive` per component: `options` schema, `state`, `sync`, `controlled`, `api`, `slots`, `agent`.
- A behavior is `create<Thing>(context, options)`. Its rules are function options. It hands results back through `set` / `onMove` / return values. Behaviors do not know each other; they meet only in `api`.
- State contract: `<key>`, `default<Key>`, `on<Key>Change(value, details)`. Every change a person can see goes through `createChange` with a reason from `ReasonVocabulary` when one fits. Drags report steps as changes and the end through `createCommit`.
- Roles go on slots, never in `attrs`. State shows as ARIA and `data-*` attributes and CSS variables, never as classes or inline styles for state.
- Use `selects` / `live` / `direct` (`byCell`, `byCellRange`) so a change reaches only the parts it affects.
- Agent-first: every primitive ends with `agent: { actions: [...] }`; action methods check their arguments and throw a message that lists the valid values; the root has an accessible name.
- Each experimental UI SDK behavior (grid focus, cell range, resize, inline edit, popup) sits behind one table behavior of ours, so an upstream API change touches one file.
- Slot names are kebab-case (`header-row`, `plain-row`), as in UI SDK. `mount` of `@ui-sdk/core/testing` reads its markup as HTML, which has no capital letters in tag names, so a slot with a capital letter cannot be a part in a test.
- The table scrolls with `behavior: 'instant'` only. A page with `scroll-behavior: smooth` otherwise animates a jump, and the next read sees the old place.
- The scroll frame of the row window is the nearest parent whose content is higher than itself, not the nearest with `overflow-y: auto`: a wrapper with `overflow-x: auto` has that computed value too.
- A renderer can call the `bind` of a slot before the element is in the page. A behavior that needs the parents or the size of an element waits for that (see `bindOrigin` in `behaviors/window.ts`).
- The props that `bind` gets are the props at that moment. A rule that must follow a prop goes in `attrs`, not in a closure of `bind`.
- UI SDK has no helper for derived data. The row pipeline keeps its own per-stage cache inside `api`.
- Never copy or mutate a caller's row objects. Rows need a stable id.

## Row pipeline (`packages/core/src/rows`)

`createRowModel` runs source → sort → filter → omit → group → page → flatten. The omit stage takes the pinned rows out of the list; the table shows them in a place of their own. Each stage is a pure function wrapped in `memo`, and runs again only when its input or its own state changed.

- Sort is before filter on purpose: a filter keeps the order of its input, so a keystroke in the search never sorts.
- A stage that removes nothing returns its input array itself. Later stages then keep their results. Keep this property when you add a stage.
- A stage may create a new node around a row (`{ ...node, children }`), never a new row. `node.row` and `node.id` stay the same.
- An unknown column id throws an error that lists the valid ids. People and agents both read these messages.
- `docs/benchmarks.md` holds the 50,000-row numbers. Run the measurement again when you change a stage, and add a column to the table.

## Editing, range, copy and paste (`packages/core/src/edit`, `behaviors/edit.ts`, `behaviors/range.ts`)

- The table reports an edit through `onCellEdit(edits, details)` and never writes a row. `applyEdits` is a helper for the owner of the rows.
- A value goes through `resolveValue`: `parse` of the column or `parseText`, then the `schema` of the column (any Standard Schema). A refusal keeps the editor open with its message.
- A check can answer with a promise. `saveCell` then gives back a promise of a function that reports, and only `createCellEdit` runs it, while the edit still waits. Do not report an edit from inside the promise.
- At the answer, read the row again with `model.rowById`. The owner can replace the row objects during a check.
- A paste is all or nothing. Refuse the whole paste before any cell changes.
- A range from the state can hold header rows. `selectedCells()` cuts it to the body rows; use it, not `range.bounds`, for a copy, a paste or an edit.

## Server mode (`manualSort`, `manualFilter`, `manualPage`)

- A manual stage returns its input array itself. The sort, filter and page states stay and are requests to the owner.
- With `manualPage`, the pages come from `rowCount`. Without it, count the rows that the server sent (`source().rows`), never a later stage: a group or a pinned row makes the list shorter.
- A step to the page that the table is on reports no change, so a listener that loads rows does not load them twice.

## Export (`packages/core/src/export`, entry `ui-sdk-table-core/export`)

- `exportData` collects cells as plain data; the writers (`toCsv`, `toXlsx`) are a separate entry, so a table without an export does not carry them.
- The text of a cell in a file is the text of the screen. An Excel cell is a number or a date with a pattern only when a spreadsheet shows it as the screen does; when in doubt, `numberWriter` or `dateSection` returns `null` and the cell is text.
- `ssf` (a dev dependency) reads patterns in the tests. A new pattern rule needs a test that formats the written value with the written pattern and compares it with the screen.

## Group rows and totals (`table.ts`, `rows/aggregate.ts`)

- A group row has a label cell and one cell for each column after it, when a column in view has an `aggregate` and `groupTotals` is not false. `groupSpan()` says how many columns the label covers, and `area()`, the cell attributes and the Vue renderer all read it. Change the rule in `labelSpan` only.
- The label never crosses from pinned columns to free ones: a cell sticks or scrolls as a whole.
- Every total comes from `totalsOf` in `table.ts`: the footer, the cells of a group row, `getTotals` and the export. It reads `model.aggregate` and puts the `totals` of the owner over it. Do not count rows for a total anywhere else; `totalRows` is the one place that walks child rows.
- A group row holds no values. Its cells carry no range attributes, a copy gives an empty line for it and a paste skips it. Enter and Space act on the group from every cell of its row.
- A group knows the group above it (`GroupRow.parent`), so `groupPath` walks no tree. Keep `parent` when a stage builds a group.

## Facets (`rows/model.ts`, `rows/facets.ts`, `getFacets` in `table.ts`)

- The facets of a column follow the search and the filters of the other columns, never its own filter. `model.facetRows(columnId)` gives the rows: the list of `filtered` for a column without a filter, and a stage of its own for a column that filters.
- A facet is counted on the first call and kept by its rows. Nothing computes a facet that no control asked for.
- A value that the filter of the column names stays in its list with the count 0. The facets of the owner (`facets` option) are never changed by the rows.
- `range.step` is the smallest change that the format of the column shows (`numberStep`). A new number format needs its case there, and a test.

## Search with a pause (`debounce.ts`, `table.ts`)

- `createDebounce` is the only timer for a pause. It has no dependency and knows nothing of the table.
- The text of a search field is state: `searchDraft` and `searchPending`. `getView().search` is the draft, else the search of the filter. The filter changes once, after the pause, through `createChange` with the reason `input-change`.
- Whatever sets the search of the filter wins over a text that waits: `setSearch`, `clearFilters`, a controlled `filter` with another search text. The rule follows the state (a store subscription), not the actions.
- With a controlled `filter`, the draft stays until the owner passes the text back, so the field never shows the text before.
- The table announces nothing for a search. A consumer announces the rows found on a change of `filter`.

## Sort modes (`toggleSort` in `table.ts`)

- The rule for a press on a header is in `toggleSort`: `multiSort` and the modifier keys of the event decide `append` when the caller gives none. Renderers pass the event and never read the keys themselves.
- An action that asks for what the mode forbids throws with the mode and the valid values. The `sort` state of the owner is never cut to the mode.

## Commands

```bash
vp install        # install
vp run dev        # demo app, http://localhost:5180
vp check [--fix]  # format, lint, type-aware lint
vp run type-check # vue-tsc --build (authoritative for .vue files)
vp test           # unit tests (packages/core, packages/vue)
vp run test:e2e   # Playwright against apps/docs
vp run build      # build the packages
```

Run `vp check`, `vp run type-check` and `vp test` before you call work done; add `vp run test:e2e` when a page or a part changed. Unset `NODE_PATH` first if `vp check` ignores the `fmt` block.

## Tooling facts that cost time

- **Versions live in the `catalog` of `pnpm-workspace.yaml`.** UI SDK is pinned to an exact beta; do not bump it without reading what changed.
- **A package with a Vite plugin must list `vite` (`catalog:`) itself.** Otherwise pnpm gives the plugin plain `vite` as its peer, the plugin's types no longer match `vite-plus`, and `vue-tsc --build` crashes with `Debug Failure. False expression: parameter should have errors when reporting errors` instead of a type error.
- **Do not alias `vitest`.** `vite-plus` 1.7 depends on the real `vitest`; the old `@voidzero-dev/vite-plus-test` alias makes `vp test` fail with `Could not find 'vitest' bin entry`. Import test helpers from `vite-plus/test`.
- **TypeScript stays on `~6.0.3` and `vue-tsc` on `3.3.11`**, for these reasons (TS 7 has no compiler API; vue-tsc 3.3.12-3.3.14 break `//` inside static attributes).
- **The packages build JavaScript only, no `.d.ts`.** `definePrimitive` returns a type that names `BaseSlotProps`, `Feature`, `Listener` and `SlotProps`, which `@ui-sdk/core` 0.1.0-beta.13 does not export, so declaration emit fails with TS2883. Types come from the TypeScript source (`exports` points at `src`). Re-evaluate when UI SDK exports those types.
- **The type-aware lint does not read `.vue` files.** `apps/docs/env.d.ts` declares `*.vue` for it.

## Conventions

- Tabs, single quotes, no semicolons (`vp fmt`).
- `noUncheckedIndexedAccess` is on. Guard or default; no `!`, `as any`, `@ts-ignore`.
- Comments explain why. No comment describes a change.
- A keyboard or focus rule is not done until a Playwright test covers it. jsdom passed the tab order, the page reset through `v-model` and Enter on a group row while all three were wrong in a browser.
- Tests: `mount` from `@ui-sdk/core/testing` for a primitive; `@vue/test-utils` for Vue parts; Playwright for real keyboard, pointer and layout. A new behavior gets its own tests.
- The `testing` entry of `@ui-sdk/core` has no way to give a mounted primitive new options. A test that needs them after the mount (a controlled state) is a Vue test.
- A browser test of a headless rule lives on a headless docs page. `?page=groups` has group rows, totals, facets, the search field, the sort mode switch, a `lead` column and caller attributes; `?page=window&frame=page&bars` has a fixed header and footer of the page for `--table-sticky-top` and `--table-sticky-bottom`.
