<script setup lang="ts">
import { CheckIcon, ChevronDownIcon } from '@lucide/vue'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectItemIndicator,
	SelectTrigger,
	SelectValue,
} from '@ui-sdk/vue/select'
import { cn } from '@/lib/utils'
import {
	listContentClass,
	listIndicatorClass,
	listItemClass,
	selectTriggerClass,
} from './DataTableClasses'
import type { ClassValue, DataTableSelectItem } from './types'

const props = defineProps<{
	items: readonly DataTableSelectItem[]
	/** The chosen value, or the chosen values with `multiple`. */
	value: string | readonly string[] | null
	/** The name of the list, for assistive technology and for an agent. */
	label: string
	multiple?: boolean
	placeholder?: string
	class?: ClassValue
}>()

const emit = defineEmits<{ change: [value: string | string[] | null] }>()

function onValueChange(next: unknown) {
	// The list is controlled: the value comes back through `value`, from the state of the table.
	if (Array.isArray(next)) emit('change', next.map(String))
	else emit('change', next === null || next === undefined ? null : String(next))
}
</script>

<template>
	<Select
		:items="[...items]"
		:value="multiple ? [...(Array.isArray(value) ? value : [])] : (value as string | null)"
		:multiple="multiple"
		:placeholder="placeholder"
		@value-change="onValueChange"
	>
		<SelectTrigger :aria-label="label" :class="cn(selectTriggerClass, props.class)">
			<SelectValue class="truncate" :max-labels="2" />
			<ChevronDownIcon aria-hidden="true" class="text-muted-foreground" />
		</SelectTrigger>
		<SelectContent :side-offset="4" align="start" :class="listContentClass">
			<SelectItem
				v-for="item in items"
				:key="item.value"
				:value="item.value"
				:class="listItemClass"
			>
				{{ item.label }}
				<SelectItemIndicator :class="listIndicatorClass">
					<CheckIcon aria-hidden="true" />
				</SelectItemIndicator>
			</SelectItem>
		</SelectContent>
	</Select>
</template>
