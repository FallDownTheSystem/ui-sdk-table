# ui-sdk-table-vue

The headless table for Vue: `Table`, its parts, slots, a `v-model` for each state, and `createTableController`. It renders a real `<table>` without any looks. The styled table of `packages/styled` is built on it.

```vue
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Person = { id: string; name: string; team: string }
const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{ id: 'team', header: 'Team' },
]
</script>

<template>
	<Table :rows="people" :columns="columns" label="People" />
</template>
```

- `ui-sdk-table-vue/export` holds the CSV and Excel writers. Load it with `import()` where a person asks for a file, so a page without an export does not carry it.
- The package ships TypeScript source (`exports` points at `src`), so an app compiles it with its own compiler options.
- The export is named `Table`. An app that registers a component of its own with that name (for example by file name) imports this one under another name: `import { Table as HeadlessTable } from 'ui-sdk-table-vue'`.
- `rowAttrs` and `cellAttrs` give attributes to rows and cells. The table spreads them first and its own attributes after them, so a caller cannot replace a part prop (`value`, `index`, `row`, `col`, `colspan`) or a state attribute (`aria-*`, `data-*` of the table).
- `createTableController()` can be used before the table mounts: `subscribe` waits for the table and runs once when it is there.
