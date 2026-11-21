// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, test } from 'vite-plus/test'
import { installDataTable, itemPath } from './install-data-table.mjs'

type RegistryItem = { files: { content: string; target: string }[] }

const script = join(dirname(fileURLToPath(import.meta.url)), 'install-data-table.mjs')
const item = JSON.parse(readFileSync(itemPath, 'utf8')) as RegistryItem

const folders: string[] = []
afterEach(() => {
	for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

/** The root of an app with an `src` folder, and nothing else. */
function app() {
	const root = mkdtempSync(join(tmpdir(), 'data-table-app-'))
	folders.push(root)
	mkdirSync(join(root, 'src'))
	return root
}

/** Runs the script as a person does, and gives its exit code and its output. */
function run(...args: string[]) {
	try {
		const output = execFileSync(process.execPath, [script, ...args], {
			encoding: 'utf8',
			stdio: 'pipe',
		})
		return { code: 0, output }
	} catch (error) {
		const failed = error as { status?: number; stdout?: string; stderr?: string }
		return { code: failed.status ?? -1, output: `${failed.stdout ?? ''}${failed.stderr ?? ''}` }
	}
}

test('the script writes every file of the item under src of the app, byte for byte', () => {
	const root = app()
	const result = installDataTable(root)

	expect(result.written).toHaveLength(item.files.length)
	expect(result.written).toContain(join('src/components/DataTable', 'DataTable.vue'))
	const changed = item.files
		.filter(
			(file) =>
				!readFileSync(join(root, 'src', file.target)).equals(Buffer.from(file.content, 'utf8')),
		)
		.map((file) => file.target)
	expect(changed).toEqual([])
	// A tab stays a tab: the files are not formatted on their way.
	expect(readFileSync(join(root, 'src/components/DataTable/index.ts'), 'utf8')).not.toMatch(
		/^ {4}/m,
	)
	// A second run has nothing to write.
	const again = installDataTable(root)
	expect([again.written.length, again.same.length]).toEqual([0, item.files.length])
})

test('--check writes nothing, and fails for a file that differs or is missing', () => {
	const root = app()
	const empty = run(root, '--check')
	expect(empty.code).toBe(1)
	expect(empty.output).toContain(`Missing: ${join('src/components/DataTable', 'DataTable.vue')}`)
	expect(existsSync(join(root, 'src/components'))).toBe(false)

	expect(run(root).code).toBe(0)
	const clean = run(root, '--check')
	expect(clean).toEqual({
		code: 0,
		output: `${item.files.length} files are the files of the item.\n`,
	})

	// What a formatter with four spaces does to a file.
	const edited = join(root, 'src/components/DataTable/messages.ts')
	const before = readFileSync(edited, 'utf8')
	writeFileSync(edited, before.replaceAll('\t', '    '))
	const stale = run(root, '--check')
	expect(stale.code).toBe(1)
	expect(stale.output).toContain(
		`Differs from the item: ${join('src/components/DataTable', 'messages.ts')}`,
	)
	expect(stale.output).toContain(`1 of ${item.files.length} files are not the files of the item.`)
	expect(readFileSync(edited, 'utf8')).not.toBe(before)

	// Without the option, the file is the file of the item again.
	expect(run(root).output).toContain(`Wrote 1 files, ${item.files.length - 1} were up to date.`)
	expect(readFileSync(edited, 'utf8')).toBe(before)
})

test('a file of the folder that the item does not ship is named, and is left alone', () => {
	const root = app()
	installDataTable(root)
	const old = join(root, 'src/components/DataTable/DataTableOld.vue')
	writeFileSync(old, '<template><div /></template>\n')

	const checked = run(root, '--check')
	expect(checked.code).toBe(0)
	expect(checked.output).toContain(
		`Not a file of the item: ${join('src/components/DataTable', 'DataTableOld.vue')}`,
	)
	expect(existsSync(old)).toBe(true)
})

test('a wrong call says how the script is called', () => {
	const usage = 'Usage: node install-data-table.mjs <app root> [--check]'
	expect(run()).toEqual({ code: 2, output: `One app root, not 0. ${usage}\n` })
	expect(run(app(), '--dry-run').output).toBe(`Unknown option "--dry-run". ${usage}\n`)

	const bare = mkdtempSync(join(tmpdir(), 'data-table-bare-'))
	folders.push(bare)
	const missing = run(bare)
	expect(missing.code).toBe(2)
	expect(missing.output).toContain('has no "src" folder, so it is not the root of an app.')
})

test('an item that names a place outside src is refused', () => {
	const root = app()
	const forged = join(root, 'item.json')
	writeFileSync(forged, JSON.stringify({ files: [{ target: '../outside.ts', content: 'x' }] }))
	expect(() => installDataTable(root, { item: forged })).toThrow(
		'The item names "../outside.ts", which is not a place under "src".',
	)
	expect(existsSync(join(root, 'outside.ts'))).toBe(false)
})
