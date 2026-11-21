// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, test } from 'vite-plus/test'
import { buildRegistry, catalogVersion, importsOf, readRegistry } from './build-registry.mjs'

type RegistryFile = { path: string; type: string; content: string; target: string }
type RegistryItem = {
	$schema: string
	name: string
	type: string
	dependencies: string[]
	files: RegistryFile[]
}

const committed = () => readRegistry()

const folders: string[] = []
afterEach(() => {
	for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

/** A source folder of a test, with the given files. */
function sourceOf(files: Record<string, string>) {
	const folder = mkdtempSync(join(tmpdir(), 'data-table-source-'))
	folders.push(folder)
	for (const [name, content] of Object.entries(files)) {
		mkdirSync(dirname(join(folder, name)), { recursive: true })
		writeFileSync(join(folder, name), content)
	}
	return folder
}

const itemOf = (files: Record<string, string>) =>
	JSON.parse(buildRegistry(sourceOf(files))) as RegistryItem

test('the committed registry file is what the source gives', () => {
	// When this fails, run `pnpm --filter ui-sdk-table-styled build` and commit the file.
	expect(committed()).toBe(buildRegistry())
})

test('a checkout with CRLF line ends gives the same item as one with LF', () => {
	const part = '<script setup lang="ts">\nimport { rows } from \'./index\'\n</script>\n'
	const index = 'export const rows = 1\n'
	const windows = buildRegistry(
		sourceOf({
			'DataTable.vue': part.replaceAll('\n', '\r\n'),
			'index.ts': index.replaceAll('\n', '\r\n'),
		}),
	)
	expect(windows).toBe(buildRegistry(sourceOf({ 'DataTable.vue': part, 'index.ts': index })))
	expect(windows).not.toContain('\\r')
})

test('a file that the item cannot ship stops the build, and a test file is left out', () => {
	const index = 'export const rows = 1\n'
	expect(() => itemOf({ 'index.ts': index, 'DataTable.css': '.a{}\n' })).toThrow(
		'src/data-table/DataTable.css is not a .vue or .ts file, so the registry item cannot ship it.',
	)
	expect(() => itemOf({ 'index.ts': index, 'icons/sort.svg': '<svg/>\n' })).toThrow(
		'src/data-table/icons/sort.svg is not a .vue or .ts file',
	)
	const item = itemOf({ 'index.ts': index, 'index.test.ts': "import './index'\n" })
	expect(item.files.map((file) => file.target)).toEqual(['components/DataTable/index.ts'])
})

test('a file of a sub folder is shipped under the same path, and its imports are read from its folder', () => {
	const item = itemOf({
		'index.ts': 'export const rows = 1\n',
		'parts/DataTablePart.ts': "import { rows } from '../index'\nexport const part = rows\n",
	})
	expect(item.files.map((file) => file.target)).toEqual([
		'components/DataTable/index.ts',
		'components/DataTable/parts/DataTablePart.ts',
	])
	expect(() =>
		itemOf({
			'index.ts': 'export const rows = 1\n',
			'parts/DataTablePart.ts': "import { cn } from '../../lib/utils'\n",
		}),
	).toThrow(
		'parts/DataTablePart.ts imports "../../lib/utils", which the registry item does not ship.',
	)
	expect(() => itemOf({ 'index.ts': "import 'reka-ui'\n" })).toThrow(
		'index.ts imports "reka-ui". Add its package to PACKAGES',
	)
})

test('the UI SDK version of the item and of every package is the one of the catalog', () => {
	const item = JSON.parse(committed()) as RegistryItem
	const packages = join(dirname(fileURLToPath(import.meta.url)), '../..')
	const peers = (folder: string) =>
		(
			JSON.parse(readFileSync(join(packages, folder, 'package.json'), 'utf8')) as {
				peerDependencies?: Record<string, string>
			}
		).peerDependencies ?? {}
	const core = catalogVersion('@ui-sdk/core')
	const vue = catalogVersion('@ui-sdk/vue')
	expect(core).toMatch(/^\d+\.\d+\.\d+/)
	expect(item.dependencies).toContain(`@ui-sdk/core@${core}`)
	expect(item.dependencies).toContain(`@ui-sdk/vue@${vue}`)
	// The core package has no Vue, so it has no peer on `@ui-sdk/vue`.
	expect(peers('core')).toMatchObject({ '@ui-sdk/core': core })
	expect(peers('core')).not.toHaveProperty('@ui-sdk/vue')
	expect(peers('vue')).toMatchObject({ '@ui-sdk/core': core, '@ui-sdk/vue': vue })
	expect(peers('styled')).toMatchObject({ '@ui-sdk/core': core, '@ui-sdk/vue': vue })
	expect(() => catalogVersion('no-such-package')).toThrow(
		'The catalog of pnpm-workspace.yaml has no version for "no-such-package".',
	)
})

test('the registry item has the shadcn-vue format, and every file goes to components/DataTable', () => {
	const item = JSON.parse(committed()) as RegistryItem

	expect(item.$schema).toBe('https://shadcn-vue.com/schema/registry-item.json')
	expect(item.name).toBe('data-table')
	expect(item.type).toBe('registry:component')
	// `@ui-sdk/core` is the peer of `@ui-sdk/vue` and of the table packages; no shipped file imports it.
	expect(item.dependencies).toEqual([
		`@ui-sdk/vue@${catalogVersion('@ui-sdk/vue')}`,
		`@ui-sdk/core@${catalogVersion('@ui-sdk/core')}`,
		'@lucide/vue',
	])
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
	// The same list as the script has: a neighbour, the helper of the app, Vue, the table,
	// the two UI SDK packages and the icons.
	const allowed =
		/^(\.\.?\/[\w./-]+|@\/lib\/utils|vue|ui-sdk-table-vue(\/export)?|@ui-sdk\/(vue|core)(\/[\w-]+)?|@lucide\/vue)$/

	// `importsOf` reads an import for a side effect too: `import './x'`.
	expect(
		importsOf("import 'a'\nimport b from 'b'\nconst c = import('c')\nexport * from 'd'"),
	).toEqual(['a', 'b', 'c', 'd'])
	let seen = 0
	for (const file of item.files) {
		for (const specifier of importsOf(file.content)) {
			seen++
			expect(specifier, `${file.target} imports ${specifier}`).toMatch(allowed)
		}
	}
	expect(seen).toBeGreaterThan(item.files.length)
})
