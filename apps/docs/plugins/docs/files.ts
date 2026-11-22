import { MARKER, type DocPage, type Docs } from './source.ts'

/** The folder of the package that ships the docs as Markdown. */
export const PACKAGE_DOCS = new URL('../../../../packages/vue/docs/', import.meta.url)

/** The line of `readme.md` that the list of the pages replaces. */
const PAGES = '<!-- pages -->'

/** A page as Markdown for a reader without the site: each example marker gives the code of the example and its caption. */
export function pageMarkdown(page: DocPage): string {
	const text = page.source.replace(MARKER, (_, name: string, caption: string) => {
		const example = page.examples.find((item) => item.name === name)
		if (!example)
			throw new Error(`pages/${page.id}.md names the example "${name}", which was not read.`)
		return `\`\`\`vue title="${example.file}"\n${example.code}\n\`\`\`\n\n${caption}`
	})
	return `${text.trim()}\n`
}

/** The headings of a page one level lower, so that the page stands under a heading of `llms.txt`. Code blocks keep their lines. */
function demote(markdown: string): string {
	let fence = false
	return markdown
		.split('\n')
		.map((line) => {
			if (line.startsWith('```')) fence = !fence
			return !fence && /^#{1,5} /.test(line) ? `#${line}` : line
		})
		.join('\n')
}

const listItem = (page: DocPage) => `- [${page.title}](./${page.id}.md): ${page.description}`

function list(docs: Docs, level: string): string {
	return docs.groups
		.map((group) => `${level} ${group.title}\n\n${group.pages.map(listItem).join('\n')}`)
		.join('\n\n')
}

/** Every file of `packages/vue/docs`, by file name. */
export function packageFiles(docs: Docs): Map<string, string> {
	const files = new Map<string, string>()
	for (const page of docs.pages) files.set(`${page.id}.md`, pageMarkdown(page))

	const inline = docs.groups
		.filter((group) => group.inline)
		.flatMap((group) => group.pages)
		.map((page) => demote(pageMarkdown(page)).trim())
	files.set(
		'llms.txt',
		[docs.llms, ...inline, `## Every page\n\n${list(docs, '###')}`].join('\n\n') + '\n',
	)
	if (!docs.readme.includes(PAGES))
		throw new Error(`readme.md holds the line ${PAGES} where the list of the pages goes.`)
	files.set('README.md', `${docs.readme.replace(PAGES, list(docs, '##'))}\n`)
	return files
}
