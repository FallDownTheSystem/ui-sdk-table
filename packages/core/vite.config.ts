import { defineConfig } from 'vite-plus'

export default defineConfig({
	test: {
		name: 'core',
		environment: 'jsdom',
		include: ['src/**/*.test.ts'],
	},
})
