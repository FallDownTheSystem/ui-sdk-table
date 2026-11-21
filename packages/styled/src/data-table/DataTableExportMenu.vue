<script setup lang="ts">
import { ChevronDownIcon, DownloadIcon } from '@lucide/vue'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@ui-sdk/vue/menu'
import type { ExportOptions } from 'ui-sdk-table-vue'
import { buttonClass, listContentClass, listItemClass } from './DataTableClasses'
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

const { controller, messages } = useDataTable()

const name = () => (typeof props.filename === 'function' ? props.filename() : props.filename)

// The writers load when a person asks for a file, so a page whose table has
// no export, or whose export nobody uses, does not carry them.
async function writeCsv() {
	const { downloadCsv } = await import('ui-sdk-table-vue/export')
	downloadCsv(controller.exportData(props.options), name())
}

async function writeXlsx() {
	const { downloadXlsx } = await import('ui-sdk-table-vue/export')
	await downloadXlsx(controller.exportData(props.options), name())
}
</script>

<template>
	<Menu>
		<MenuTrigger :class="buttonClass('outline')">
			<DownloadIcon aria-hidden="true" />
			{{ messages.exportData() }}
			<ChevronDownIcon aria-hidden="true" class="text-muted-foreground" />
		</MenuTrigger>
		<MenuContent align="end" :side-offset="4" :class="listContentClass">
			<MenuItem v-if="csv" value="csv" :class="listItemClass" @select="writeCsv">
				{{ messages.exportCsv() }}
			</MenuItem>
			<MenuItem v-if="xlsx" value="xlsx" :class="listItemClass" @select="writeXlsx">
				{{ messages.exportXlsx() }}
			</MenuItem>
		</MenuContent>
	</Menu>
</template>
