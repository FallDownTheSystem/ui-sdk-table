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
