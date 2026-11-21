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

Then install the registry item from the raw address of the file in this repository:

```bash
pnpm dlx shadcn-vue@latest add https://raw.githubusercontent.com/falldownthesystem/ui-sdk-table/master/packages/styled/registry/data-table.json
```

The files go to `src/components/DataTable/`. Every file name starts with `DataTable`, so an app that registers components by file name gets no clash. The item names `@ui-sdk/vue`, `@ui-sdk/core` (both at the exact beta) and `@lucide/vue` as dependencies. It does not name the table packages, because they are not on npm, and it does not ship `utils.ts`. While the repository is private, the raw address needs a login; pass a local path to the file in a checkout instead.

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
| `label` | `string` | The name of the table. Assistive technology and an agent find the table and its controls by it. |
| `search` | `boolean` | A search field in the toolbar. The text is `filter.search`. |
| `columnFilters` | `boolean` | A button that opens a popover with one filter for each column in view: text, a list of the values of the column (`filter: 'select'`), a number range (number formats), a date range (date formats). `meta.filterable: false` leaves a column out. |
| `columnMenu` | `boolean` | A menu that shows and hides columns. `hideable: false` on a column keeps it in view. |
| `pagination` | `boolean` | The pages under the table. Without `page` and `defaultPage`, the table starts on page 1 with the first of `pageSizes`. |
| `pageSizes` | `number[]` | The page sizes to choose from. Defaults to 10, 25, 50, 100. |
| `export` | `boolean \| { csv?, xlsx?, filename?, options? }` | A menu that writes a CSV or an Excel file. The writers load on the first export. |
| `selection` | `'single' \| 'multiple'` | Row selection with a checkbox column, a select-all checkbox and a checkbox on each group row. |
| `width` | `'full' \| 'auto'` | `full` fills the place the table has. `auto` is as wide as the columns need. |
| `scroll` | `'self' \| 'page'` | `self`: the frame scrolls once `wrapperClass` gives it a height. `page`: the frame never scrolls, so sticky rows stay at the edge of the page. |
| `skeletonRows` | `number` | How many skeleton rows show while `loading` is set and there are no rows. Defaults to 3. |
| `messages` | `Partial<DataTableMessages>` | Texts of the controls and of the headless table. A new object changes the texts at run time. |
| `wrapperClass`, `tableClass`, `headerClass`, `cellClass` | class | A class for the frame, the `table`, each header cell and each body cell. A class of the caller wins over the class of the table (`tailwind-merge`). |
| `rowClass` | class or `(row, index) => class` | A class for each body row, or for one data row. |
| `defaultExpanded` | `string[] \| 'all'` | `'all'` opens every group and every row with child rows at mount. |

A column takes `meta`: `align` (`start`, `center`, `end`), `class` (a class or `(value, row) => class` for each body cell), `headerClass`, `wrap`, `filterable`.

## Models

Each state has `v-model:<key>`, `default<Key>` and a `<key>Change` event with details: `sort`, `filter`, `groupBy`, `page`, `expanded`, `selected`, `columnVisibility`, `columnOrder`, `columnWidths`, `columnPinning`, `rowPinning`, `cellRange`. `columnWidthsCommit` and `cellRangeCommit` report the end of a drag, `cellEdit` an edit.

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

## Parts

`index.ts` also exports the parts (`DataTableToolbar`, `DataTableFilters`, `DataTableColumnMenu`, `DataTableExportMenu`, `DataTablePagination`, `DataTableSelect`, `DataTableCheckbox`), the class helpers of `DataTableClasses.ts` (`buttonClass`, `inputClass`, ...) and `useDataTable()`, which gives a part inside a `DataTable` the controller, the current view and the messages.

## In this repository

- Source: `src/data-table/`. Tests: `src/tests/` (parts with `@vue/test-utils`, one agent test). `src/lib/utils.ts` stands in for `@/lib/utils` of the app and is not shipped.
- `pnpm --filter ui-sdk-table-styled build` writes `registry/data-table.json` from the source. The file is committed. `scripts/build-registry.test.ts` fails when it is stale, and when a shipped file imports something that would not resolve after the copy.
- Demos: `apps/docs`, `?page=styled`. Browser tests: `apps/docs/e2e/styled.spec.ts` and `styled-contrast.spec.ts`.
