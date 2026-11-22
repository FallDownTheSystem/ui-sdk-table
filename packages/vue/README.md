# ui-sdk-table-vue

The headless table for Vue: `Table`, its parts, slots, a `v-model` for each state, and `createTableController`. It renders a real `<table>` without any looks. A styled table is the work of the consumer, and is built on it.

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
	<Table :rows="people" :columns="columns" aria-label="People" />
</template>
```

## Docs

The docs are at https://falldownthesystem.github.io/ui-sdk-table/. The same pages ship in this package as Markdown in `docs`: start with `docs/llms.txt`, and `docs/README.md` lists every page.
