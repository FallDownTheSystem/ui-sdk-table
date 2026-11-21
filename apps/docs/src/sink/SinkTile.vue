<script setup lang="ts">
import { Toggle, ToggleGroup } from '@ui-sdk/vue/toggle'
import {
	computed,
	onBeforeUnmount,
	onErrorCaptured,
	onMounted,
	shallowRef,
	useTemplateRef,
} from 'vue'
import type { Placed } from './pack'
import { labelOf } from './registry'
import type { Tile } from './types'

const props = defineProps<{
	tile: Tile
	/** Where the tile stands in the grid. Without it, the grid places the tile itself. */
	place?: Placed<Tile>
	/** The names of the filter of the page. */
	selected: ReadonlySet<string>
	/** Mounts the demo at once, in view or not. */
	eager?: boolean
}>()
const emit = defineEmits<{
	/** The names of this tile that are pressed now. */
	choose: [tile: Tile, names: string[]]
}>()

const root = useTemplateRef<HTMLElement>('root')
// The demo mounts when the tile comes near the screen, and then stays.
const near = shallowRef(props.eager || typeof IntersectionObserver === 'undefined')
const failure = shallowRef<string>()
let observer: IntersectionObserver | undefined

onMounted(() => {
	if (near.value || !root.value) return
	observer = new IntersectionObserver(
		(entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return
			near.value = true
			observer?.disconnect()
		},
		{ rootMargin: '100% 0px' },
	)
	observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

// One broken demo shows its error in its own tile, and the page goes on.
onErrorCaptured((error) => {
	failure.value = error instanceof Error ? error.message : String(error)
	return false
})

const pressed = computed(() => props.tile.uses.filter((name) => props.selected.has(name)))

const placement = computed(() =>
	props.place
		? {
				'--tile-row': props.place.row,
				'--tile-column': props.place.column,
				'--tile-rows': props.place.rows,
				'--tile-columns': props.place.columns,
			}
		: undefined,
)
</script>

<template>
	<article
		:id="tile.id"
		ref="root"
		class="tile"
		:data-size="tile.size"
		:data-tone="tile.tone"
		:data-placed="place ? '' : undefined"
		:style="placement"
		:aria-labelledby="`${tile.id}-title`"
	>
		<header class="tile-head">
			<h2 :id="`${tile.id}-title`" class="tile-title">{{ tile.title }}</h2>
		</header>
		<div class="tile-stage">
			<p v-if="failure" class="tile-error" role="alert">{{ tile.id }} failed: {{ failure }}</p>
			<component :is="tile.demo" v-else-if="near" />
		</div>
		<footer class="tile-copy">
			<p class="tile-blurb">{{ tile.blurb }}</p>
			<ToggleGroup
				class="tile-uses"
				multiple
				:aria-label="`Names of the library in ${tile.title}`"
				:value="pressed"
				@value-change="(names) => emit('choose', tile, names)"
			>
				<Toggle v-for="name in tile.uses" :key="name" class="tile-use" :value="name">
					{{ labelOf(name) }}
				</Toggle>
			</ToggleGroup>
		</footer>
	</article>
</template>
