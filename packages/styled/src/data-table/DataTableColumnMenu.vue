<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, Columns3Icon } from '@lucide/vue'
import {
	Menu,
	MenuCheckboxItem,
	MenuContent,
	MenuItem,
	MenuItemIndicator,
	MenuSeparator,
	MenuTrigger,
} from '@ui-sdk/vue/menu'
import { computed } from 'vue'
import {
	buttonClass,
	listContentClass,
	listIndicatorClass,
	listItemClass,
} from './DataTableClasses'
import { isOwnColumn, useDataTable } from './types'

const { controller, view, messages } = useDataTable()

/** The columns that a person can hide, in the order of their definition. */
const columns = computed(() =>
	(view.value?.columns ?? []).filter(
		(column) => !isOwnColumn(column.id) && column.hideable !== false,
	),
)
const visible = computed(() => new Set(view.value?.visibleColumns.map((column) => column.id)))
</script>

<template>
	<Menu>
		<MenuTrigger :class="buttonClass('outline')">
			<Columns3Icon aria-hidden="true" />
			{{ messages.columns() }}
			<ChevronDownIcon aria-hidden="true" class="text-muted-foreground" />
		</MenuTrigger>
		<MenuContent align="end" :side-offset="4" :class="listContentClass">
			<MenuCheckboxItem
				v-for="column in columns"
				:key="column.id"
				:value="column.id"
				:checked="visible.has(column.id)"
				:class="listItemClass"
				@checked-change="(checked: boolean) => controller.setColumnVisibility(column.id, checked)"
			>
				{{ column.header ?? column.id }}
				<MenuItemIndicator :class="listIndicatorClass">
					<CheckIcon aria-hidden="true" />
				</MenuItemIndicator>
			</MenuCheckboxItem>
			<MenuSeparator class="-mx-1 my-1 h-px bg-border" />
			<MenuItem
				value="show-all"
				:close-on-select="false"
				:class="listItemClass"
				@select="() => controller.showAllColumns()"
			>
				{{ messages.showAllColumns() }}
			</MenuItem>
		</MenuContent>
	</Menu>
</template>
