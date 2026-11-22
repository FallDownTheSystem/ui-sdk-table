// Writes `packages/vue/docs` from the pages and examples of the docs app:
// `node apps/docs/plugins/docs/write.ts`, or `pnpm docs:write`. A test fails
// while the files in git differ from what this writes.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PACKAGE_DOCS, packageFiles } from './files.ts'
import { readDocs } from './source.ts'

const folder = fileURLToPath(PACKAGE_DOCS)
const files = packageFiles(readDocs())
mkdirSync(folder, { recursive: true })
for (const file of readdirSync(folder)) {
	if (!files.has(file)) rmSync(new URL(file, PACKAGE_DOCS))
}
for (const [file, text] of files) writeFileSync(new URL(file, PACKAGE_DOCS), text)
console.log(`Wrote ${files.size} files to packages/vue/docs.`)
