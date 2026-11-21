import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite-plus'
import { sinkUses } from './plugins/sink-uses'

export default defineConfig({
	plugins: [vue(), sinkUses(fileURLToPath(new URL('./src/sink/tiles', import.meta.url)))],
	test: {
		name: 'docs',
		environment: 'jsdom',
		include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
	},
})
