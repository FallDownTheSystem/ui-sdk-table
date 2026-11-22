import { createApp } from 'vue'
import App from './App.vue'
import { currentPage, pages } from './page'

// The page and its stylesheet are there before the app mounts, so the first render shows it as it is.
async function props() {
	const entry = pages[currentPage]
	if (!entry) return {}
	const styles = entry.styles()
	if (entry.kind === 'doc') {
		const [page] = await Promise.all([entry.load(), styles])
		return { doc: page.default }
	}
	const [page] = await Promise.all([entry.load(), styles])
	return { page: page.default }
}

createApp(App, await props()).mount('#app')
