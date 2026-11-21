# Styled table

A styled data table for Vue, built on `Table` from `ui-sdk-table-vue`. An app does not depend on this package. It installs the source through a registry file and owns the copy.

- Every control is a UI SDK component (`@ui-sdk/vue`): button, checkbox, input, select, popover, menu, pagination. No reka-ui, no shadcn-vue.
- The looks are Tailwind CSS 4 utilities with the token names of the app (`bg-background`, `text-foreground`, `border-border`, `bg-muted`, ...). Dark mode works through a `.dark` class on a parent.
- Icons come from `@lucide/vue`. `cn` comes from `@/lib/utils` of the app.

## Install in an app

The app needs Tailwind CSS 4 with the shadcn token names, `@/lib/utils` with `cn` (clsx and tailwind-merge), and the two table packages. The table packages are not on npm, so the app adds them from a commit of this repository before the registry install. In `package.json`:

```json
"ui-sdk-table-core": "github:FallDownTheSystem/ui-sdk-table#<commit>&path:/packages/core",
"ui-sdk-table-vue": "github:FallDownTheSystem/ui-sdk-table#<commit>&path:/packages/vue"
```

The vue package depends on the core package through the workspace of this repository, which an install from git cannot resolve. One line under `overrides` in `pnpm-workspace.yaml` of the app points it at the same commit:

```yaml
'ui-sdk-table-core': 'github:FallDownTheSystem/ui-sdk-table#<commit>&path:/packages/core'
```

The commit is in three places; raise all three together. The packages ship TypeScript source, so the app compiles them with its own compiler options.

Then copy the files with the install script of this repository, from a checkout of it:

```bash
node <checkout>/packages/styled/scripts/install-data-table.mjs <app root>
node <checkout>/packages/styled/scripts/install-data-table.mjs <app root> --check
```

The script writes each file of `registry/data-table.json` to `src/components/DataTable/` of the app, byte for byte, and changes nothing else. With `--check` it writes nothing and exits with 1 when a file differs from the item or is missing, so the checks of the app can say when its copy is behind or was edited. It names a file of that folder that the item does not ship, and leaves it alone. The app adds `@ui-sdk/vue`, `@ui-sdk/core` (both at the exact beta that the item names) and `@lucide/vue` itself.

The shadcn-vue CLI installs the same item, with limits:

```bash
pnpm dlx shadcn-vue@latest add <path or address of packages/styled/registry/data-table.json>
```

- The CLI (2.9.0) writes every file again with an indent of four spaces, so the copy is not the bytes of the item and `--check` fails for it.
- It may edit the stylesheet of the app.
- It adds the dependencies of the item. `@ui-sdk/core` is one of them though no shipped file imports it: it is the peer of `@ui-sdk/vue` and of the table packages, and both UI SDK packages must be the same beta.
- While the repository is private, the raw address of the file needs a login; pass a local path.

The item does not name the table packages, because they are not on npm, and it does not ship `utils.ts`. Every `.vue` file of the item starts with `DataTable`, so an app that registers components by file name gets no clash. `index.ts`, `messages.ts`, `types.ts` and `DataTableClasses.ts` are modules, not components.

An app that registers a component of its own named `Table` imports the headless table under another name where it needs both: `import { Table as HeadlessTable } from 'ui-sdk-table-vue'`. The files of the styled table import `Table` themselves, and an import of a file wins over a component that the app registered, so they need no change.

```vue
<script setup lang="ts">
import { DataTable, type DataTableColumn } from '@/components/DataTable'

type Person = { id: number; name: string; role: string; age: number }
const columns: DataTableColumn<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'role', header: 'Role', filter: 'select' },
	{ id: 'age', header: 'Age', format: 'integer' },
]
</script>

<template>
	<DataTable
		v-model:selected="selected"
		:rows="people"
		:columns="columns"
		label="People"
		search
		column-filters
		column-menu
		pagination
		selection="multiple"
		:export="{ filename: 'people' }"
	/>
</template>
```

## Props

Every prop of the headless `Table` passes through: `rows`, `columns`, `getRowId`, `getChildren`, `locale`, `searchMode`, `canGroup`, `canSelect`, `resizable`, `reorderable`, `rowWindow`, `rowHeight`, `estimatedRowHeight`, `stickyHeader`, `stickyFooter`, `hasDetail`, `editable`, `cellSelection`, `manualSort`, `manualFilter`, `manualPage`, `rowCount`, `loading`, `controller`.

| Prop | Type | What it does |
| --- | --- | --- |
| `label` | `string` | The name of the table. Assistive technology and an agent find the table by it, and tell its controls from those of another table: the names of the controls end with it ("Filters, People"). A table without `label` is a grid without a name; in development the console warns. |
| `search` | `boolean` | A search field in the toolbar. The text is `filter.search`. |
| `columnFilters` | `boolean` | A button that opens a popover with one filter for each column in view: text, a list of the values of the column (`filter: 'select'`), a number range (number formats), a date range (date formats). `meta.filterable: false` leaves a column out. |
| `columnMenu` | `boolean` | A menu that shows and hides columns. `hideable: false` on a column keeps it in view. |
| `pagination` | `boolean` | The pages under the table. Without `page` and `defaultPage`, the table starts on page 1 with the first of `pageSizes`. It can change at run time: false takes the pages away and shows every row, true starts on page 1 again. With `manualPage`, the pages stay on the page while a page loads. |
| `pageSizes` | `number[]` | The page sizes to choose from. Defaults to 10, 25, 50, 100. |
| `export` | `boolean \| { csv?, xlsx?, filename?, options? }` | A menu that writes a CSV or an Excel file. The writers load on the first export. |
| `selection` | `'single' \| 'multiple'` | Row selection with a checkbox column, a select-all checkbox and a checkbox on each group row. See "Selection" below. |
| `facets` | `Record<string, { values?, range?, dates? }>` | The choices of the filter controls by column id, from the owner of the rows. See "Filters on a server" below. |
| `width` | `'full' \| 'auto'` | `full` fills the place the table has. `auto` is as wide as the columns need. |
| `scroll` | `'self' \| 'page'` | `self`: the frame scrolls once `wrapperClass` gives it a height. `page`: the frame never scrolls, so sticky rows stay at the edge of the page; a table that is wider than its place makes the frame as wide as itself, and the page scrolls. |
| `skeletonRows` | `number` | How many skeleton rows show while `loading` is set and there are no rows. Defaults to 3. |
| `messages` | `Partial<DataTableMessages>` | Texts of the controls and of the headless table. A new object changes the texts at run time. |
| `wrapperClass`, `tableClass`, `headerClass`, `cellClass` | class | A class for the frame, the `table`, each header cell and each body cell. A class of the caller wins over the class of the table (`tailwind-merge`). |
| `rowClass` | class or `(row, index) => class` | A class for each body row, or for one data row. For a fill, see "Pinned and sticky cells" below. |
| `defaultExpanded` | `string[] \| 'all'` | `'all'` opens every group and every row with child rows at mount. |

A column takes `meta`: `align` (`start`, `center`, `end`), `class` (a class or `(value, row) => class` for each body cell), `headerClass`, `wrap`, `filterable`.

## Selection

- The checkbox in the header selects every row that passes the filters: on every page, and child rows that are closed too. Its name says how many ("Select all 250 rows, Customers"). It is mixed while some of them are selected, also when every row of the page in view is. This is `selectAll` of the headless table.
- Space on a cell selects its row. Space on a group row selects the rows of the group, and Space again takes them out. Enter on a group row opens it; F2 goes into the cell, to its checkbox and its button.
- `getChildren` is read when the rows change. Set it from the start; when it comes later, give the table a new `rows` array with it (a copy is enough), or the column of buttons shows without buttons.
- `canSelect` is read again when it is a new function or the rows are new. A function that answers differently while it and the rows stay the same is not asked again: give a new function.
- A change of `selection` at run time keeps the selected rows as they are. From `multiple` to `single`, set `selected` to the one row to keep.

## Filters on a server

With `manualFilter`, the rows of the table are the rows that pass the filter, so they no longer hold the other choices of a list, the lowest number or the first date. Give those through `facets`, by column id:

```vue
<DataTable
	manual-filter
	column-filters
	:facets="{
		team: { values: [{ value: 'design', text: 'Design' }, { value: 'platform' }] },
		score: { range: { min: 0, max: 100 } },
		joined: { dates: { from: '2020-01-01', to: '2026-12-31' } },
	}"
/>
```

Without `facets`, a list shows the values of the rows that the table has, and a value that is chosen stays in the list and in the filter while it has no row. A date filter takes its days in the time zone of its column (`formatOptions.timeZone`).

## Pinned and sticky cells

A cell of a pinned column, of a sticky header and of a sticky footer is opaque (`bg-background`), so the rows that scroll under it do not show through. It paints the tint of its row itself, as a layer over its fill: the hover and the selection of the table come with it. A fill of the caller on a row needs the same colour for the cells of the row:

```vue
<DataTable :row-class="(row) => row.late && 'bg-warning/15 *:from-warning/15'" />
```

`bg-warning/15` is the fill of the row, and `*:from-warning/15` is the layer of its opaque cells. Without the second class, a pinned cell of that row stays white.

With `scroll="page"`, a sticky header stops at the top of the page, and a sticky footer at its end. An app with a fixed header of its own gives the height of that header in `--table-sticky-top` (and `--table-sticky-bottom` for a fixed footer), on the table or on any element around it:

```vue
<DataTable sticky-header scroll="page" wrapper-class="[--table-sticky-top:--spacing(14)]" />
```

The table adds the variable to the place of each sticky row. `--spacing(14)` is the height of `h-14`; an app can also set the variable in its own stylesheet.

## Models

Each state has `v-model:<key>`, `default<Key>` and a `<key>Change` event with details: `sort`, `filter`, `groupBy`, `page`, `expanded`, `selected`, `columnVisibility`, `columnOrder`, `columnWidths`, `columnPinning`, `rowPinning`, `cellRange`. `columnWidthsCommit` and `cellRangeCommit` report the end of a drag, `cellEdit` an edit. `exportError` reports an export that gave no file (`(error, { format })`): the writers did not load, or the data or the file could not be written. The table shows a message with a button that takes it away, and says it to assistive technology.

`columnOrder` and `columnPinning` hold the column ids of the caller only. The checkbox column and the column with the buttons that open rows are always first, and stick to the start once a column is pinned there.

After a search, a filter, a sort or a page, the table says the result in a polite live region (`rowsFound`, `sortedBy`, `pageOf`), once after a pause of half a second.

## Slots

| Slot | Props | Fills |
| --- | --- | --- |
| `col-{id}`, `cell` | `CellSlotProps` | One body cell. The slot by column id wins. |
| `header-{id}`, `header` | `HeaderSlotProps` | One header cell. |
| `foot-{id}`, `foot` | `FootSlotProps` (with `totals`) | One footer cell. |
| `edit-{id}`, `editor` | `EditorSlotProps` | The editor of a cell. |
| `group` | `GroupSlotProps` (with `totalTexts`) | A group row, in place of the button and the totals. |
| `detail` | `DetailSlotProps` | The detail row of a row that `hasDetail` names. |
| `empty` | none | Shown in place of the rows when the table has none. |
| `loading` | none | Shown in place of the skeleton rows. |
| `toolbar` | `{ controller, view }` | The caller's own controls in the toolbar, after the search and the filters. |

## Messages

`messages.ts` holds every text as a function (`DataTableMessages`: the texts of the headless table plus those of the controls, such as `search`, `filters`, `columns`, `exportCsv`, `pageOf`, `showingRows`, `selectRow`). `defaultDataTableMessages` is the English set. Pass a partial object to `messages`; the rest stays English.

A control that a page can hold once for each table has two texts: what a person sees (`filters`, `columns`, `exportData`, `search`, `filtersTitle`, `pageNumber`) and its name (`filtersLabel`, `columnsLabel`, `exportLabel`, `searchLabel`, `filtersTitleLabel`, `pageLink`). A name is its text and the name of the table, so a translation of the text alone gives the name too. The other names take `table` in their details (`nextPage`, `selectAllRows`, `expandAllRows`, `pagination`, `pageSizeLabel`): put it in the translation. `showingRows` and `rowsFound` take a `unit` (`rows`, `groups`, `parents`, `mixed`), because the pages of a grouped table count groups and those of a tree count top-level rows.

## Parts

`index.ts` also exports the parts (`DataTableToolbar`, `DataTableFilters`, `DataTableColumnMenu`, `DataTableExportMenu`, `DataTablePagination`, `DataTableSelect`, `DataTableCheckbox`), the class helpers of `DataTableClasses.ts` (`buttonClass`, `inputClass`, ...) and `useDataTable()`, which gives a part inside a `DataTable` the controller, the current view and the messages.

## In this repository

- Source: `src/data-table/`. Tests: `src/tests/` (parts with `@vue/test-utils`, one agent test). `src/lib/utils.ts` stands in for `@/lib/utils` of the app and is not shipped.
- `pnpm --filter ui-sdk-table-styled build` writes `registry/data-table.json` from the source, with LF line ends on every computer and the UI SDK version of the `catalog` in `pnpm-workspace.yaml`. The file is committed. `scripts/build-registry.test.ts` fails when it is stale, when a shipped file imports something that would not resolve after the copy, and when the source folder holds a file that is neither `.vue` nor `.ts`.
- `scripts/install-data-table.mjs` copies the item into an app; `scripts/install-data-table.test.ts` tests it.
- Demos: `apps/docs`, `?page=styled`. Browser tests: `apps/docs/e2e/styled.spec.ts`, `styled-grid.spec.ts` and `styled-contrast.spec.ts`.
