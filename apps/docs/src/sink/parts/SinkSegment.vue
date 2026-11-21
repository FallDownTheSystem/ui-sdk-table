<script setup lang="ts" generic="Value extends string">
import {
	SegmentedControl,
	SegmentedControlIndicator,
	SegmentedControlItem,
} from '@ui-sdk/vue/segmented-control'

defineProps<{
	/** The accessible name of the control. */
	label: string
	items: readonly { value: Value; label: string }[]
}>()
const value = defineModel<Value>({ required: true })
</script>

<template>
	<SegmentedControl
		class="sink-segment"
		:aria-label="label"
		:value="value"
		@value-change="(next) => next && (value = next as Value)"
	>
		<SegmentedControlIndicator class="sink-segment-thumb" />
		<SegmentedControlItem v-for="item in items" :key="item.value" :value="item.value">
			{{ item.label }}
		</SegmentedControlItem>
	</SegmentedControl>
</template>
