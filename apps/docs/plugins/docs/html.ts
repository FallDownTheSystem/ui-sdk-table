import MarkdownIt from 'markdown-it'
import { createHighlighter, type Highlighter } from 'shiki'
import { MARKER, slug, type DocPage } from './source.ts'

const THEME = 'github-light'
const LANGS = ['vue', 'ts', 'js', 'bash', 'json', 'jsonc', 'yaml', 'css', 'html']

// Two colours of the theme hold less than 4.5 to 1 on white. They get a
// darker tone of themselves.
const DARKER = { '#e36209': '#b04a00', '#22863a': '#1a6e2e' }

let highlighter: Promise<Highlighter> | undefined

/** Code as the HTML of the site. A language that the highlighter does not load is plain text. */
export async function highlight(code: string, lang: string): Promise<string> {
	highlighter ??= createHighlighter({ themes: [THEME], langs: LANGS })
	const ready = await highlighter
	return ready.codeToHtml(code, {
		lang: LANGS.includes(lang) ? lang : 'text',
		theme: THEME,
		colorReplacements: DARKER,
	})
}

export type Heading = { level: number; id: string; text: string }

export type RenderedSegment = { html: string } | { example: string; code: string }

/** A link to another page of the docs, `./first-table.md#looks`, as an address of the site. */
export function siteHref(href: string): string {
	const page = /^(?:\.\/)?([\w-]+)\.md(#[\w-]*)?$/.exec(href)
	return page ? `?page=${page[1]}${page[2] ?? ''}` : href
}

function markdown(highlighted: Map<string, string>, headings: Heading[]) {
	const md = new MarkdownIt({ html: false, linkify: false, typographer: false })
	md.renderer.rules.fence = (tokens, index) => {
		const token = tokens[index]
		if (!token) return ''
		const title = /title="([^"]+)"/.exec(token.info)?.[1]
		const code = highlighted.get(`${token.info}\n${token.content}`) ?? ''
		const head = title ? `<div class="code-title">${md.utils.escapeHtml(title)}</div>` : ''
		const lang = md.utils.escapeHtml(token.info.split(/\s+/)[0] ?? '')
		return `<div class="code-block" data-lang="${lang}">${head}${code}</div>\n`
	}
	md.core.ruler.push('headings', (state) => {
		state.tokens.forEach((token, index) => {
			if (token.type !== 'heading_open' || token.tag === 'h1') return
			const text = state.tokens[index + 1]?.children?.map((child) => child.content).join('') ?? ''
			const id = slug(text)
			token.attrSet('id', id)
			headings.push({ level: Number(token.tag.slice(1)), id, text })
		})
	})
	md.core.ruler.push('links', (state) => {
		for (const token of state.tokens) {
			for (const child of token.children ?? []) {
				const href = child.type === 'link_open' ? child.attrGet('href') : null
				if (typeof href === 'string') child.attrSet('href', siteHref(href))
			}
		}
	})
	return md
}

/** The code of every fenced block of a text, highlighted, by its info line and its code. */
async function highlightFences(text: string): Promise<Map<string, string>> {
	const highlighted = new Map<string, string>()
	for (const token of new MarkdownIt().parse(text, {})) {
		if (token.type !== 'fence') continue
		const lang = token.info.split(/\s+/)[0] ?? ''
		highlighted.set(
			`${token.info}\n${token.content}`,
			await highlight(token.content.replace(/\n$/, ''), lang),
		)
	}
	return highlighted
}

/** A page as HTML, in parts between its examples, with the headings for "On this page". */
export async function renderPage(
	page: DocPage,
): Promise<{ segments: RenderedSegment[]; headings: Heading[] }> {
	const headings: Heading[] = []
	const md = markdown(await highlightFences(page.source), headings)
	const segments: RenderedSegment[] = []
	let from = 0
	for (const match of page.source.matchAll(MARKER)) {
		segments.push({ html: md.render(page.source.slice(from, match.index)) })
		const example = page.examples.find((item) => item.name === match[1])
		if (example)
			segments.push({ example: example.name, code: await highlight(example.code, 'vue') })
		from = match.index + match[0].length
	}
	segments.push({ html: md.render(page.source.slice(from)) })
	return { segments, headings }
}
