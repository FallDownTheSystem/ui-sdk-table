# Report: table library, subtasks 4 to 9

**This report is the state at commit `5035ff8`. The work after it (headless only, sink page, data sheet) is in the last section, "After the report", which is the state of now where the two differ.**

Date: 2026-11-21. All six subtasks are done. The library is on `master` of `ui-sdk-table`. The app change is a pull request that waits for the owner: https://github.com/FallDownTheSystem/dashboard-template/pull/50.

## Result in short

| Subtask | State | Last commit | Review |
| --- | --- | --- | --- |
| 4. Columns | done, pushed | `06b7a1f` | 12 findings, 10 fixed |
| 5. Row window | done, pushed | `4fbd493` | 15 findings, all fixed or written as a rule |
| 6. Cell editing, cell range, copy and paste | done, pushed | `11f3321` | 20 findings, 17 fixed |
| 7. Server-side mode, export, texts | done, pushed | `80a4899` | 28 findings, 22 fixed |
| 8. Styled table | done, pushed | `5035ff8` | 25 findings, all fixed or documented |
| 9. dashboard-template | done, pull request 50 open | `ab017c7` on `table-swap` | checks only; the owner reviews the pull request |

Last full run of the library (commit `5035ff8`):

| Check | Result |
| --- | --- |
| `pnpm check` | pass |
| `pnpm type-check` | pass |
| `pnpm exec vp test run` | 420 tests pass, 1 skipped (the 50,000-row measurement, which runs with `BENCH=1`) |
| `pnpm test:e2e` | 95 Playwright tests pass (Chromium) |
| `pnpm build` | pass |
| The same commit under Vue `3.6.0-rc.15`, the version of the app | 420 unit tests, type-check and 95 Playwright tests pass |

Nothing is on npm. Each subtask had one independent review, and each fixed finding has a test.

## Subtask 4: columns

**Built.** One column layout (`packages/core/src/columns/layout.ts`) feeds the header, the cells, the footer and the keyboard grid. State keys with the state contract: `columnVisibility`, `columnOrder`, `columnWidths` (with `onColumnWidthsCommit`), `columnPinning`. Behaviors `reorder.ts`, `resize.ts`, `pin.ts`. Nested headers. Slots `col`, `plainRow`, `resizer`. The footer row and the "no rows" row are rows of the grid. `messages.ts` holds the texts of the table.

**Decisions kept.**
- Only Space picks a column up; Enter on a header sorts.
- `createResize` gets no `step`; the arrow keys take their step in the `keydown` of the table, so a drag ends on the pixel of the pointer.
- The commit of a resize reports the widths that were asked for.
- The Vue `Table` renders again only for the state keys that decide rows and columns.

**Not changed, with the reason.** The resize handle is inside the header cell, so a screen reader can read its name with the header. The pixel fallback of a pin offset is stale after a resize when a table has no head, body or foot part.

**Checks at the end of the subtask.** 195 unit tests, 14 Playwright tests, all five checks pass.

## Subtask 5: row window

**Built.** An own row window with spacer rows (`window/metrics.ts`, `behaviors/window.ts`): one height for all rows or measured heights, a jump to any row in one step, a scroll correction for rows above the frame. `behaviors/sticky.ts` places the header rows, the footer row and the pinned rows. Options `rowWindow`, `rowHeight`, `estimatedRowHeight`, `overscan`, `stickyHeader`, `stickyFooter`, `hasDetail`, `rowPinning`. Actions `pinRow`, `scrollToRow`. The row pipeline has an omit stage.

**Decisions kept.**
- The frame is the nearest parent whose content is higher than itself, chosen again at each read.
- Every scroll that the table makes is instant.
- With `hasDetail`, rows are measured also when `rowHeight` is set.
- A press on a row never scrolls.
- Totals count the rows that pass the filter; a pinned row that the filter refuses is in view and not in the totals.

**Not done.** A table that has only pinned rows shows no "no rows" row.

**Checks at the end of the subtask.** 224 unit tests, 26 Playwright tests, all five checks pass.

## Subtask 6: cell editing, cell range, copy and paste

**Built.** `behaviors/edit.ts` wraps `createInlineEdit` (with a small proof first), `behaviors/range.ts` wraps `createCellRange`. `packages/core/src/edit/` has the Standard Schema check, the value parsers and `applyEdits`. Options `editable`, `cellSelection`, `cellRange`; column options `editable`, `schema`, `parse`; actions `editCell`, `startEdit`, `saveEdit`, `cancelEdit`, `selectCells`, `clearCellSelection`, `copyCells`, `pasteCells`; slots `editor` and `edit-error`. Demo `?page=editing`.

**Decisions kept.**
- The table reports an edit through `onCellEdit` and never writes a row.
- A check that takes time holds the edit; the editor is read-only and `aria-busy` during the check.
- A refused value keeps the editor open, with focus.
- A paste is all or nothing.
- A copy gives the text that the editor shows, without the format of the column.
- Numbers are read in the language of the table and in the plain form `1234.5`. Dates are an ISO day only.

**Open.** `aria-multiselectable` is true for `cellSelection` also with `selection: 'single'`. `startEdit` and `cancelEdit` are not agent actions (`editCell` is). An editor from a slot has no rule of its own for focus that leaves the table. Editing together with the row window was not run in a browser.

**Checks.** All five checks passed at the end of the subtask (counted together with subtask 7 below).

## Subtask 7: server-side mode, export, texts

**Built.** Options `manualSort`, `manualFilter`, `manualPage`, `rowCount`, `loading`: a manual stage is left out of the row pipeline, and the state is a request to the owner. `exportData(options)` on the controller; the entry `ui-sdk-table-core/export` (and `ui-sdk-table-vue/export`) with `toCsv`, `toXlsx`, `zip`, `downloadCsv`, `downloadXlsx`. Column options `exportable`, `exportValue`. Every text of the Vue `Table` is in `messages`. The search uses `fuzzyScore`. Demo `?page=server` with a fake server.

**Decisions kept.**
- Own XLSX and ZIP writers, no runtime dependency (SheetJS and ExcelJS rejected for size and for their own number formats).
- An Excel cell is a number or a date with a pattern only when a spreadsheet shows it as the screen does; else it is the text of the screen.
- Without `rowCount`, the rows that the server sent decide whether a next page exists.
- In CSV, a text that starts as a formula gets a quote before it.

**Not changed, by decision.** `aria-rowcount` and `aria-rowindex` count the loaded page. The screen shows "-0.00" for minus zero and the file "0.00". A header group is not in an export.

**Checks at the end of the subtask.** 328 unit tests, 48 Playwright tests, all five checks pass.

## Subtask 8: styled table

**Built.**
- `packages/styled/src/data-table/`: `DataTable.vue` and 12 parts (toolbar, filters, column menu, export menu, pagination, select, checkbox, select-all, expand-all, empty state, chevron, link), `types.ts`, `messages.ts`, `DataTableClasses.ts`. Every control is a UI SDK component. No colour literal, no `<style>` block, no inline style.
- `scripts/build-registry.mjs` writes `registry/data-table.json`; a test fails when the file is stale. `scripts/install-data-table.mjs <app root> [--check]` copies the item into an app byte for byte.
- The docs app has the page `?page=styled` with every demo of the old `data-table.vue`, and demos for pinned columns, a sticky offset, resize, reorder, edit, cell range and server pages.
- A contrast check in the browser (`apps/docs/e2e/contrast.ts`): 135 pairs for each theme, all at WCAG AA.
- An agent test operates each control, and a second one tells two tables on one page apart.
- Core, for the styled table: `getView`, `getFacets`, `subscribe`, `selectRows`, `deselectRows`, `clearColumnFilters`, `setPageSize(null)`, column option `lead`, option `facets`, `TableView.pageUnit`, `dataRowCount` and `hasExpanded`, day bounds of a date filter in the time zone of the column, the CSS variables `--table-sticky-top` and `--table-sticky-bottom`, Space on a group row.
- Vue: `rowAttrs`, `cellAttrs`, `sectionAttrs`, `FootSlotProps.totals`, `GroupSlotProps.totalTexts`, `facets`.

**Decisions kept.**
- Lines of controls are `border-foreground/50`. `border-input` is about 1.3 to 1 against the page, and a control needs 3 to 1. No token of the consumer is changed.
- The focus ring is an outline in the `ring` token.
- The checkbox and expand columns are `lead` columns of the core: always first, and they stick with the start pins.
- A pinned or sticky cell paints the tint of its row as a layer over its own fill.
- `scroll="self" | "page"` says which element scrolls.
- Group totals are a list inside the group row.
- Select-all selects the rows of every page and collapsed child rows, as `selectAll` of the headless table does. The name of the checkbox has the count.
- A live region says the result one time, 500 ms after the last change.
- The registry item names no table package, because the names are not on npm.

**Review.** No high finding, 10 medium, 15 low. All are fixed with a test or documented. Three faults came from the contrast check before the review: focus rings that never showed (`outline-none` of Tailwind 4), the current page in the dark theme at 1.08 to 1, and red text on a tinted row at 4.36 to 1.

**Closest contrast values.** Light: text 4.57 (limit 4.5), parts 3.22 (limit 3). Dark: text 6.23, parts 4.73.

**Not changed, with the reason.**
- A `canSelect` function that gives new answers with the same identity is not read again. `getChildren` is read when the rows change. A change of `selection` keeps the selected rows. All three are in the README.
- Sort headers and row controls of two tables on one page share their names, because they are named by column and row. An agent reaches them through the actions of the table.
- Number placeholders of a range filter are rounded numbers, not formatted text.
- An open editor in the longest cell of a fluid column makes the column a little narrower (663 to 642 pixels in the demo).

**Gaps against the old page.** No switch for the multi-sort mode. No "All" page size and no jump to a page. A number range is two fields and a date range is two date fields (no slider, no calendar). The select filter has no search box. Group totals are not under their columns. Footer texts come through slots. The search has no debounce. The header shows when the table is empty. No always-sorted mode. No "hide all" and "reset" in the column menu.

**Checks at the end of the subtask.** 420 unit tests (core 333, vue 37, styled 50), 95 Playwright tests, all five checks pass.

## Subtask 9: dashboard-template

**Built.** Branch `table-swap` from `table-swap-baseline`, pull request 50 to `master`.
- `ui-sdk-table-core` and `ui-sdk-table-vue` as git dependencies on the library commit `5035ff8`, with an `overrides` line for the core in `pnpm-workspace.yaml`. The commit is in three places.
- `src/components/DataTable/` is a byte-for-byte copy of the registry item (17 files). `scripts/install-data-table.mjs <json> [--check]` of the app writes and checks it. `components.json` has the registry entry `@ui-sdk-table`.
- `src/pages/data-table.vue` and `src/pages/custom-components.vue` are migrated.
- Removed: `src/components/CustomTable/`, `src/composables/table/`, their tests and example, and `export-to-csv`, `fuse.js`, `vue-virtual-scroller`, `write-excel-file`.
- The design-system catalogue (13 entries added, 17 removed), the audit baseline (170 to 166), `DESIGN.md`, `CLAUDE.md` and the custom-components skill describe the new table.
- `@ui-sdk/core` and `@ui-sdk/vue` of the app went from `0.1.0-beta.1` to `0.1.0-beta.13`.

**Checks (app, tree of `ab017c7`).**

| Check | Result |
| --- | --- |
| `pnpm exec vp check` | pass |
| `pnpm type-check` | pass |
| `pnpm lint:eslint` | pass |
| `pnpm exec vp test run` | 10 tests pass |
| `pnpm ds:audit` | `0 errors, 187 warnings, 166 in the baseline` (before: `0 errors, 191 warnings, 170 in the baseline`) |
| `pnpm exec vp build` | pass |
| Playwright, Chromium | 12 tests pass |
| Copy against the registry item | `17 files equal the registry content.` |

The sticky header of the page sits at 56 pixels, under the header of the app, measured in the browser.

## Assumptions that were added

1. **"Agent" in comments and tests is kept.** The rule forbids a mention of an AI agent or tool. The word "agent" in the library is the UI SDK feature (`agent: { actions }`, "agent-first" in `CLAUDE.md`), so comments such as "for assistive technology and for an agent" stay. If the owner reads the rule more strictly, four comments in `packages/styled/src/data-table/` and the names of the agent tests need other words.
2. **The app keeps its own copy script.** The library now has `install-data-table.mjs` too. The script of the app takes the JSON file alone and fails on a file that the item does not ship, so it stayed.
3. **`master` of the app was merged into `table-swap`.** The pull request had a conflict in `package.json` and `pnpm-lock.yaml` from three dependency updates on `master`. The branch has each of those packages at the same or a later version, and `vue-tsc` is on `3.3.11` on purpose, so the merge keeps both files of the branch and changes no file.
4. **The Vue overrides of the app stay on `3.6.0-rc.15`.** The `rc` tag moved to rc.16 after the baseline.
5. **The pull request contains the baseline commit `a8d2f05`**, because the branch had to start from `table-swap-baseline`.
6. **Select-all selects every page**, and the pages text of a table with groups counts groups. Both are stated in the README of the styled table.
7. **The 50,000-row numbers come from the cloud machine** of this run, which is about two times slower than the development computer of the first column.

## 50,000-row numbers

Row pipeline, median of 9 runs, in milliseconds (`BENCH=1 vp test run packages/core/src/rows/rows.perf --silent=false`). The full table with every column is in `docs/benchmarks.md`.

| Operation | 2026-11-20, development computer | 2026-11-21 cloud, commit `5035ff8` |
| --- | --- | --- |
| Build row nodes | 2.9 | 6.3 |
| Search, one keystroke | 8.3 | 15.2 |
| Search on sorted rows, one keystroke | 8.8 | 18.5 |
| Number range filter | 1.6 | 1.8 |
| Sort by text | 123.5 | 186.4 |
| Sort by number | 23.9 | 38.9 |
| Group by two columns, with totals | 4.8 | 9.0 |
| Page change on sorted rows | 0.0 | 0.0 |
| Pin one row, all rows listed | not measured | 2.2 |
| Open a detail row, all rows listed | not measured | 4.8 |

Rendering in the browser (cloud): with the row window, 50,000 rows replace 10,000 rows in 55 to 74 ms, and a scroll by 900 pixels takes 33 ms (median). The page holds 22 to 31 `tr` elements for 10,000 rows and for 50,000 rows. Without a row window, a full render of 50,000 rows took 1,438 ms on the development computer.

Styled table, 30,000 selected rows in 300 groups: one toggle takes 7 to 13 ms (316 to 350 ms before the shared set of the review fix).

## Open items

**For the owner to decide.**
1. **npm publish and package name.** Nothing is published and every package is `private`. The names `ui-sdk-table-core`, `ui-sdk-table-vue` and `ui-sdk-table-styled` are not on npm and are not reserved. Until a publish, an app installs from git, with the commit in three places.
2. **Private repository.** Each computer and each CI job that installs the app needs git access to `ui-sdk-table`. The deploy workflow of the app was not run with the new dependencies.
3. **Declaration files.** The packages build JavaScript only. `definePrimitive` of `@ui-sdk/core` 0.1.0-beta.13 returns a type that names `BaseSlotProps`, `Feature`, `Listener` and `SlotProps`, which the package does not export (TS2883). An app reads the TypeScript source, so `vue-tsc` checks the library with the compiler options of the app. An upstream report is a possible step.
4. **Four pushed commits carry a tool trailer.** `aa52b14`, `06b7a1f`, `41b70f8` and `4fbd493` on `origin/master` have a trailer line that the commit command added. This breaks the rule about tool mentions. The later commits do not have it. A removal needs a rewrite of `master` and a force-push, which was not allowed in this run.
5. **The pull request** needs the owner's review and merge. `.claude/skills/vue-virtual-scroller/` in the app describes a package that the app no longer has; it was left for the owner.
6. **The gaps against the old page** (subtask 8) are not built. Each one is a decision: build it in the library, or accept the new behaviour.

**Not finished, with the reason.**
- **Other browsers.** Firefox and WebKit are not installed in the environment of this run; every browser test ran in Chromium. A real screen reader was not used.
- **Real spreadsheet programs.** Excel, LibreOffice and Numbers were not run on the exported files; `ssf` and `openpyxl` stood in.
- **`simplify`** was not run for any subtask.
- **Windows.** A CRLF checkout was not tried; the registry script normalises line ends and a test feeds it CRLF files.
- **The shadcn-vue CLI route** installs the item but indents the files again, so a copy by CLI does not equal the registry content. The registry address by URL needs a login for a private repository and was not exercised.
- **App builds that were not run:** `pnpm build:ssg`, `pnpm ds:page`, and the headed Playwright configuration with the dev server.
- **Open findings of the reviews** are listed under each subtask above and in the state notes of `docs/handoff/task-002.md`.

## Where things are

- State notes and slices: `docs/handoff/task-002.md`. Log: `docs/handoff/task-002-log.md`.
- Rules of the library: `CLAUDE.md`. Numbers: `docs/benchmarks.md`.
- Install route for an app: `packages/styled/README.md`.
- Pull request: https://github.com/FallDownTheSystem/dashboard-template/pull/50

## After the report

Date: 2026-11-21, later the same day. The owner set the layers: UI SDK gives the logic primitives, this library gives the headless table, and an app builds its own styled table. Then the owner asked for a sink page, a published docs site, and data sheet behaviors with examples in the app.

**What changed in the sections above.**
- `packages/styled`, the registry and the install script are removed (subtask 8). The styled table is source of the app, in `src/components/DataTable/` of dashboard-template. The install route is in `packages/vue/README.md`, not in `packages/styled/README.md`.
- The library is a public repository. Open item 2 (git access for each computer) is closed. The deploy workflow of the app is still not run with the new dependencies.
- The name `ui-sdk-table-styled` of open item 1 is no longer needed.

**Library, `master` at the commit of this report.**

| Work | Commit | What |
| --- | --- | --- |
| Headless only | `43e1db1` | No styled package. Group totals under their columns, facets that follow the other filters, a search with a pause, sort modes, the path of a nested group, reset of the columns. |
| Sink page, docs site | `4d4e397` | `?page=sink`, small tables that each show one thing, tags read from the code. A workflow publishes `apps/docs` to https://falldownthesystem.github.io/ui-sdk-table/ at each push to `master`. |
| Data sheet, first half | `6bd796c` | One writer for many cells, undo and redo, sheet keys, clear, cut, the range from code, a paste that repeats. |
| Data sheet, second half | `05b2e0b` | Row numbers, the fill handle and fill keys, the selection summary, the function of a total at run time, cell formats. Nine sheet tiles on the sink page (55 tiles). |

A sheet is no second component. Each behavior is an option of the table, and `sheet` is the preset (`editable`, `cellSelection`, `history`, `fillHandle`), so sheet and table features combine. The table still writes no row: an undo and a fill are reports through `onCellEdit`. `packages/vue/README.md`, section "A data sheet", is the text for a consumer; `CLAUDE.md`, section "Sheet behaviors", has the rules.

Last full run of the library (commit `05b2e0b`):

| Check | Result |
| --- | --- |
| `pnpm check` | pass |
| `pnpm type-check` | pass |
| `pnpm exec vp test run` | 680 tests pass, 4 skipped (the two measurement files, which run with `BENCH=1`) |
| `pnpm test:e2e` | 131 Playwright tests pass (Chromium) |
| `pnpm build` | pass |

**App, branch `table-swap` at `6410cc1`, pull request 50, not merged.**
- `aafc677`: the table is source of the app; slider, date and value-list filters, "All" page size, a jump to a page, "Hide all" and "Reset", totals under columns, the search pause, a sort mode switch, a group-by control.
- `6410cc1`: the data sheet. `DataTableSheetToolbar`, `DataTableSummary`, `DataTableAggregate`, row numbers, the fill handle, the looks of formats in light and dark, and the page `/data-sheet` with a budget sheet, checked values, saved formats and a sheet in a grid of 50,000 rows.
- Checks at `6410cc1`: `vp check`, type-check and build pass; ESLint 0 errors; 90 unit tests; 77 Playwright tests (Chromium); audit `0 errors, 193 warnings, 166 in the baseline`; contrast 204 pairs (table) and 121 pairs (sheet) for each theme at WCAG AA.

**Faults that the sheet work found in the code of before, each fixed with a test.**
- Two reports of edits in one turn lost the first: the second read the rows of the last render. The table holds the values of a turn (`edit/turn.ts`), and `applyEdits(rows, edits, getRowId?)` finds a replaced row by its id.
- Two changes of a state key that the owner holds, in one turn, lost the first.
- The grid pulled focus back into the table after a person had tabbed out of the page.
- The Vue controller subscribed before a table arrived, with a warning for each table with a search.

**Set without an answer of the owner.** Change them when the owner says otherwise.
1. An undo covers values and formats, not sort, filter or column moves.
2. Tab leaves the table, except inside a selected range.
3. No insert or removal of rows by the table; the app changes its own array.
4. A fill goes on with the step of two numbers or two days and repeats everything else.
5. Formats carry looks (alignment, bold, italic, named colours) as data attributes.
6. No formula engine, and the rows and columns of the table, not an A1 grid.

**Open items, added.**
1. **Size.** The sheet behaviors add 38 kB minified to `packages/core` (154.4 kB minified, 53.9 kB gzip; 116.0 and 40.9 before). A table without the options carries them. A separate entry for the sheet is possible and not built.
2. **A percent cell opens with the plain value.** A cell that shows `25%` opens its editor with `0.25`. A test pins this; it reads badly for a person who types percentages.
3. **The average of the selection summary** shows up to six decimals when the selection is more than one column (`35,391.666667`).
4. **`selectAllCells` includes a lead column that is no row header** (a checkbox column), so a copy of all cells starts with an empty cell.
5. **`undo()` with a refused editor open** throws a text for a developer, and the controller cannot say whether an editor is open. The app reads the page for this.
6. **`cellFormats` is not in the snapshot of the state** that the UI SDK agent bridge reads, because 50,000 formats made it 989 kB. A reader uses `getCellFormat`.
7. **The sink page** is light only and has 55 tiles; the first wish was 30 to 40.
8. **Local paths in `docs/handoff/task-002.md`** (five places) and the four commits of open item 4 above are now public.
9. **The pull request** waits for the owner's merge. `.claude/skills/vue-virtual-scroller/` in the app is still there.

**Not verified, added.** Firefox and Safari; the Command keys of a Mac; what a browser with its own menus does with Ctrl+D and Ctrl+R; a touch drag of the fill handle; a screen reader on row numbers and footer lists; an xlsx file with cell formats opened in Excel; the published pages in a browser after the last deploy (the deploy passed and the site answers).
