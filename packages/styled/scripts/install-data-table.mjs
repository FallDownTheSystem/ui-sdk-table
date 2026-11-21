// Copies the styled table into an app: every file of `registry/data-table.json`
// goes to `src/<target>` of the app, byte for byte. The app owns the copy.
//
//   node install-data-table.mjs <app root>           writes the files
//   node install-data-table.mjs <app root> --check   writes nothing, and fails when a file differs
//
// The shadcn-vue CLI installs the same item, but formats each file again and
// may edit the stylesheet of the app. This script changes nothing but the
// files of the item, so `--check` in the app's own checks says when its copy
// is behind the item, or was edited.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const USAGE = 'Usage: node install-data-table.mjs <app root> [--check]'

/** The registry item that lies beside this script. */
export const itemPath = join(dirname(fileURLToPath(import.meta.url)), '../registry/data-table.json')

/**
 * Writes the files of the item under `src` of the app, or compares them with
 * `check`. Gives the path of every file from the app root by its state:
 * `written`, `same`, `different`, `missing`, and `unknown` for a file of the
 * target folder that the item does not ship (a part that a later item
 * dropped stays in an app that registers its components by file name).
 */
export function installDataTable(appRoot, { check = false, item = itemPath } = {}) {
	if (!appRoot) throw new Error(`No app root. ${USAGE}`)
	const source = join(resolve(appRoot), 'src')
	if (!existsSync(source) || !statSync(source).isDirectory()) {
		throw new Error(
			`"${resolve(appRoot)}" has no "src" folder, so it is not the root of an app. ${USAGE}`,
		)
	}
	const { files } = JSON.parse(readFileSync(item, 'utf8'))
	/** @type {Record<'written' | 'same' | 'different' | 'missing' | 'unknown', string[]>} */
	const result = { written: [], same: [], different: [], missing: [], unknown: [] }
	/** @type {Set<string>} */
	const folders = new Set()
	/** @type {Set<string>} */
	const shipped = new Set()

	for (const file of files) {
		const path = resolve(source, file.target)
		// A target is a path under `src`. An item that names a place outside it is not this item.
		if (!path.startsWith(source + sep)) {
			throw new Error(`The item names "${file.target}", which is not a place under "src".`)
		}
		const name = relative(resolve(appRoot), path)
		const wanted = Buffer.from(file.content, 'utf8')
		const current = existsSync(path) ? readFileSync(path) : undefined
		folders.add(dirname(path))
		shipped.add(path)

		if (current?.equals(wanted)) result.same.push(name)
		else if (check) result[current ? 'different' : 'missing'].push(name)
		else {
			mkdirSync(dirname(path), { recursive: true })
			writeFileSync(path, wanted)
			result.written.push(name)
		}
	}
	for (const folder of folders) {
		if (!existsSync(folder)) continue
		for (const entry of readdirSync(folder, { withFileTypes: true })) {
			const path = join(folder, entry.name)
			if (entry.isFile() && !shipped.has(path))
				result.unknown.push(relative(resolve(appRoot), path))
		}
	}
	return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const args = process.argv.slice(2)
	const check = args.includes('--check')
	const roots = args.filter((arg) => !arg.startsWith('--'))
	const options = args.filter((arg) => arg.startsWith('--') && arg !== '--check')
	try {
		if (options.length > 0) throw new Error(`Unknown option "${options[0]}". ${USAGE}`)
		if (roots.length !== 1) throw new Error(`One app root, not ${roots.length}. ${USAGE}`)
		const result = installDataTable(roots[0], { check })
		for (const name of result.unknown) {
			console.log(`Not a file of the item: ${name}`)
		}
		if (check) {
			for (const name of result.different) console.error(`Differs from the item: ${name}`)
			for (const name of result.missing) console.error(`Missing: ${name}`)
			const wrong = result.different.length + result.missing.length
			if (wrong > 0) {
				console.error(
					`${wrong} of ${wrong + result.same.length} files are not the files of the item. Run the script without --check to write them.`,
				)
				process.exit(1)
			}
			console.log(`${result.same.length} files are the files of the item.`)
		} else {
			console.log(`Wrote ${result.written.length} files, ${result.same.length} were up to date.`)
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : error)
		process.exit(2)
	}
}
