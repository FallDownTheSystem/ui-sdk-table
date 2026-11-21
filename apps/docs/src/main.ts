import { createApp } from 'vue'
import App from './App.vue'
import { currentPage, isStyledPage, pages } from './page'

// The styled page has the stylesheet of the consumer app: Tailwind CSS and
// its tokens. Every other page has the plain stylesheet of this app. A page
// loads one of the two, so the base layer of Tailwind and the element rules
// of the plain stylesheet never meet.
const [page] = await Promise.all([
	pages[currentPage]?.load(),
	isStyledPage ? import('./styled.css') : import('./style.css'),
])

// The page is there before the app mounts, so the first render shows it.
createApp(App, { page: page?.default }).mount('#app')
