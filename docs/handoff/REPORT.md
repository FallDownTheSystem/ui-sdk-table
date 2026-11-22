# Report: table library, subtasks 4 to 9

**This report is the state at commit `5035ff8`. The work after it (headless only, sink page, data sheet) is in the last section, "After the report", which is the state of now where the two differ.**

Date: 2026-11-21. All six subtasks are done. The library is on `master` of `ui-sdk-table`. The app change is pull request https://github.com/FallDownTheSystem/dashboard-template/pull/50 (merged later; see the last section).

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
- The library is a public repository. Open item 2 (git access for each computer) is closed.
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

**App, `master` at `f9042da`: pull request 50 is merged (branch `table-swap` at `6410cc1`), on the owner's word.** The deploy workflow of the app passed with the new dependencies, and the site answers at https://falldownthesystem.github.io/dashboard-template/.
- `aafc677`: the table is source of the app; slider, date and value-list filters, "All" page size, a jump to a page, "Hide all" and "Reset", totals under columns, the search pause, a sort mode switch, a group-by control.
- `6410cc1`: the data sheet. `DataTableSheetToolbar`, `DataTableSummary`, `DataTableAggregate`, row numbers, the fill handle, the looks of formats in light and dark, and the page `/data-sheet` with a budget sheet, checked values, saved formats and a sheet in a grid of 50,000 rows.
- Checks at `6410cc1`: `vp check`, type-check and build pass; ESLint 0 errors; 90 unit tests; 77 Playwright tests (Chromium); audit `0 errors, 193 warnings, 166 in the baseline`; contrast 204 pairs (table) and 121 pairs (sheet) for each theme at WCAG AA.

**Later the same day, on the owner's word:** library `19f3d59` (the text field of a percentage, the average of the summary) and app pull request 51, merged as `7318107` (the library commit, the text "No total" in the list of a column without a total). The deploy of the app passed. Three pull requests of the dependency bot (38, 39, 40; major versions, with conflicts) are open and were not touched.

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
2. **A percent cell opens with the plain value.** Closed later the same day: the text field of a cell that shows `25%` opens with `25`, and `30` in it is 0.3. A paste, a fill and a text from code hold the value itself.
3. **The average of the selection summary** showed up to six decimals when the selection is more than one column (`35,391.666667`). Closed later the same day: a plain average has two decimals more than the values have (`35,391.67`).
4. **`selectAllCells` includes a lead column that is no row header** (a checkbox column), so a copy of all cells starts with an empty cell.
5. **`undo()` with a refused editor open** throws a text for a developer, and the controller cannot say whether an editor is open. The app reads the page for this.
6. **`cellFormats` is not in the snapshot of the state** that the UI SDK agent bridge reads, because 50,000 formats made it 989 kB. A reader uses `getCellFormat`.
7. **The sink page** is light only and has 55 tiles; the first wish was 30 to 40.
8. **Local paths in `docs/handoff/task-002.md`** (five places) and the four commits of open item 4 above are now public.
9. `.claude/skills/vue-virtual-scroller/` in the app is still there and describes a package that the app no longer has.

**Not verified, added.** Firefox and Safari; the Command keys of a Mac; what a browser with its own menus does with Ctrl+D and Ctrl+R; a touch drag of the fill handle; a screen reader on row numbers and footer lists; an xlsx file with cell formats opened in Excel; the published pages in a browser after the last deploy (the deploy passed and the site answers).

## After the sheet: column letters, the sink page, the first part of the formulas

All of this is on `master` of the library at `0305a78` and of the app at `65f3f65`. Each branch passed `pnpm check`, `pnpm type-check`, `pnpm exec vp test run`, `pnpm test:e2e` and `pnpm build` in a second checkout before its merge.

**Column letters** (`f96f84c`). The option `columnLetters`, off by default and not part of `sheet`, puts a row of letters (A, B, C, then AA) above the header rows. A press on a letter selects its column, Shift the columns from the active cell, a drag those columns, and the corner every cell. Space, Control+Space and Enter select on a letter, and Shift with an arrow adds the next column. `lettersByColumn` of `sheet/chrome.ts` is the one rule for the letter of a column. The work also fixed a fault of before: with header groups and a sticky header, only the last header row stuck.

**The app** (pull request 52, merged as `65f3f65`). `DataTable` has the prop `columnLetters`; the Budget sheet of `/data-sheet` shows the letters, and the example with 50,000 rows has a switch for them. Checks at `9ac8cae`: `vp check`, type-check, ESLint with 0 errors, 91 unit tests, the audit with 0 errors, the build, and 81 Playwright tests. The Dependabot pull requests 38, 39 and 40 were closed: `master` had their versions already.

**The sink page** (`d7a20a8`, `31813e2`). Geist, Geist Mono and Geist Serif from the npm package `geist`, loaded by the sink page only. A table has no fill of its own and shows the colour of its card; a part that sticks takes the colour of the card. The tones have three weights (neutral, soft, bold). In the second round, which the owner directed himself, a tile became a scene: a whole table with room around it, a serif heading on each tile, and a group `style` with four looks of the same table. The page has 60 tiles.

**Formulas, slices 0 to 2 of the plan** (`0305a78`). The plan is not in the repository; its decisions are in `docs/ui-sdk-api-notes.md`, section 11, with the proofs.
- The entry `ui-sdk-table-core/formulas` holds an engine of our own, with no dependency: about 45 functions, 25.4 kB minified. The main entry did not grow.
- `formulaColumn()` makes a computed column from a formula such as `=[price]*[qty]`. It reads its own row only. Sort, filter, groups, totals and export take it as any column.
- The period functions `DAYOF`, `WEEKOF`, `MONTHOF`, `QUARTEROF`, `YEAROF` and `HOUROF` give the first day of the period, and the new format `period` writes its text.
- A function whose name Excel has behaves as in Excel; the differences are listed in section 11 of the notes. The locale never changes what a formula computes. It changes what a person types and reads: in a locale with a decimal comma, `=IF([Price]>1,5; "high"; "low")` is stored as `=IF([price]>1.5, "high", "low")`.
- Measured with 50,000 rows on the cloud machine: a shared formula 17.6 ms, the first sort by a computed column 34.5 ms more than by a plain one, `WEEKOF` in a zone 62 ms at the first read and 1.8 ms after. `docs/benchmarks.md` has the tables.

**Set without an answer of the owner, added.** Assumption 6 of the list above ("No formula engine") no longer holds.
7. In a locale with a decimal comma, only `;` separates the arguments of a function.
8. `WEEKOF(d)` starts the week on Sunday, as `WEEKNUM` of Excel does, and `WEEKOF(d, 2)` on Monday. The owner asked for the rule of Excel; the default day follows from it.
9. A moment in a column without a `timeZone` is read in the zone of the machine.
10. In an Excel file, a period is a text cell.

**Open items, added.**
10. **A fault of `cellFormats` and `columnAggregates` that a proof of the formulas found.** With a key that the owner holds, a change back to the value of the last render in the same turn is lost: an undo of a format in the turn of the format throws, and the owner keeps the format. A person cannot do this; code can. The fix is the first commit of the next part of the formulas.
11. **Formulas, still to build:** column formulas at run time, addresses and ranges, cell formulas with their dependents, the check after new rows, fill and paste, the reads for an agent and a formula bar, and tiles in the sink.
12. **Control+A on a body cell and `selectAllCells()`** still include a checkbox column; the corner of the letters does not.
13. **From right to left, a range draws its inner line between its columns.** The fault is older than the letters.
14. **The count of cells in the selection summary of the app** has no thousands separator ("50000 of 50000 cells with a value").
15. Open item 7 above is out of date: the sink page was restyled and has 60 tiles.

**Not verified, added.** The letters and the formulas in Firefox and Safari, apart from the three proofs that ran in all three browsers; touch; a screen reader; `=` on a real Finnish keyboard; an Excel file opened in Excel; every number on another machine than the cloud machine.

## After that: the rest of the formulas

The whole plan of the formulas, slices 0 to 12, is on `master` of the library at `2675031`. Each of the three branches passed the five checks in a second checkout before its merge; the last one with 1079 unit tests and 171 Playwright tests. This closes open items 10 and 11 above. The section "Formulas" of `packages/vue/README.md` names every option, method, slot prop, attribute and message, and `CLAUDE.md` has the rules.

**What a table with the `formulas` option can do.**
- **Column formulas at run time** (`cellFormulas.columns`, `setColumnFormula`): set, change and take away, each as one step of the history. The field of a cell in such a column shows the formula of the column, and a save changes the column.
- **Addresses.** The number of a row is its place in `rows`, and the letter of a column its place among `columns` without the columns that lead. After a sort the numbers read 7, 2, 9, and a hidden column leaves a gap in the letters (A, C). `$`, ranges and whole columns (`B:B`) are read.
- **Cell formulas** (`cellFormulas.cells`): a text that starts with `=` in the editor, the formula bar, a paste, a fill or `editCell`. The result is a value of the row. One report holds the cell and every cell that reads it, in order, and one step of the history holds values and formulas. A circle is refused with its path.
- **New rows of the owner:** the table checks the formula cells in a microtask and reports the differences with the reason `recalculate`, which is no step.
- **Fill, paste and cut:** references without `$` move by the distance the cell moved; past the edge they give `#REF!`.
- **Reads:** `getFormulaSummary`, `evaluateFormula` and `getFormulaFunctions` for an agent, and `useFormulaBar` for a formula bar.
- **Excel:** `excelFormulas()` as the `formula` option of `toXlsx` writes a formula into the file only when all of it means the same in Excel; else the cell holds its result. A period of a day, a month or a year is a date cell when a spreadsheet shows the pattern as the screen does.

**A fault of before that the work fixed.** A change of `cellFormats` back to the value of the last render, in the turn of the first change, was lost for an owner that holds the key. `createHeldKey` of `edit/turn.ts` is now the one change path for `cellFormats`, `columnAggregates` and `cellFormulas`.

**Size.** The main entry may grow by 12 kB minified for the formulas, and `formulas-size.test.ts` holds that limit. The glue is 11.85 kB, so 152 bytes are left: a new feature of the formulas needs code moved behind the engine object. The formulas entry is 47.1 kB minified (16.0 kB gzip); the first estimate was 20 kB.

**Measured with 50,000 rows on the cloud machine, against the estimates of the plan.** `docs/benchmarks.md` has every number.

| Case | Estimate | Measured |
| --- | --- | --- |
| One edit that 11 formulas read | under 2 ms more | 0.08 ms |
| Fill one formula down | under 70 ms | 573 ms |
| Paste of 49,999 formulas | under 160 ms | 1,280 ms |
| Paste of 50,000 prices that 50,000 formulas read | under 100 ms | 410 ms |
| A chain of 50,000 cells, one edit at the top | under 90 ms | 325 ms (967 ms for the first edit) |
| 50,000 new prices from the owner | none | 211 ms |
| Excel file of 4 columns, with formulas | none | 252 ms (171 ms without) |

**Set without an answer of the owner, added.**
11. A value typed into a cell of a computed column is refused with words; it does not replace the formula for that one cell.
12. The words of a formula error and of a refusal come from the engine; `messages.formulaIssue`, `messages.formulaError` and `messages.recalculated` put other words in their place.
13. `FLOOR`, `CEILING` and every date function go into an Excel file as results, and so does a range of more than one column.
14. After rows came or went, every formula is checked, not only the readers of those rows.

**Open items, added.**
16. **Speed of a fill and a paste of formulas over 50,000 rows** is five to eight times the estimate of the plan (see the table).
17. **No development warning** when an owner does not take a result of a check after new rows. A guard stops the loop.
18. **The sink page and the app** do not show the formulas yet. Both are being built.

**Not verified, added.** An Excel file with formulas opened in Excel or LibreOffice (the file was read as XML and its patterns with `ssf`); Firefox and Safari, apart from the proofs; a screen reader; `=` on a real Finnish keyboard; the check after new rows in a browser with 50,000 rows; the examples of the README as an app of their own.

## After the formulas: the sink tiles, two fixes, the app

Date: 2026-11-22. The library is on `master` at `4105922`, and the app on `master` at `cae48c6`. Each branch passed its checks in a second checkout before its merge; the last library branch with 1082 unit tests and 172 Playwright tests. Both docs sites deployed. This closes open item 18 above.

**The sink page** (`1eab85e`, merged as `d8a9345`). A group `formula` with seven tiles, after `sheet`; the page has 68 tiles. No line of `NOT_SHOWN` is about formulas now.
- "Group by the week.": a formula column with `WEEKOF`, `MONTHOF` or `QUARTEROF`, and the rows grouped by its `period` labels.
- "Type a formula.": an order with a formula on each line, `=SUM(D1:D14)` under them, and a formula bar from `useFormulaBar`.
- "Compute a column.": `formulaColumn` for a total and for a band from `IFS`.
- "Catch a broken formula.": `#DIV/0!` in a cell, and a circle that is refused with its path.
- "Type a decimal comma.": the same formula in `de-DE` and in `en-US`.
- "Write a column formula.": `setColumnFormula` from a field, with an undo and a formula that is refused.
- "Open a saved sheet.": `recalculate()` on stale results, `getFormulaSummary`, and an Excel file with `excelFormulas()`.

The closest new contrast pairs are all on `clay`: 4.89 and 4.96 with a limit of 4.5, and 4.94 with a limit of 3.

**Two faults of the library that the tiles found, both fixed.**
- `739d4f9`, `packages/vue/src/controller.ts`: a table that came in place of another through a new `key`, with the same controller, did not get the listeners of the controller, so `useTableView` stayed on the old table. The controller now keeps every listener and moves it to each table that arrives.
- `4105922`, `packages/core/src/table.ts`: a new `locale` or a new formula engine on a mounted table told no listener of `subscribe`, so `useTableView`, `useFormulaBar`, `getFacets` and `getTotals` kept the texts of the old locale. Both now bump the revision of the table, as new rows and columns do. An owner that passes a new `rows` array at each render never saw this fault.
- Each fix has a Vue test that fails without it.

**Size.** The second fix added 33 bytes to the main entry. `formulas-size.test.ts` passes with 119 bytes left of the 12 kB; `BEFORE` and `LIMIT` did not change.

**The app** (pull request 53, merged as `cae48c6`). The library pin is `4105922`.
- `DataTable` passes `formulas`, `cellFormulas` (with `v-model:cell-formulas`) and `defaultCellFormulas` through, and a column can have `allowFormula`.
- Three parts, each behind a prop: a formula bar (`formula-bar`), a control for the formula of a column with the list of functions (`formula-columns`), and a list that groups by day, week, month, quarter or year of a date column (`date-groups`).
- A formula cell has a mark in its corner, an error cell the red of the formats, and a computed column the fill of a group row.
- A new page, `/data-formulas`, with six examples: orders by week, a price list with cell formulas and a VAT rate read with `$`, bands from `IFS`, planned and actual with a `#DIV/0!` on purpose, busy hours by weekday and hour, and a sheet in `fi-FI` with a decimal comma.
- Checks at `e0ca619`, the head of the branch: `vp check`, type-check, ESLint with 0 errors, 103 unit tests, the audit with 0 errors, the build, and 94 Playwright tests. The last commit of the branch holds only the two generated type files that the build changed.
- The lowest contrast of the new pairs: 4.74 for a text and 3.53 for a part in the light theme, 6.21 and 4.85 in the dark theme.

**Set without an answer of the owner, added.**
15. A change of `messages`, `canSelect` or `selection` alone tells no listener of the table. An owner often passes these as new objects at each render, so they would tell every listener each time.
16. The formula examples of the app are on a page of their own, not on `/data-sheet`.
17. With `formulas`, the Excel export of the app always writes the formulas.
18. "No groups" in the date list of the app takes the grouping away and keeps the formula of the period column.

**Open items, added.**
19. **The words of a refusal** in the formula bar and in a control that catches `setColumnFormula` are a sentence for a developer, with the ids of the column and the row, and for an unknown function the name of every function. The cell editor shows only the reason. A fix is being built on the branch `refusal-words`; the app needs a small change after it.
20. **A table computes nothing at mount.** An example whose rows come without results calls `recalculate()` when it is mounted. The README says so.
21. **The city names** (Helsinki, Tallinn, Oslo) are still in the order data of the sink page; the names of persons and clubs were replaced.
22. **On the sink page**, two bold cards touch at 1024 px (the rule is for 1440 px), and three formula tiles scroll sideways at 360 px, as about 16 tiles of before do.

**Not verified, added.** The formula tiles and `/data-formulas` in Firefox and Safari; a screen reader; an Excel file of the sink page or of the app opened in Excel or LibreOffice (both were read as XML); a change of the locale on a mounted table in the app (its `fi-FI` example has a table of its own); the two live sites, apart from the result of their deploy workflows.

## After that: the words of a refusal

Date: 2026-11-22, later. The library is on `master` at `87adc18`, and the app on `master` at `794fb64`. Each branch passed its checks in a second checkout before its merge: the library with 1085 unit tests and 172 Playwright tests, the app with 103 unit tests and 94 Playwright tests. This closes open item 19 above.

**The library** (`edaaad7`, merged as `87adc18`). An error that `editCell`, `setCellFormula` or `setColumnFormula` throws for a refusal keeps its message for a developer or an agent, with the column, the row and the text. It now carries the words for a person as its `cause`, a text: the words that the editor of the cell shows. `useFormulaBar().error` gives the `cause`. Two tiles of the sink and the formulas page show the `cause` in place of the whole message. The section "Formulas" of `packages/vue/README.md` has the rule, and an example of own words for one kind of issue through `messages.formulaIssue` and `describeFormulaIssue`. New core and Vue tests fail without the change.

**Size.** The change added 49 bytes to the main entry. `formulas-size.test.ts` passes with 70 bytes left of the 12 kB; `BEFORE` and `LIMIT` did not change.

**The app** (pull request 54, merged as `794fb64`). The library pin is `87adc18`.
- `refusalText(error)` of `@/components/DataTable` gives the `cause` when it is a text, else the message. The control for a column formula, the date list, the sheet toolbar and the paste example of `/data-sheet` use it.
- The formula bar says "No function SUMM." for `=SUMM(B2)`, and the control for a column formula says "The formula ends too soon." for a formula that stops early. The unit and Playwright tests expect these texts exactly.
- The words of the issues (2.8 kB minified) are now in the shared chunk of `DataTable`; the engine stays in a chunk of its own.

**Set without an answer of the owner, added.**
19. In the app, an unknown function names only itself, without the name of every function: the control for a column formula has the list. A page gives other words through `formulaIssue` of `messages`.

**Not verified, added.** The words of the date list and of the sheet toolbar after a real refusal of the table: no test makes one. The dark theme of the two new texts. Firefox and Safari.
