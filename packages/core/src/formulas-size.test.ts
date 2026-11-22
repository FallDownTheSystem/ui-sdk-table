import { expect, test } from 'vite-plus/test'

// The glue of the formulas in the main entry stays under 12 kB: everything
// that runs only with an engine lives in the entry `ui-sdk-table-core/formulas`
// and comes in through the engine object. This builds the three entries as
// `docs/benchmarks.md` measures them ("Size of the build") and adds up the
// main entry and every chunk that it loads.

type Node = {
	execFileSync: (file: string, args: readonly string[], options: { cwd: string }) => unknown
	mkdtempSync: (prefix: string) => string
	existsSync: (path: string) => boolean
	readFileSync: (path: string, encoding: 'utf8') => string
	rmSync: (path: string, options: { recursive: true; force: true }) => void
	tmpdir: () => string
}

/**
 * The main entry and its chunks before the glue: the build before the fix of P2, in bytes,
 * 210 bytes of the number keyboard (`numberKeyboard`) and 1,008 bytes of the entry mode
 * (`entry`), which are no glue of the formulas.
 */
const BEFORE = 148_746
const LIMIT = 12_000

async function node(): Promise<Node> {
	// The core has no types of Node, so the modules are named at run time.
	const load = async (name: string): Promise<Record<string, unknown>> =>
		(await import(/* @vite-ignore */ `node:${name}`)) as Record<string, unknown>
	const [child, fs, os] = await Promise.all([load('child_process'), load('fs'), load('os')])
	return { ...child, ...fs, ...os } as unknown as Node
}

test('the main entry and its chunks grow by at most 12 kB over the build before the formulas', async () => {
	const { execFileSync, existsSync, mkdtempSync, readFileSync, rmSync, tmpdir } = await node()
	const out = mkdtempSync(`${tmpdir()}/formulas-size-`)
	try {
		// The tests run in the folder of the package, or in the root of the repository.
		const cwd = (globalThis as unknown as { process: { cwd(): string } }).process.cwd()
		const root = existsSync(`${cwd}/packages/core`) ? `${cwd}/packages/core/` : `${cwd}/`
		execFileSync(
			`${root}node_modules/.bin/vp`,
			[
				'pack',
				'src/index.ts',
				'src/export/index.ts',
				'src/formulas/index.ts',
				'--platform',
				'neutral',
				'--minify',
				'--out-dir',
				out,
			],
			{ cwd: root },
		)
		const seen = new Set<string>()
		const size = (file: string): number => {
			if (seen.has(file)) return 0
			seen.add(file)
			const text = readFileSync(`${out}/${file}`, 'utf8')
			let total = new TextEncoder().encode(text).length
			for (const match of text.matchAll(/from"\.\/([^"]+)"/g)) total += size(match[1] ?? '')
			return total
		}
		const main = size('index.js')
		expect(main - BEFORE).toBeLessThanOrEqual(LIMIT)
		// No text of the engine reaches the main entry.
		for (const file of seen) expect(readFileSync(`${out}/${file}`, 'utf8')).not.toMatch(/WEEKOF/)
	} finally {
		rmSync(out, { recursive: true, force: true })
	}
}, 60_000)
