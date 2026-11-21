import { uses } from 'virtual:sink-uses'
import { defineAsyncComponent, type Component } from 'vue'
import { tiles as columns } from './tiles/columns'
import { tiles as edit } from './tiles/edit'
import { tiles as filter } from './tiles/filter'
import { tiles as group } from './tiles/group'
import { tiles as more } from './tiles/more'
import { tiles as rows } from './tiles/rows'
import { tiles as server } from './tiles/server'
import { tiles as sheet } from './tiles/sheet'
import { tiles as sort } from './tiles/sort'
import { tiles as style } from './tiles/style'
import type { Tile, TileCopy } from './types'

/** The tiles by the file that holds them. The name of a group starts the id of each of its tiles. */
export const groups: Record<string, TileCopy[]> = {
	sort,
	filter,
	group,
	rows,
	columns,
	edit,
	sheet,
	server,
	more,
	style,
}

// A demo loads when its tile comes near the screen, so the page starts without the code of forty tables.
const demos = import.meta.glob<{ default: Component }>('./tiles/*/*.vue')

/** `sort-two-columns` of the group `sort` is `./tiles/sort/SortTwoColumns.vue`. */
export const fileOf = (groupName: string, id: string) =>
	`./tiles/${groupName}/${id.replace(/(?:^|-)(\w)/g, (_, letter: string) => letter.toUpperCase())}.vue`

export const demoFiles = Object.keys(demos)

/** A slot is written as in a template, `#group-total`; every other name as it is. */
export const labelOf = (name: string) => (name.startsWith('slot.') ? `#${name.slice(5)}` : name)

// One tile from each group in turn, so the tiles beside each other show different things.
function interleave<Item>(lists: Item[][]): Item[] {
	const out: Item[] = []
	for (let index = 0; lists.some((list) => index < list.length); index++) {
		for (const list of lists) {
			const item = list[index]
			if (item) out.push(item)
		}
	}
	return out
}

// The tiles that open the page, in this order.
const FEATURED = [
	'group-totals',
	'rows-window',
	'style-pixel',
	'edit-price',
	'style-brutal',
	'sort-two-columns',
	'style-swiss',
	'style-deco',
]

const rank = (id: string) => {
	const index = FEATURED.indexOf(id)
	return index === -1 ? FEATURED.length : index
}

const all = interleave(
	Object.entries(groups).map(([name, list]) => list.map((copy) => ({ ...copy, group: name }))),
).sort((a, b) => rank(a.id) - rank(b.id))

const counts = new Map<string, number>()
for (const { id } of all) {
	for (const name of uses[id] ?? []) counts.set(name, (counts.get(name) ?? 0) + 1)
}

/** How many tiles use each name of the library. */
export const useCounts: ReadonlyMap<string, number> = counts

// The rarest name first: a tile shows what sets it apart. A name that every
// tile has, such as `rows`, would filter nothing and is left out.
const tagsOf = (id: string) =>
	(uses[id] ?? [])
		.filter((name) => (counts.get(name) ?? 0) < all.length)
		.sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0) || a.localeCompare(b))

export const tiles: Tile[] = all.map((copy) => {
	const load = demos[fileOf(copy.group, copy.id)]
	return {
		...copy,
		size: copy.size ?? 's',
		tone: copy.tone ?? 'paper',
		uses: tagsOf(copy.id),
		// A tile without a file fails where it shows, and a test names it.
		demo: defineAsyncComponent(
			load ?? (() => Promise.reject(new Error(`No file ${fileOf(copy.group, copy.id)}.`))),
		),
	}
})
