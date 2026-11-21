import { expect, test } from 'vite-plus/test'

// The formula engine is an entry of its own (`ui-sdk-table-core/formulas`),
// so a table without formulas does not carry it. That holds only while no
// file outside `src/formulas/` imports from that folder, not even a type.

declare global {
	interface ImportMeta {
		// The core sees no ambient types, so the one function of Vite that this test uses is named here.
		glob(
			pattern: string | string[],
			options: { query: '?raw'; import: 'default'; eager: true },
		): Record<string, string>
	}
}

// Every source file of the package as text, read by Vite when it loads the test.
const sources = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./formulas/**'], {
	query: '?raw',
	import: 'default',
	eager: true,
})

test('no file outside `src/formulas/` imports from it', () => {
	expect(Object.keys(sources).length).toBeGreaterThan(50)
	const breaches: string[] = []
	for (const [path, text] of Object.entries(sources)) {
		for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
			const spec = match[1] ?? ''
			if (/(^|\/)formulas(\/|$)/.test(spec)) breaches.push(`${path}: ${spec}`)
		}
	}
	expect(breaches).toEqual([])
})
