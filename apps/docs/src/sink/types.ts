import type { Component } from 'vue'

/** How much of the grid a tile takes: one cell, two columns, two rows, or two by two. */
export type TileSize = 's' | 'wide' | 'tall' | 'large'

/** The ground of a tile. The table style reads `--tile-*` variables, so one style works on every tone. */
export type TileTone = 'paper' | 'mist' | 'ink' | 'moss' | 'clay' | 'plum' | 'sun'

/** What a group file says about one tile. The demo is the `.vue` file with the name of the id. */
export type TileCopy = {
	/** Unique, kebab-case, and it starts with the name of its group: `sort-two-columns` is `sort/SortTwoColumns.vue`. */
	id: string
	/** One to four words that end with a period: what a person does, not a feature. */
	title: string
	/** One short sentence that goes on after the title. */
	blurb: string
	size?: TileSize
	tone?: TileTone
}

export type Tile = TileCopy & {
	group: string
	size: TileSize
	tone: TileTone
	demo: Component
	/** The names of the library that the code of the tile uses, the rarest first. */
	uses: string[]
}
