import { createApp } from 'vue'
import App from './App.vue'
import { currentPage, pages } from './page'

// The page and its stylesheet are there before the app mounts, so the first render shows it as it is.
const entry = pages[currentPage]
const [page] = await Promise.all([entry?.load(), entry?.styles()])

createApp(App, { page: page?.default }).mount('#app')
