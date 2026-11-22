import { defineConfig } from 'vite-plus'

export default defineConfig({
	fmt: {
		semi: false,
		singleQuote: true,
		useTabs: true,
		// Markdown is authored content. `docs/proof` is a frozen copy of the
		// feasibility proof and stays as it was verified. The release writes
		// its manifest in its own format.
		ignorePatterns: ['**/*.md', 'docs/proof/**', '.release-please-manifest.json'],
	},
	lint: {
		plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'vue', 'vitest'],
		env: {
			browser: true,
		},
		ignorePatterns: ['docs/proof/**'],
		categories: {
			correctness: 'error',
		},
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},
	test: {
		projects: ['packages/core', 'packages/vue', 'apps/docs'],
	},
})
