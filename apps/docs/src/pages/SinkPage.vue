<script setup lang="ts">
import {
	computed,
	onBeforeUnmount,
	onBeforeUpdate,
	onMounted,
	onUpdated,
	shallowRef,
	useTemplateRef,
	watch,
} from 'vue'
// The licence of the fonts goes with the font files, as the SIL Open Font License asks.
import fontLicence from '../../node_modules/geist/LICENSE.txt?url'
import { pack, SPANS } from '../sink/pack'
import { tiles } from '../sink/registry'
import SinkFilter from '../sink/SinkFilter.vue'
import SinkTile from '../sink/SinkTile.vue'
import type { Tile, TileTone } from '../sink/types'

type Mode = 'any' | 'all'

const query = new URLSearchParams(location.search)
const list = (key: string) => query.get(key)?.split(',').filter(Boolean) ?? []

// `?only=sort` or `?only=sort-two-columns,edit-price` shows the tiles of a group or single tiles alone.
const only = list('only')
// `?eager` mounts every demo at once, to measure what the lazy tiles save.
const eager = query.has('eager')
// `?tone=plum` shows every tile on one tone, to judge a tone with every control. The contrast test reads each tone so.
const TONES: readonly TileTone[] = [
	'paper',
	'sand',
	'mist',
	'moss',
	'sun',
	'plum',
	'clay',
	'ink',
	'navy',
	'pine',
	'wine',
]
const tone = TONES.find((name) => name === query.get('tone'))
const selected = shallowRef(list('uses'))
const mode = shallowRef<Mode>(query.get('mode') === 'all' ? 'all' : 'any')

watch([selected, mode], () => {
	const next = new URLSearchParams(location.search)
	if (selected.value.length) next.set('uses', selected.value.join(','))
	else next.delete('uses')
	if (mode.value === 'all') next.set('mode', 'all')
	else next.delete('mode')
	// Commas stay readable in the address: a name of the library holds no character that needs a code.
	const search = next.toString().replaceAll('%2C', ',')
	history.replaceState(history.state, '', search ? `?${search}` : location.pathname)
})

const pool = (
	only.length ? tiles.filter((tile) => only.includes(tile.id) || only.includes(tile.group)) : tiles
).map((tile) => (tone ? { ...tile, tone } : tile))

const chosen = computed(() => new Set(selected.value))
const shown = computed(() => {
	const names = selected.value
	if (!names.length) return pool
	return pool.filter((tile) =>
		mode.value === 'all'
			? names.every((name) => tile.uses.includes(name))
			: tile.uses.some((name) => chosen.value.has(name)),
	)
})

function choose(tile: Tile, pressed: string[]) {
	const rest = selected.value.filter((name) => !tile.uses.includes(name))
	// A name keeps its place in the bar; a new one goes to the end.
	const kept = selected.value.filter((name) => rest.includes(name) || pressed.includes(name))
	selected.value = [...kept, ...pressed.filter((name) => !kept.includes(name))]
}

// The grid says how many columns fit, and the tiles get their places from `pack`.
const grid = useTemplateRef<HTMLElement>('grid')
const columns = shallowRef(0)
const measure = () => {
	if (!grid.value) return
	columns.value = getComputedStyle(grid.value).gridTemplateColumns.split(' ').length
}
let resizes: ResizeObserver | undefined
onMounted(() => {
	measure()
	if (!grid.value) return
	resizes = new ResizeObserver(measure)
	resizes.observe(grid.value)
})
onBeforeUnmount(() => resizes?.disconnect())

const placed = computed(() =>
	columns.value
		? pack(shown.value, (tile) => SPANS[tile.size], columns.value)
		: shown.value.map((tile) => ({ item: tile, place: undefined })),
)

// A new filter can move the tile that holds the focus to another place in
// the document, and a moved element loses the focus. It gets it back.
let focused: Element | null = null
onBeforeUpdate(() => {
	focused = grid.value?.contains(document.activeElement) ? document.activeElement : null
})
onUpdated(() => {
	if (focused instanceof HTMLElement && focused.isConnected && document.activeElement !== focused) {
		focused.focus({ preventScroll: true })
	}
})
</script>

<template>
	<div class="sink">
		<header class="sink-head">
			<h1>Table sink</h1>
			<p>
				{{ tiles.length }} small tables on the headless table of this library. Each one does one
				thing. Press a name under a tile to see every tile that uses it.
			</p>
		</header>
		<main ref="grid" class="bento">
			<SinkTile
				v-for="entry in placed"
				:key="entry.item.id"
				:tile="entry.item"
				:place="'row' in entry ? entry : undefined"
				:selected="chosen"
				:eager="eager"
				@choose="choose"
			/>
			<p v-if="!shown.length" class="bento-empty">
				No tile uses all of these names together. Remove one, or match any of them.
			</p>
		</main>
		<p class="sink-end">
			Set in Geist, Geist Mono and Geist Serif by Vercel, under the
			<a :href="fontLicence">SIL Open Font License</a>.
		</p>
		<SinkFilter
			v-model:mode="mode"
			:names="selected"
			:shown="shown.length"
			@remove="(name) => (selected = selected.filter((other) => other !== name))"
			@clear="selected = []"
		/>
	</div>
</template>
