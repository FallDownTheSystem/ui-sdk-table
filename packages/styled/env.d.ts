// vue-tsc reads `.vue` files itself. The type-aware lint does not, so it needs
// this declaration to resolve a `.vue` import.
declare module '*.vue' {
	import type { DefineComponent } from 'vue'

	const component: DefineComponent
	export default component
}
