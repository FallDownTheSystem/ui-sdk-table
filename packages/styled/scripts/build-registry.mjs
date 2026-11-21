// Writes `registry/data-table.json`: the styled table as one registry item
// in the shadcn-vue format. An app installs it with `shadcn-vue add <address
// of the file>` and owns the copy. `--check` writes nothing and fails when
// the file on disk is not what the source gives.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'src/data-table')

export const registryPath = join(root, 'registry/data-table.json')

/** The folder of the app that the files go to, under its components folder. */
const TARGET = 'components/DataTable'

/** What a shipped file may import besides its neighbours: the app has these. */
const APP_IMPORTS = ['@/lib/utils']

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const peers = manifest.peerDependencies

/**
 * The packages that the files import, and what the item asks an installer
 * to add for each. UI SDK is a beta, so the item names its exact version.
 * The table packages are not on npm: an installer that took their names
 * from a registry would fail, or fetch a package of another owner. The app
 * adds them from this repository itself, so the item names none for them.
 */
const PACKAGES = {
	'ui-sdk-table-vue': null,
	'@ui-sdk/vue': `@ui-sdk/vue@${peers['@ui-sdk/vue']}`,
	'@ui-sdk/core': `@ui-sdk/core@${peers['@ui-sdk/core']}`,
	'@lucide/vue': '@lucide/vue',
}

/** The package of an import: `@ui-sdk/vue/menu` is of `@ui-sdk/vue`. */
function packageOf(specifier) {
	const parts = specifier.split('/')
	return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

function importsOf(content) {
	const found = []
	const pattern = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g
	for (const match of content.matchAll(pattern)) found.push(match[1])
	return found
}

/**
 * Fails for an import that would not resolve after the copy: a file outside
 * the folder, or a package that the item does not name.
 */
function checkImports(name, content, names) {
	for (const specifier of importsOf(content)) {
		if (specifier.startsWith('.')) {
			const file = specifier.replace(/^\.\//, '')
			const known = names.includes(file) || names.includes(`${file}.ts`)
			if (!known || specifier.startsWith('..')) {
				throw new Error(`${name} imports "${specifier}", which the registry item does not ship.`)
			}
		} else if (specifier === 'vue' || APP_IMPORTS.includes(specifier)) {
			continue
		} else if (!(packageOf(specifier) in PACKAGES)) {
			throw new Error(
				`${name} imports "${specifier}". Add its package to PACKAGES in build-registry.mjs, or remove the import.`,
			)
		}
	}
}

/** The text of the registry file, from the source files as they are now. */
export function buildRegistry() {
	const names = readdirSync(source)
		.filter((name) => /\.(vue|ts)$/.test(name) && !name.includes('.test.'))
		.sort()
	const files = names.map((name) => {
		const content = readFileSync(join(source, name), 'utf8')
		checkImports(name, content, names)
		return {
			path: `registry/data-table/${name}`,
			type: 'registry:component',
			content,
			target: `${TARGET}/${name}`,
		}
	})
	const item = {
		$schema: 'https://shadcn-vue.com/schema/registry-item.json',
		name: 'data-table',
		type: 'registry:component',
		title: 'Data table',
		description:
			'A styled data table on ui-sdk-table-vue, with UI SDK components for every control: search, column filters, column menu, export, selection and pages.',
		dependencies: Object.values(PACKAGES).filter((name) => name !== null),
		files,
	}
	return `${JSON.stringify(item, null, '\t')}\n`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const built = buildRegistry()
	if (process.argv.includes('--check')) {
		let current = ''
		try {
			current = readFileSync(registryPath, 'utf8')
		} catch {
			// A file that is not there is stale too.
		}
		if (current !== built) {
			console.error(
				'registry/data-table.json is stale. Run `pnpm --filter ui-sdk-table-styled build`.',
			)
			process.exit(1)
		}
	} else {
		writeFileSync(registryPath, built)
		console.log(`Wrote ${registryPath}`)
	}
}
