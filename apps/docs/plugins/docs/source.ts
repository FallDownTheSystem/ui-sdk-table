import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { groups } from '../../src/docs/nav.ts'

/** The folder of the docs in the docs app: `pages/`, `examples/`, `nav.ts` and the heads of the generated files. */
export const DOCS_ROOT = fileURLToPath(new URL('../../src/docs', import.meta.url))

export type Example = {
	/** The path under `examples/` without `.vue`, such as `first-table/people`. */
	name: string
	/** The file name that the page shows, such as `people.vue`. */
	file: string
	/** The absolute path of the file. */
	path: string
	code: string
	/** What to try in the example. */
	caption: string
}

export type DocPage = {
	id: string
	title: string
	/** The first paragraph of the page: one sentence that says what the page is for. */
	description: string
	group: string
	/** The Markdown of the page as it is written, with its example markers. */
	source: string
	examples: Example[]
}

export type Docs = {
	pages: DocPage[]
	groups: { title: string; inline: boolean; pages: DocPage[] }[]
	/** The text above the pages in `llms.txt`. */
	llms: string
	/** The text above the list of the pages in the `README.md` of the package docs. */
	readme: string
}

/** A marker of an example stands on a line of its own. */
export const MARKER = /^<Example name="([^"]+)" caption="([^"]+)" \/>$/gm

/** The id of a heading, as the site gives it and a link with `#` names it. */
export const slug = (text: string) =>
	text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s-]/gu, '')
		.trim()
		.replace(/\s+/g, '-')

function readPage(root: string, id: string, group: string): DocPage {
	const path = join(root, 'pages', `${id}.md`)
	if (!existsSync(path))
		throw new Error(`The docs list the page "${id}", and pages/${id}.md is missing.`)
	const source = readFileSync(path, 'utf8')
	const head = /^# (.+)\n\n(.+)\n/.exec(source)
	if (!head?.[1] || !head[2]) {
		throw new Error(
			`pages/${id}.md starts with "# Title", an empty line and one sentence that says what the page is for.`,
		)
	}
	const examples = [...source.matchAll(MARKER)].map(([, name = '', caption = '']) => {
		const file = join(root, 'examples', `${name}.vue`)
		if (!existsSync(file)) {
			throw new Error(
				`pages/${id}.md names the example "${name}", and examples/${name}.vue is missing. The examples are: ${exampleNames(root).join(', ')}.`,
			)
		}
		return {
			name,
			file: `${name.split('/').at(-1)}.vue`,
			path: file,
			code: readFileSync(file, 'utf8').trim(),
			caption,
		}
	})
	return { id, title: head[1], description: head[2], group, source, examples }
}

/** Every example file, by name. */
export function exampleNames(root = DOCS_ROOT): string[] {
	const folder = join(root, 'examples')
	if (!existsSync(folder)) return []
	return readdirSync(folder, { recursive: true, encoding: 'utf8' })
		.filter((file) => file.endsWith('.vue'))
		.map((file) => file.replaceAll('\\', '/').replace(/\.vue$/, ''))
		.toSorted()
}

/** Reads every page of the docs with its examples, in the order of `nav.ts`. */
export function readDocs(root = DOCS_ROOT): Docs {
	const listed = groups.flatMap((group) => group.pages)
	const files = readdirSync(join(root, 'pages')).filter((file) => file.endsWith('.md'))
	for (const file of files) {
		const id = file.replace(/\.md$/, '')
		if (!listed.includes(id)) throw new Error(`pages/${file} is in no group of nav.ts.`)
	}
	const read = groups.map((group) => ({
		title: group.title,
		inline: group.inline ?? false,
		pages: group.pages.map((id) => readPage(root, id, group.title)),
	}))
	return {
		pages: read.flatMap((group) => group.pages),
		groups: read,
		llms: readFileSync(join(root, 'llms.md'), 'utf8').trim(),
		readme: readFileSync(join(root, 'readme.md'), 'utf8').trim(),
	}
}
