# CLAUDE.md

## What this is

A headless table for Vue, built on UI SDK (`@ui-sdk/core`, `@ui-sdk/vue`, public beta). UI SDK gives the logic primitives, this library builds the headless table on them, and a consumer builds its styled table on this library. Work in progress; nothing is published and every package is `private`.

## Layers

The folder borders are the design. Do not import against the arrows.

```
packages/core    framework-free: table primitive, behaviors, pure row helpers   → @ui-sdk/core only
packages/vue     Vue parts, slots, v-model, controllers                         → core, @ui-sdk/vue, vue
apps/docs        docs site, sink page, test pages with plain CSS, benchmark, tests → everything
docs/proof       frozen feasibility proof; reference only, not built or linted
```

- `packages/core` has no Vue import and no Vue dependency. Its `tsconfig.json` sets `types: []` for that reason.
- The library has no styled table and no control of a toolbar. What a styled table needs is logic here: state, data for controls (`getView`, `getFacets`, `getTotals`, `subscribe`), attributes and CSS variables. A feature that only gives looks belongs to the consumer.
- The docs app uses plain CSS and no CSS framework. The pages of the docs use `docs.css`; the test pages (`style.css`) use native controls; the sink page (`sink.css`) uses UI SDK components for the controls beside a table. A page loads one stylesheet (`styles` in `src/page.ts`), so the looks of one page never reach another.
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
- The grid gives focus back to a cell only when a change of the table took it away. It looks one frame after the change, and a Tab key or a press in between cancels the look: the person put focus where it is, also when that is the page itself (`behaviors/grid.ts`).
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
- An edit is about a row id. Its `row` is the object of the last render, and the owner can have replaced it already: `applyEdits` finds the row by id then. Never drop an edit without a word.
- Read "the value of now" of a cell with `valueNow`, not with `cellValue`: the table holds what it reported in this turn (`edit/turn.ts`) until the turn ends or other rows come. After that the rows of the owner are the truth, also when the owner did not take the edit.
- A value goes through `resolveValue`: `parse` of the column or `parseText`, then the `schema` of the column (any Standard Schema). A refusal keeps the editor open with its message.
- A check can answer with a promise. `saveCell` then gives back a promise of a function that reports, and only `createCellEdit` runs it, while the edit still waits. Do not report an edit from inside the promise.
- At the answer, read the row again with `model.rowById`. The owner can replace the row objects during a check.
- A paste is all or nothing. Refuse the whole paste before any cell changes.
- `numberKeyboard` of a column gives the field of the editor `inputmode="decimal"`, and the `inputMode` slot prop, through `inputModeOf` in `table.ts`. It is held back for a field that can hold a formula (`holdsFormula`, `columnFormulaAt`) and for a cell whose resolved format is no number format. Never `type="number"`.
- A range from the state can hold header rows. `selectedCells()` cuts it to the body rows; use it, not `range.bounds`, for a copy, a paste or an edit.

## Sheet behaviors (`behaviors/write.ts`, `behaviors/history.ts`, `packages/core/src/sheet`, option `sheet`)

A data sheet is the table with more options, not a second primitive and not a `Sheet` component. `docs/ui-sdk-api-notes.md` section 10 holds the proofs that the rules below stand on.

- Each sheet behavior is a `create<Thing>(context, options)` file or a pure helper in `sheet/`, composed in `api` behind an option. `sheet` is the preset: `editable`, `cellSelection`, `history` and `fillHandle` are on unless one is set to false.
- With every new option off, the table behaves as before. `packages/core/src/sheet-off.test.ts` and "the keys of a sheet do nothing in a table" in `apps/docs/e2e/editing.spec.ts` prove it: add each new key there, with `defaultPrevented` false.
- New values for many cells go through `createCellWrites` (`writes.write(targets, { reason })`): paste, clear, cut and fill. Do not write the rule "check all, report once, read the row again" a second time.
- Every report goes through `report()`, which records a step when no listener refused. An undo and a redo go through `tell()` and are no steps.
- A step holds row ids, column ids and values, never a row object. An undo is a report through `onCellEdit` with the reason `undo`, with `previous` and `row` of now, and without `parse` and schema: the value came from the data.
- A step whose rows or columns are all gone is dropped and the step before it is taken; a step that the owner refuses stays. While a check runs (`edit.checking()`, `writes.pending()`), a key does nothing and `undo()` throws.
- With `manualPage`, a change of the page, the sort or the filter empties the history.
- The history keys act on a cell only (`event.target === el`). In the editor and in a control inside a cell, Control+Z is the field's.
- Tab on a cell leaves the table. Only inside a selected range of more than one cell it walks the range, and Escape drops the range. A change here needs the keyboard trap test of `apps/docs/e2e/sheet.spec.ts`.
- Where focus goes after a save is `moveFrom` of `sheet/moves.ts`. An arrow that saved an editor moves with `grid.move(key)`: the key event can be long over when a slow check answers.
- A range that code selects (`selectAllCells`, `selectCellRows`, `selectCellColumns`, an undo) moves the active cell into it with `activate`, which never takes focus from outside the table.
- A column with `rowHeader` (`rowNumberColumn()`) is a `lead` column whose cells are `th` with the role `rowheader`. No range, copy, paste, fill, format or export holds it; `firstCol` of `behaviors/range.ts` cuts it off. Its number is a place in the list (`rowNumber`), not an id.
- The row of letters (option `columnLetters`, not part of `sheet`) is grid row 0, above the header rows: it counts in `headerRowCount()`, `aria-rowindex`, `aria-rowcount` and the rows of `cellRange`, and `headerAt(row)` reads the header rows from row 1 on. Which letter a column shows is `lettersByColumn` of `sheet/chrome.ts` and nothing else: the place among the columns in view, without the columns that lead. The formula work changes that one function (and `letterOf`, which reads it). A letter cell is a `th` of the `cell` slot with `header` and `data-kind="letter"`; the cell of the first column that leads is the corner (`isCorner`), which selects the columns from the first letter on, so a checkbox column stays out. The letter cell of any other leading column selects nothing. A press, a Shift press and a drag go through `range.pointerdownColumns`; Space, Control+Space, Shift+Space and Enter select, Shift with an arrow grows, Control+A selects what the corner does, and the keys of a sheet act on the selection as from a row number. A letter shows `data-selected` only when its whole column is selected, through its own `letter:{col}` name in the reader of `cellRange`.
- Every `header-row` part has a `value`. Without one, all header rows are one part and only the last one sticks (`docs/ui-sdk-api-notes.md` section 10).
- The fill (`sheet/fill.ts`, `behaviors/fill.ts`): the drag is bound on the root, because the row window can take the pressed row out of the page, and the cell under the pointer is found by `aria-rowindex` and `aria-colindex`. A fill along the rows passes values, a fill along the columns passes text through the `parse` of the next column. A fill is all or nothing and one step. The fill keys are taken only when there is something to fill: Control+R is the reload of the browser.
- **A live key that a part lists with `[]` in `selects` never reaches the `live()` of that part.** A key that a part reads in `live()` is left out of the `selects` of that part, or gets a reader that names the parts it changes (`byFillDraft`). jsdom and a browser both show the fault; a test must read the attribute.
- **A state key that the owner can hold is read and changed through `createHeldKey` (`edit/turn.ts`) when two changes can come in one turn** (`cellFormats`, `columnAggregates`, `cellFormulas`). The second `createChange` otherwise starts from the state of the last render and drops the first, and a change back to that state would be "no change". `change()` of the held key is the only way to report such a key: it goes through `createChange`, and through `dispatch` only for the change back. Never call `change('<key>')` or `took()` for it yourself.
- `cellFormats` is not in `controlled`: the snapshot of an agent holds every key of `controlled` whole, and 50,000 formats are 989 kB. The state contract still holds (`cellFormats`, `defaultCellFormats`, `onCellFormatsChange`), and an agent reads with `getCellFormat`.
- A cell format is found by row id and column id, never by a place. It is data: the table writes `data-align`, `data-bold`, `data-italic`, `data-color`, `data-fill` and the resolved `data-format`, and no class and no inline style. A colour is a name of `formatColors`.
- Change formats only through `setFormats` and `revertFormats` of `sheet/formats.ts`. Cells that had the same format before share one object after, so 50,000 cells with one format hold 3 objects. A loop that makes an object for each cell breaks this; the benchmark counts the objects.
- The text of a cell is `text(row, column, rowId)`. Without the row id, the column layer decides (a total, a facet). A search and the label of a group read `columnText`: neither follows a format that a person gave a cell. The text field of a cell starts with `fieldText`: the plain value, and for a cell that shows a part of one as a percentage the number of the screen (`25` for 0.25). Only the text of the field is read back that way (`field` of `parseText`). A paste, a fill and `editCell` hold the value itself, as a copy (`editText`) gives it, and a text with a percent sign is that percentage.
- A format change is one step of the history with `formats: { before, after, cells }` and no cell values. Its undo goes property by property (`revertFormats`), so a format that the owner gave another cell or another property meanwhile stays.
- A whole selection of every row formats the columns, so the format holds for rows that come later. Never with `manualPage`: the table does not have every row then.
- `getSelectionSummary` counts on request and keeps the answer for the same selection and rows. Never count while a range changes; `useSelectionSummary` waits for the selection to rest.
- The function of a total is `aggregateOf(column)`, never `column.aggregate`: `columnAggregates` can say otherwise. A change of it is no step of the history.
- Run `BENCH=1 vp test run packages/core/src/sheet/sheet.perf --silent=false` when you change the writer, the history, the fill, the summary or the formats, and add a column to "Sheet, 50,000 rows" of `docs/benchmarks.md`.
- A new option, method or slot of the sheet gets a tile in `apps/docs/src/sink/tiles/sheet/` or a line with a real reason in `NOT_SHOWN` of `sink.test.ts`, and its looks for every tone in the sheet block at the end of `sink.css` (the colour names of the sink are `accent` and `alert`).
- The demo page is `?page=sheet`. A page with `hidden: true` in `apps/docs/src/page.ts` is a page of a proof: a test opens it, and the menu does not list it.

## Formulas (`packages/core/src/formulas`, `src/formula`, entry `ui-sdk-table-core/formulas`)

- The main entry holds only what must touch the inside of the table: the state key `cellFormulas`, its change path, the methods as thin shells that throw "This table has no formulas: pass `formulas`" without an engine, the hooks, the attributes and the view. Everything that runs only with an engine is in `src/formulas/` and comes in through the engine object (`FormulaEngine` of `formula/types.ts`). No file outside `src/formulas/` imports from it at run time (`formulas-entry.test.ts`); `src/formulas-size.test.ts` holds the glue under 12 kB.
- A formula of the `columns` layer makes a computed column: `definitions()` gives the model the columns that `engine.withColumns` built, one array that changes only with the columns, the layer or the engine. A formula of the owner that cannot be read, or a circle of columns, shows an error in every row; one from an action is refused.
- The words of an issue come from `messages.formulaIssue`, else from the engine.
- With `formulas` and without `manualPage`, an address is a place in the document: `rowNumber` is the place of the row in `rows` (children after their parent), and the letter of a column is its place among the columns of the owner without the columns that lead (`documentLetters` of `sheet/chrome.ts`). A hidden column keeps its letter and leaves a gap in the row of letters; a moved column keeps it too. The engine keeps the maps for each array of `rowIds()`, so the sheet reader gives one array while the rows are the same.
- A stored formula of a cell holds ids: `B7` in row 7 is `[price]` ("this row"), another row is `[price@r3]`, a whole column `[price@*]`, and the `$` signs stay. A row that is gone prints as `#REF!`.
- A cell of a computed column of the `columns` layer opens when the column of the owner can be edited (`columnFormulaAt` and `editableCell` in `table.ts`): its field shows the formula of the column, and a save goes to `writeColumnFormula` as one step. `canEdit` stays false for it, so `editCell`, a paste and a fill still skip the cell.
- The rule of `=` is `formulaEntry` in `table.ts`, which `saveCell` and the check of `createCellWrites` call before `resolveValue`, so the editor, a paste and `editCell` agree. A cell holds a formula when it can be edited, its column has no `allowFormula: false` and no formula of the column; with `manualPage` a formula is refused. `'=text` is the value `=text`.
- Every formula of a cell reaches the owner through `report()`: `engine.join` gives the formula cells that follow, in order, and the report holds them with the edit, with `CellEdit.formula` for a formula that was set (a text) or went (`null`). The values are told first, then `cellFormulas` changes; a listener that refuses the formulas keeps the values. The step holds the cells and the formulas, and its undo tells the values through `tell()` and puts the formulas back with `revertFormulas`: no engine runs.
- A copy puts values on the clipboard and remembers the formulas of its cells (`lastCopy`). A paste of that same text pastes the formulas, moved by `engine.move`; a cut moves them unmoved, once. A fill gives a source formula to its targets, moved. Each goes to `createCellWrites` as `{ formula }`, so all or nothing holds; a value over a formula cell takes the formula away, and a formula that a cell holds already is no change.
- After new rows of the owner, the table checks its formula cells in a microtask (`checkRows` in `table.ts`, `recheck` of the engine): it compares the row objects with those of the last check by id, skips the cells that hold what the table reported since, and reports the formula cells that the rest changes through `tell()` with the reason `recalculate`, which is no step. Rows that came or went check every formula: the numbers of the rows moved. A cell gets the same value from a check once (`checkedValues`), so an owner that does not take it causes no loop. At the mount nothing is computed; `recalculate()` checks every formula cell.
- The state of a cell part holds the formula of the cell (`formula`), and the Vue renderer reads it, so a new formula of a table that holds its formulas renders that cell only. A `v-model:cell-formulas` renders the table at each change, as every prop of `Table` does.
- An error of a formula is a text in the row (`#DIV/0!`). `columnText` and `text` show it before any format, and the cell gets `data-formula-error` and the words of the error as `aria-description`.
- The result of a formula never depends on the `locale` of the table or of the machine. The locale changes only what a person types and reads: the signs of a number and between arguments, and the texts of the `period` format. A function whose name Excel has behaves as in Excel; one that behaves in another way gets a name that Excel does not have (`WEEKOF`, `DATEADD`).
- The reads for an agent (`getFormulaSummary`, `evaluateFormula`, `getFormulaFunctions`) run in the engine (`engine.summary`, `engine.evaluateText`). The snapshot of an agent holds no formula: `cellFormulas` is not in `controlled`.
- `packages/vue/README.md`, section "Formulas", names every option, method, slot prop, attribute and message of the formulas, and the differences of the functions from Excel. Apps and the sink build on it without reading the code: change it with the code.
- An Excel file holds a formula only when it means the same there (`formulas/excel.ts`): every cell it reads is in the file with the value of the table (`exact` of `toXlsx`), a range is one column of rows next to each other in the order of the document, and every function is in `EXCEL_FUNCTIONS`. When in doubt, the result. The export entry holds only the writer of `<f>`; the rule is in the formulas entry. A file without the `formula` option is the same bytes as a table without formulas (`formulas/excel.test.ts`).
- Run `BENCH=1 vp test run packages/core/src/formulas/formulas.perf --silent=false` when you change the engine or the glue, and add the lines to "Formulas, 50,000 rows" of `docs/benchmarks.md`.

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

## Docs site (`apps/docs/src/docs`, `plugins/docs`, `docs.css`)

The GitHub Pages site is the docs. A page is written once, as Markdown, and the same text ships in the package for an agent (`packages/vue/docs`).

- A page is `src/docs/pages/<id>.md`: `# Title`, an empty line, one sentence that says what the page is for, then the text. `src/docs/nav.ts` puts it in a group; the order there is the order of the sidebar, of Previous and Next and of `llms.txt`. A group with `inline` stands whole in `llms.txt`.
- An example is a real file, `src/docs/examples/<page>/<name>.vue`, so `vue-tsc` checks it. It holds its own data and imports only from `ui-sdk-table-vue`, `@ui-sdk/vue` and `vue`, so a reader can copy it into a new project. A page names it on a line of its own: `<Example name="<page>/<name>" caption="What to try." />`.
- A link to another page is `[Title](./<id>.md)` or `./<id>.md#<heading>`, as in the package files; the site turns it into `?page=<id>`.
- `plugins/docs` turns the Markdown into HTML at build time (markdown-it, Shiki), so the browser carries no Markdown parser. The site serves the package files at `docs/<file>`, which "Open as Markdown" opens.
- Run `pnpm docs:write` after a change of a page, an example, `nav.ts`, `llms.md` or `readme.md`. It writes `packages/vue/docs`: each page with the code of its examples inline, `llms.txt` and `README.md`. `plugins/docs/docs.test.ts` fails while those files are stale, and for a link that goes nowhere.
- `/` opens the first page of the docs. The sink and the test pages get the bar only, in the looks of their own stylesheet; the sidebar lists the test pages under "Test pages".
- A control of the shell is a UI SDK component: the Preview and Code views are Tabs, the menu of a narrow screen is a Collapsible. Light theme only.
- The pages copy the format of the docs of UI SDK (Apache-2.0); `readme.md` names the source and the licence.

## Sink page (`apps/docs/src/sink`, `pages/SinkPage.vue`, `sink.css`, `plugins/sink-uses.ts`)

A page of the docs app (`?page=sink`): small live tables in a grid of tiles, each with the names of the library that its code uses. It is also the first consumer of the headless API: when a tile needs a workaround, that is a finding about the library.

- A tile is one file `tiles/<group>/<Name>.vue` and one entry in `tiles/<group>.ts`. The id is the file name in kebab-case and starts with its group (`edit-price` is `edit/EditPrice.vue`). The title has one to four words and ends with a period, and says what a person does; the blurb is one sentence. A tile reads top down: the title as its heading, the demo, then the blurb and the names. A demo starts at the top of its stage, so a filter that makes its table shorter moves nothing.
- A tile shows one thing in a concrete scene, with one `Table` that has an `aria-label`. Tables only: no tile for a control.
- The names under a tile are not written by hand. `plugins/sink-uses.ts` reads them from the file of the tile (imports from the library, options, models, events and slots of the `Table` element, calls on a controller made by `createTableController`, keys of a list typed `ColumnDef<…>[]`) and gives them as `virtual:sink-uses`. Write a tile so that the reader finds them: the controller in a `const`, the columns typed. Restart the dev server after a change to the plugin.
- `sink.test.ts` fails for a missing or double id, a wrong title, a tile without a file, a name that the library does not have, and an option, controller method, slot or column key that no tile shows and `NOT_SHOWN` does not list with a reason. A new option of the table gets a tile or a line there.
- Controls beside a table are UI SDK components from `@ui-sdk/vue/<entry>` (wrapped in `parts/Sink*.vue` where a tile repeats them), styled by their `data-slot`. No hand-written `role` on an element for something UI SDK ships.
- Looks: the table and the controls read the `--tile-*` variables of the tone of their tile, so one style works on every tone. The table is styled through `data-slot`, `data-*` and `aria-*` only; a class comes in through `rowAttrs` or `cellAttrs`. A new tone or a new pair of colours gets its line in the contrast test of `e2e/sink.spec.ts` (`?tone=<name>` shows every tile on one tone).
- The places of the tiles come from `pack.ts`, not from `grid-auto-flow: dense`: the order of the document is the order on the screen, so the Tab key reads the page as the eye does. `pack` lets a neighbour grow over a free cell; a hole inside the grid fails a test. The last line of tiles keeps its holes, so no tile stretches across the page to fill it. The page closes with `more-app`, a `full` tile (every column, two rows) that shows many options in one real table.
- A tile mounts its demo when it comes within one screen of the view (`SinkTile.vue`), and the demos are separate chunks. `?eager` mounts all, for a measurement or a test of every tile. An error in one demo shows in its tile.
- The tones come in three weights, as on the sink page of UI SDK: neutral (`paper`, `sand`), soft (`mist`, `moss`, `sun`, `plum`) and bold (`clay`, `ink`, `navy`, `pine`, `wine`). Keep most tiles neutral or soft and about one in five bold, spread over the bold colours (the orange `clay` on one or two tiles at most) so that two bold cards never touch at 1440 px.
- A table has no fill of its own: its rows and cells show the card (`--tile-bg`). A tint (band, hover, pick, range, a fill of a format) is an opaque `color-mix` with `--tile-bg`, and a part that sticks (header, footer, pinned columns and rows, row numbers, an editor) takes `--tile-bg` itself, so it hides what scrolls under it. A control beside a table is a veil of the surface over the card (`--tile-control`), so it takes the colour of its card; a popup is opaque `--tile-surface`. On the orange `clay` card a tint goes darker (`--tile-tint`, `--tile-alert-tint`), so the near-white text holds.
- The tiles of the group `style` (`look-brutal`, `look-pixel`, `look-swiss`, `look-deco` on their demo) leave the tones on purpose, to show that the looks are the page's: each sets the `--tile-*` variables of its card and its own fonts and cell colours, still through `data-slot`, `data-*` (a `data-state` from `cellAttrs`) and the place of a row. Their text pairs have their own contrast test in `e2e/sink.spec.ts`.
- A pattern on a card (the grid of `navy`) shows only on a tile whose table has nothing that sticks, because a part that sticks cannot match it.
- Only the sink page loads Geist, Geist Mono and Geist Serif, from the files of the npm package `geist` (`@font-face` in `sink.css`), and links their licence. Geist Serif is for the page title, the heading of each tile (its title, which says what the tile shows), a number of the scene that matters (`.display`: a sum, a count) and the empty state of the filter, at its one weight. The name of a scene above a table is sans (`.scene-title`).
- A tile is a scene with air around it: its table stands whole at the top of the stage, and no row is cut unless the tile is about scrolling (the row window, sticky rows, pinned rows or columns). Give a tile fewer rows (a slice of the shared data) rather than a frame that scrolls. The frame of a table is as high as its table and scrolls only when the stage has no more room.
- A table whose columns can be resized must not stretch to its frame: a column that is shown wider than its width does not follow the pointer in a drag (`sink.css`, the rule with `:has([data-slot='table-resizer'])`).

## Commands

```bash
vp install        # install
vp run dev        # docs app, http://localhost:5180
pnpm docs:write   # write packages/vue/docs from the pages and examples
vp check [--fix]  # format, lint, type-aware lint
vp run type-check # vue-tsc --build (authoritative for .vue files)
vp test           # unit tests (packages/core, packages/vue, apps/docs)
vp run test:e2e   # Playwright against apps/docs
vp run build      # build the packages
```

Run `vp check`, `vp run type-check` and `vp test` before you call work done; add `vp run test:e2e` when a page or a part changed. Unset `NODE_PATH` first if `vp check` ignores the `fmt` block.

## CI and dependency updates (`.github`)

- `ci.yml` runs the five checks (`check`, `type-check`, the unit tests, the browser tests, `build`) on every pull request and every push to `master`.
- Dependabot opens its pull requests on Monday at 06:00 UTC: one for the minor and patch updates of npm, one for those of the actions, and one for each major update. The job `dependabot` of `ci.yml` merges a minor or patch update after the checks pass, and starts the deploy of the docs. A major update gets the label `needs-review` and waits for a person.
- `dependabot.yml` ignores `@ui-sdk/*`, `vue-tsc`, the minor and major updates of `typescript`, and the `vite` alias, for the reasons under "Tooling facts that cost time". Take one of these by hand, and change the list when its reason is gone.
- Do not bump another dependency by hand unless it cannot wait for Monday.

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
- The sink page has its own browser tests (`e2e/sink.spec.ts`); the rules of the table itself are tested on the demo pages. A browser test of a headless rule lives on a headless docs page. `?page=groups` has group rows, totals, facets, the search field, the sort mode switch, a `lead` column and caller attributes; `?page=window&frame=page&bars` has a fixed header and footer of the page for `--table-sticky-top` and `--table-sticky-bottom`.
