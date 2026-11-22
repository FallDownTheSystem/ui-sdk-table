/// <reference types="vite/client" />

// vue-tsc reads `.vue` files itself. The type-aware lint does not, so it needs
// this declaration to resolve a `.vue` import.
declare module '*.vue' {
	import type { DefineComponent } from 'vue'

	const component: DefineComponent
	export default component
}

// The names of the library that each tile of the sink page uses, by tile id.
// `plugins/sink-uses.ts` reads them from the tile files.
declare module 'virtual:sink-uses' {
	export const uses: Readonly<Record<string, readonly string[]>>
}

// The docs pages, which `plugins/docs` renders from `src/docs` at build time.
declare module 'virtual:docs' {
	import type { Component } from 'vue'

	/** A page of the docs as the sidebar and Previous and Next name it. */
	export type DocLink = { id: string; title: string; description: string }

	export type DocExample = {
		name: string
		/** The file name, such as `people.vue`. */
		file: string
		/** What to try in the example. */
		caption: string
		/** The code of the file as highlighted HTML. */
		code: string
		component: Component
	}

	/** A page of the docs as `plugins/docs` renders it: HTML between its examples. */
	export type DocView = DocLink & {
		headings: readonly { level: number; id: string; text: string }[]
		segments: readonly ({ html: string } | { example: DocExample })[]
	}

	export const groups: readonly {
		title: string
		pages: readonly (DocLink & { load: () => Promise<{ default: DocView }> })[]
	}[]
}
