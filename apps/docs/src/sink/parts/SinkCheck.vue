<script setup lang="ts">
import { Checkbox, CheckboxIndicator } from '@ui-sdk/vue/checkbox'
import SinkIcon from './SinkIcon.vue'

defineProps<{
	checked: boolean | 'indeterminate'
	/** The accessible name, for a box without a text beside it. */
	label?: string
	disabled?: boolean
}>()
const emit = defineEmits<{ change: [checked: boolean] }>()
</script>

<template>
	<Checkbox
		class="sink-check"
		:checked="checked"
		:aria-label="label"
		:disabled="disabled"
		@checked-change="(next) => emit('change', next === true)"
	>
		<CheckboxIndicator v-slot="{ state }" class="sink-check-mark">
			<SinkIcon :name="state.indeterminate ? 'minus' : 'check'" />
		</CheckboxIndicator>
	</Checkbox>
</template>
