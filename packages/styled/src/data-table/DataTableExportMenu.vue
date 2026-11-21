<script setup lang="ts">
import { ChevronDownIcon, DownloadIcon } from '@lucide/vue'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@ui-sdk/vue/menu'
import type { ExportOptions } from 'ui-sdk-table-vue'
import { buttonClass, listContentClass, listItemClass } from './DataTableClasses'
import type { DataTableExportFormat } from './messages'
import { useDataTable } from './types'

const props = withDefaults(
	defineProps<{
		csv?: boolean
		xlsx?: boolean
		/** The name of the file, without its ending. */
		filename?: string | (() => string)
		options?: ExportOptions
	}>(),
	{ csv: true, xlsx: true, filename: 'export' },
)

const { controller, messages, label, exportStarted, exportFailed } = useDataTable()

// The writers load when a person asks for a file, so a page whose table has
// no export, or whose export nobody uses, does not carry them. The load can
// fail, and so can the data and the file: the person hears of each.
async function write(format: DataTableExportFormat) {
	exportStarted()
	try {
		const writers = await import('ui-sdk-table-vue/export')
		const name = typeof props.filename === 'function' ? props.filename() : props.filename
		const data = controller.exportData(props.options)
		if (format === 'csv') writers.downloadCsv(data, name)
		else await writers.downloadXlsx(data, name)
	} catch (error) {
		exportFailed(error, format)
	}
}
</script>

<template>
	<Menu>
		<MenuTrigger
			data-export-trigger
			:aria-label="messages.exportLabel({ table: label })"
			:class="buttonClass('outline')"
		>
			<DownloadIcon aria-hidden="true" />
			{{ messages.exportData() }}
			<ChevronDownIcon aria-hidden="true" class="text-muted-foreground" />
		</MenuTrigger>
		<MenuContent align="end" :side-offset="4" :class="listContentClass">
			<MenuItem v-if="csv" value="csv" :class="listItemClass" @select="write('csv')">
				{{ messages.exportCsv() }}
			</MenuItem>
			<MenuItem v-if="xlsx" value="xlsx" :class="listItemClass" @select="write('xlsx')">
				{{ messages.exportXlsx() }}
			</MenuItem>
		</MenuContent>
	</Menu>
</template>
