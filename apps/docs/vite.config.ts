import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite-plus'

export default defineConfig({
	plugins: [vue(), tailwindcss()],
	resolve: {
		alias: {
			// The styled table imports `cn` from the address that the consumer app has.
			'@/lib/utils': fileURLToPath(
				new URL('../../packages/styled/src/lib/utils.ts', import.meta.url),
			),
		},
	},
})
