import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite-plus'
import { docs } from './plugins/docs/index.ts'
import { sinkUses } from './plugins/sink-uses'

export default defineConfig({
	plugins: [vue(), docs(), sinkUses(fileURLToPath(new URL('./src/sink/tiles', import.meta.url)))],
	test: {
		name: 'docs',
		environment: 'jsdom',
		include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
	},
})
