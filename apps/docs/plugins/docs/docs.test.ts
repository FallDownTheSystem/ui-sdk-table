// @vitest-environment node
// The docs are files on disk, so the test reads them in node.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vite-plus/test'
import { PACKAGE_DOCS, packageFiles } from './files.ts'
import { renderPage } from './html.ts'
import { readDocs, slug } from './source.ts'

const docs = readDocs()
const files = packageFiles(docs)

describe('the docs of the package', () => {
	test('the files in packages/vue/docs are what the pages and examples give', () => {
		const folder = fileURLToPath(PACKAGE_DOCS)
		const written = Object.fromEntries(
			readdirSync(folder).map((file) => [file, readFileSync(`${folder}${file}`, 'utf8')]),
		)
		// Run `pnpm docs:write` when this fails.
		expect(written, 'packages/vue/docs is stale: run pnpm docs:write').toEqual(
			Object.fromEntries(files),
		)
	})

	test('a page shows the code of each example inline, with its file name and caption', () => {
		const page = files.get('first-table.md') ?? ''
		expect(page).not.toContain('<Example')
		expect(page).toContain('```vue title="people.vue"\n<script setup lang="ts">')
		expect(page).toContain('Press Score to sort by it.')
	})

	test('llms.txt holds the pages of Get started whole and lists every page', () => {
		const llms = files.get('llms.txt') ?? ''
		expect(llms).toContain('### Put a table on a page')
		for (const page of docs.pages) expect(llms).toContain(`- [${page.title}](./${page.id}.md): `)
	})
})

/** The links of the files that go to no page, or to no heading of a page. */
function brokenLinks(texts: Map<string, string>, headings: Map<string, Set<string>>): string[] {
	const broken: string[] = []
	for (const [file, text] of texts) {
		for (const [link, target = '', anchor] of text.matchAll(/\]\(\.\/([^)#]+)(?:#([^)]+))?\)/g)) {
			const page = target.replace(/\.md$/, '')
			if (!texts.has(target) || (anchor && !headings.get(page)?.has(anchor))) {
				broken.push(`${file}: ${link}`)
			}
		}
	}
	return broken
}

describe('the links of the docs', () => {
	const headings = new Map(
		docs.pages.map((page) => [
			page.id,
			new Set(
				[...page.source.matchAll(/^#{2,6} (.+)$/gm)].map(([, text = '']) =>
					slug(text.replaceAll('`', '')),
				),
			),
		]),
	)

	test('every link between pages goes to a page and a heading that exist', () => {
		expect(brokenLinks(files, headings)).toEqual([])
	})

	test('a link to a missing page or heading is found', () => {
		const texts = new Map([
			['a.md', '[B](./b.md) [Gone](./gone.md) [Head](./b.md#there) [Nowhere](./b.md#nowhere)'],
			['b.md', '## There'],
		])
		expect(brokenLinks(texts, new Map([['b', new Set(['there'])]]))).toEqual([
			'a.md: ](./gone.md)',
			'a.md: ](./b.md#nowhere)',
		])
	})
})

describe('the examples', () => {
	const allowed = /^(?:ui-sdk-table-vue(?:\/(?:export|formulas))?|@ui-sdk\/vue(?:\/[\w-]+)?|vue)$/

	for (const example of docs.pages.flatMap((page) => page.examples)) {
		test(`${example.name} imports only what an app has`, () => {
			const from = [...example.code.matchAll(/from '([^']+)'/g)].map(([, name = '']) => name)
			for (const name of from) expect(name, `${example.name} imports ${name}`).toMatch(allowed)
		})
	}

	test('a page as HTML holds its headings with ids and links that the site opens', async () => {
		const page = docs.pages.find((item) => item.id === 'first-table')
		if (!page) throw new Error('No page first-table.')
		const { segments, headings } = await renderPage(page)
		expect(headings.map((heading) => heading.id)).toContain('add-looks')
		const html = segments.map((segment) => ('html' in segment ? segment.html : '')).join('')
		expect(html).toContain('href="?page=installation"')
		expect(segments.filter((segment) => 'example' in segment)).toHaveLength(page.examples.length)
	})
})
