<script setup lang="ts">
import { CheckIcon, MinusIcon } from '@lucide/vue'
import { Checkbox, CheckboxIndicator } from '@ui-sdk/vue/checkbox'
import { cn } from '@/lib/utils'
import { checkboxClass } from './DataTableClasses'
import type { ClassValue } from './types'

defineProps<{
	checked: boolean | 'indeterminate'
	/** The name of the checkbox, for assistive technology and for an agent. */
	label: string
	disabled?: boolean
	class?: ClassValue
}>()

const emit = defineEmits<{
	/** A person or an agent wants the other state. The owner of the state decides. */
	change: [checked: boolean, event: Event | undefined]
}>()

function onCheckedChange(next: boolean | 'indeterminate', details: { event?: Event }) {
	// The checkbox is controlled: the owner of the state writes it, and the new
	// state comes back through `checked`.
	emit('change', next === true, details.event)
}
</script>

<template>
	<Checkbox
		:checked="checked"
		:disabled="disabled"
		:aria-label="label"
		:class="cn(checkboxClass, $props.class)"
		@checked-change="onCheckedChange"
	>
		<CheckboxIndicator
			v-slot="{ state }"
			aria-hidden="true"
			class="flex items-center justify-center"
		>
			<MinusIcon v-if="state.indeterminate" />
			<CheckIcon v-else />
		</CheckboxIndicator>
	</Checkbox>
</template>
