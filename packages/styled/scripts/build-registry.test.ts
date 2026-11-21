// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, test } from 'vite-plus/test'
import { buildRegistry, registryPath } from './build-registry.mjs'

type RegistryFile = { path: string; type: string; content: string; target: string }
type RegistryItem = {
	$schema: string
	name: string
	type: string
	dependencies: string[]
	files: RegistryFile[]
}

const committed = () => readFileSync(registryPath, 'utf8')

test('the committed registry file is what the source gives', () => {
	// When this fails, run `pnpm --filter ui-sdk-table-styled build` and commit the file.
	expect(committed()).toBe(buildRegistry())
})

test('the registry item has the shadcn-vue format, and every file goes to components/DataTable', () => {
	const item = JSON.parse(committed()) as RegistryItem

	expect(item.$schema).toBe('https://shadcn-vue.com/schema/registry-item.json')
	expect(item.name).toBe('data-table')
	expect(item.type).toBe('registry:component')
	expect(item.dependencies).toEqual(
		expect.arrayContaining(['@lucide/vue', '@ui-sdk/vue@0.1.0-beta.13']),
	)
	// The table packages are not on npm. An installer must not look for their names there.
	expect(item.dependencies.filter((name) => name.startsWith('ui-sdk-table'))).toEqual([])
	const names = item.files.map((file) => file.target.replace('components/DataTable/', ''))
	expect(names).toEqual(
		expect.arrayContaining(['DataTable.vue', 'DataTableToolbar.vue', 'index.ts', 'messages.ts']),
	)
	for (const file of item.files) {
		expect(file.target.startsWith('components/DataTable/')).toBe(true)
		expect(file.type).toBe('registry:component')
		expect(file.content.length).toBeGreaterThan(0)
	}
	// The app registers every component by its file name, so each name starts with `DataTable`.
	for (const name of names.filter((name) => name.endsWith('.vue'))) {
		expect(name.startsWith('DataTable')).toBe(true)
	}
	// The app has `cn` itself, and a test is not source of the app.
	expect(names).not.toContain('utils.ts')
	expect(names.some((name) => name.includes('.test.'))).toBe(false)
})

test('a shipped file imports only its neighbours, the helper of the app and the named packages', () => {
	const item = JSON.parse(committed()) as RegistryItem
	const allowed =
		/^(\.\/[\w.-]+|@\/lib\/utils|vue|ui-sdk-table-vue(\/export)?|@ui-sdk\/vue\/[\w-]+|@lucide\/vue)$/

	for (const file of item.files) {
		const pattern = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g
		for (const match of file.content.matchAll(pattern)) {
			expect(match[1], `${file.target} imports ${match[1]}`).toMatch(allowed)
		}
	}
})
