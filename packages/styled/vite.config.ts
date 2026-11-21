import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite-plus'

export default defineConfig({
	plugins: [vue()],
	resolve: {
		alias: {
			// The consumer app has `cn` at this address. Here it points at the copy of this package.
			'@/lib/utils': fileURLToPath(new URL('./src/lib/utils.ts', import.meta.url)),
		},
	},
	test: {
		name: 'styled',
		environment: 'jsdom',
		include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
		setupFiles: ['./src/tests/setup.ts'],
	},
})
