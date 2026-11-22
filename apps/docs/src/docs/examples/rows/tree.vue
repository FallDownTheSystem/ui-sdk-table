<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Entry = { id: string; name: string; size?: number; children?: Entry[] }

const files: Entry[] = [
	{
		id: 'src',
		name: 'src',
		children: [
			{ id: 'src/main.ts', name: 'main.ts', size: 1.2 },
			{ id: 'src/app.vue', name: 'app.vue', size: 4.8 },
		],
	},
	{
		id: 'docs',
		name: 'docs',
		children: [{ id: 'docs/guide.md', name: 'guide.md', size: 9.5 }],
	},
	{ id: 'package.json', name: 'package.json', size: 0.9 },
]

const columns: ColumnDef<Entry>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{
		id: 'size',
		header: 'Size',
		sortable: true,
		format: 'decimal',
		formatOptions: { suffix: ' kB' },
	},
]
</script>

<template>
	<Table
		:rows="files"
		:columns="columns"
		:get-children="(entry: Entry) => entry.children"
		:default-expanded="['src']"
		aria-label="Files of a project"
	>
		<template #col-name="{ text, expandable, expanded, toggleExpanded }">
			<button
				v-if="expandable"
				type="button"
				:aria-expanded="expanded"
				:aria-label="`Folder ${text}`"
				@click="toggleExpanded"
			>
				{{ expanded ? '▾' : '▸' }}
			</button>
			{{ text }}
		</template>
	</Table>
</template>
