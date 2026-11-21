// Writes `registry/data-table.json`: the styled table as one registry item
// in the shadcn-vue format. An app installs it with `install-data-table.mjs`
// (or with `shadcn-vue add <address of the file>`) and owns the copy.
// `--check` writes nothing and fails when the file on disk is not what the
// source gives.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const defaultSource = join(root, 'src/data-table')

export const registryPath = join(root, 'registry/data-table.json')

/** The folder of the app that the files go to, under its components folder. */
const TARGET = 'components/DataTable'

/** What a shipped file may import besides its neighbours: the app has these. */
const APP_IMPORTS = ['@/lib/utils']

/**
 * A checkout on Windows gives CRLF line ends (`.gitattributes` has
 * `* text=auto`). The item holds LF only, so it is the same on every
 * computer and an app gets the same bytes from each of them.
 */
const lf = (text) => text.replace(/\r\n?/g, '\n')

/**
 * The version of a package in the `catalog` of `pnpm-workspace.yaml`, the
 * one place where this repository pins UI SDK. A test holds the
 * `peerDependencies` of the packages to the same values.
 */
export function catalogVersion(name) {
	const workspace = lf(readFileSync(join(root, '../../pnpm-workspace.yaml'), 'utf8'))
	const catalog = /^catalog:\n((?:[ \t]+.*\n|\n)*)/m.exec(workspace)?.[1] ?? ''
	for (const line of catalog.split('\n')) {
		const entry = /^\s+(['"]?)(.+?)\1:\s*(\S.*)$/.exec(line)
		if (entry?.[2] === name) return entry[3].trim()
	}
	throw new Error(`The catalog of pnpm-workspace.yaml has no version for "${name}".`)
}

/**
 * The packages that the files may import, and what the item asks an
 * installer to add for each. UI SDK is a beta, so the item names its exact
 * version. The table packages are not on npm: an installer that took their
 * names from a registry would fail, or fetch a package of another owner. The
 * app adds them from this repository itself, so the item names none for them.
 *
 * No shipped file imports `@ui-sdk/core`. The item names it all the same:
 * it is a peer of `@ui-sdk/vue` and of the table packages, a package
 * manager does not add a peer in every setup, and the two UI SDK packages
 * must be the same beta.
 */
const PACKAGES = {
	'ui-sdk-table-vue': null,
	'@ui-sdk/vue': `@ui-sdk/vue@${catalogVersion('@ui-sdk/vue')}`,
	'@ui-sdk/core': `@ui-sdk/core@${catalogVersion('@ui-sdk/core')}`,
	'@lucide/vue': '@lucide/vue',
}

/** Files of the source folder that are not source of the app. */
const NOT_SHIPPED = /\.test\.ts$/

/** The package of an import: `@ui-sdk/vue/menu` is of `@ui-sdk/vue`. */
function packageOf(specifier) {
	const parts = specifier.split('/')
	return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/** Every import of a file: `from '…'`, `import('…')` and `import '…'` for a side effect. */
export function importsOf(content) {
	const found = []
	const pattern = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g
	for (const match of content.matchAll(pattern)) found.push(match[1])
	return found
}

/**
 * Every file under the source folder, as a path with `/` from that folder.
 * A file that is neither shipped nor known stops the build: a part in a new
 * format (a `.css`, a `.json`) would otherwise be missing in the app without
 * a word.
 */
function sourceFiles(source, folder = '') {
	const names = []
	for (const entry of readdirSync(join(source, folder), { withFileTypes: true })) {
		const name = folder ? `${folder}/${entry.name}` : entry.name
		if (entry.isDirectory()) names.push(...sourceFiles(source, name))
		else if (NOT_SHIPPED.test(name)) continue
		else if (/\.(vue|ts)$/.test(name)) names.push(name)
		else {
			throw new Error(
				`src/data-table/${name} is not a .vue or .ts file, so the registry item cannot ship it. ` +
					'Ship files of those two kinds only, or add its kind to NOT_SHIPPED in build-registry.mjs.',
			)
		}
	}
	return names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * Fails for an import that would not resolve after the copy: a file outside
 * the folder, or a package that the item does not name.
 */
function checkImports(name, content, names) {
	for (const specifier of importsOf(content)) {
		if (specifier.startsWith('.')) {
			// From the folder of the file, so a part in a sub folder can import a neighbour above it.
			const file = posix.join(posix.dirname(name), specifier)
			const known = names.includes(file) || names.includes(`${file}.ts`)
			if (!known) {
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

/**
 * The text of the registry file, from the source files as they are now.
 * A test gives a folder of its own.
 */
export function buildRegistry(source = defaultSource) {
	const names = sourceFiles(source)
	const files = names.map((name) => {
		const content = lf(readFileSync(join(source, name), 'utf8'))
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

/** The text of the registry file on disk with LF line ends, or an empty text when there is none. */
export function readRegistry() {
	try {
		return lf(readFileSync(registryPath, 'utf8'))
	} catch {
		// A file that is not there is stale too.
		return ''
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const built = buildRegistry()
	if (process.argv.includes('--check')) {
		if (readRegistry() !== built) {
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
