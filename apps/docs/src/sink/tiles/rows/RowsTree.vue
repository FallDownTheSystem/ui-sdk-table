<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import SinkIcon from '../../parts/SinkIcon.vue'

type Entry = { id: string; name: string; size?: number; children?: Entry[] }

const files: Entry[] = [
	{
		id: 'src',
		name: 'src',
		children: [
			{
				id: 'src/rows',
				name: 'rows',
				children: [
					{ id: 'src/rows/sort.ts', name: 'sort.ts', size: 4.1 },
					{ id: 'src/rows/filter.ts', name: 'filter.ts', size: 7.8 },
					{ id: 'src/rows/group.ts', name: 'group.ts', size: 5.2 },
				],
			},
			{ id: 'src/table.ts', name: 'table.ts', size: 132.4 },
			{ id: 'src/index.ts', name: 'index.ts', size: 2.3 },
		],
	},
	{
		id: 'docs',
		name: 'docs',
		children: [{ id: 'docs/benchmarks.md', name: 'benchmarks.md', size: 6.7 }],
	},
	{ id: 'README.md', name: 'README.md', size: 3.9 },
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
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="files"
				:columns="columns"
				:get-children="(entry: Entry) => entry.children"
				:default-expanded="['src', 'src/rows']"
				sticky-header
				aria-label="Files of a project"
			>
				<template #col-name="{ text, expandable, expanded, toggleExpanded }">
					<span class="cell-name">
						<Button
							v-if="expandable"
							class="twist"
							:aria-expanded="expanded"
							:aria-label="`Folder ${text}`"
							@click="toggleExpanded"
						>
							<SinkIcon name="chevron" />
						</Button>
						<span v-else class="twist-gap" />
						<SinkIcon :name="expandable ? 'folder' : 'file'" />
						{{ text }}
					</span>
				</template>
			</Table>
		</div>
	</div>
</template>
