<script setup lang="ts">
import { SearchIcon, XIcon } from '@lucide/vue'
import { Input, InputClear, InputGroup } from '@ui-sdk/vue/input'
import { cn } from '@/lib/utils'
import { buttonClass, inputClass } from './DataTableClasses'
import DataTableColumnMenu from './DataTableColumnMenu.vue'
import DataTableExportMenu from './DataTableExportMenu.vue'
import DataTableFilters from './DataTableFilters.vue'
import { useDataTable, type DataTableExport, type DataTableToolbarSlotProps } from './types'

defineProps<{
	search?: boolean
	columnFilters?: boolean
	columnMenu?: boolean
	/** What the export menu offers, or `undefined` for a table without an export. */
	export?: DataTableExport
}>()

defineSlots<{
	/** The controls of the caller, after the search and the filters. */
	default?: (props: DataTableToolbarSlotProps) => unknown
}>()

const { controller, view, messages, label } = useDataTable()
</script>

<template>
	<div data-slot="data-table-toolbar" class="flex flex-wrap items-center gap-2">
		<InputGroup v-if="search" class="relative w-full sm:w-64">
			<SearchIcon
				aria-hidden="true"
				class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				type="text"
				inputmode="search"
				enterkeyhint="search"
				autocomplete="off"
				:value="view?.filter.search ?? ''"
				:placeholder="messages.search()"
				:aria-label="messages.searchLabel({ table: label })"
				:class="cn(inputClass, 'px-8')"
				@value-change="(text: string) => controller.setSearch(text)"
			/>
			<InputClear
				:aria-label="messages.clearSearch()"
				:class="cn(buttonClass('ghost', 'icon-xs'), 'absolute top-1/2 right-1.5 -translate-y-1/2')"
			>
				<XIcon aria-hidden="true" />
			</InputClear>
		</InputGroup>
		<DataTableFilters v-if="columnFilters" />
		<slot :controller="controller" :view="view" />
		<div v-if="columnMenu || $props.export" class="ms-auto flex flex-wrap items-center gap-2">
			<DataTableColumnMenu v-if="columnMenu" />
			<DataTableExportMenu v-if="$props.export" v-bind="$props.export" />
		</div>
	</div>
</template>
