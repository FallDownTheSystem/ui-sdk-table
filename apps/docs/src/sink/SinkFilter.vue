<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { shallowRef, watch } from 'vue'
import SinkIcon from './parts/SinkIcon.vue'
import SinkSegment from './parts/SinkSegment.vue'
import { labelOf } from './registry'

const props = defineProps<{
	/** The chosen names. */
	names: readonly string[]
	/** How many tiles the filter leaves. */
	shown: number
}>()
const emit = defineEmits<{ remove: [name: string]; clear: [] }>()
const mode = defineModel<'any' | 'all'>('mode', { required: true })

const MODES = [
	{ value: 'any', label: 'Any' },
	{ value: 'all', label: 'All' },
] as const

// The bar keeps the last names while it slides away, so it does not collapse first.
const listed = shallowRef(props.names)
watch(
	() => props.names,
	(names) => {
		if (names.length) listed.value = names
	},
)
</script>

<template>
	<section
		class="filter"
		aria-label="Filter of the tiles"
		:data-open="names.length ? '' : undefined"
		:inert="!names.length"
	>
		<p class="filter-count" role="status">
			{{ names.length ? `${shown} ${shown === 1 ? 'tile' : 'tiles'}` : '' }}
		</p>
		<ul class="filter-names">
			<li v-for="name in listed" :key="name">
				<Button
					class="filter-name"
					:aria-label="`Remove ${labelOf(name)}`"
					@click="emit('remove', name)"
				>
					{{ labelOf(name) }}
					<SinkIcon name="x" />
				</Button>
			</li>
		</ul>
		<SinkSegment v-if="names.length > 1" v-model="mode" label="Match" :items="MODES" />
		<Button class="filter-clear" @click="emit('clear')">Clear</Button>
	</section>
</template>
