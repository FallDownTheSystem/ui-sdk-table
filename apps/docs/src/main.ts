import { createApp } from 'vue'
import App from './App.vue'
import { currentPage, pages } from './page'
import './style.css'

// The page is there before the app mounts, so the first render shows it.
const page = await pages[currentPage]?.load()

createApp(App, { page: page?.default }).mount('#app')
