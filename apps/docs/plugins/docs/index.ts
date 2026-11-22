import type { Plugin } from 'vite'
import { packageFiles } from './files.ts'
import { renderPage } from './html.ts'
import { readDocs } from './source.ts'

const INDEX = 'virtual:docs'
const PAGE = 'virtual:docs-page/'

/**
 * The docs pages of the site. Markdown becomes HTML here, at build time, so
 * the browser carries no Markdown parser. `virtual:docs` lists the pages,
 * and `virtual:docs-page/<id>` is one page with its example components.
 * The site serves the files of `packages/vue/docs` at `docs/<file>`.
 */
export function docs(): Plugin {
	return {
		name: 'docs',
		resolveId(id) {
			if (id === INDEX || id.startsWith(PAGE)) return `\0${id}`
		},
		async load(id) {
			if (id === `\0${INDEX}`) {
				// Each page loads when it is asked for, with its examples.
				const groups = readDocs().groups.map((group) => {
					const pages = group.pages.map(({ id, title, description }) => {
						const fields = JSON.stringify({ id, title, description }).slice(1, -1)
						return `{ ${fields}, load: () => import(${JSON.stringify(PAGE + id)}) }`
					})
					return `{ title: ${JSON.stringify(group.title)}, pages: [${pages.join(', ')}] }`
				})
				return `export const groups = [\n${groups.join(',\n')}\n]\n`
			}
			if (!id.startsWith(`\0${PAGE}`)) return
			const read = readDocs()
			const pageId = id.slice(PAGE.length + 1)
			const page = read.pages.find((item) => item.id === pageId)
			if (!page) throw new Error(`No docs page "${pageId}".`)
			const { segments, headings } = await renderPage(page)
			const imports = page.examples.map(
				(example, index) => `import Example${index} from ${JSON.stringify(example.path)}`,
			)
			const parts = segments.map((segment) => {
				if ('html' in segment) return `{ html: ${JSON.stringify(segment.html)} }`
				const index = page.examples.findIndex((example) => example.name === segment.example)
				const example = page.examples[index]
				return `{ example: { name: ${JSON.stringify(segment.example)}, file: ${JSON.stringify(example?.file)}, caption: ${JSON.stringify(example?.caption)}, code: ${JSON.stringify(segment.code)}, component: Example${index} } }`
			})
			const meta = { id: page.id, title: page.title, description: page.description, headings }
			return `${imports.join('\n')}\nexport default { ...${JSON.stringify(meta)}, segments: [\n${parts.join(',\n')}\n] }\n`
		},
		configureServer(server) {
			server.middlewares.use((request, response, next) => {
				const file = /^\/docs\/([\w.-]+)$/.exec(request.url?.split(/[?#]/)[0] ?? '')?.[1]
				const text = file ? packageFiles(readDocs()).get(file) : undefined
				if (!file || text === undefined) return next()
				const type = file.endsWith('.md') ? 'text/markdown' : 'text/plain'
				response.setHeader('Content-Type', `${type}; charset=utf-8`)
				response.end(text)
			})
		},
		handleHotUpdate({ file, server }) {
			// The app root is watched, so a page or an example arrives here. It
			// changes the HTML and the code that the page modules hold.
			if (!/\/src\/docs\/(?:pages\/.*\.md|examples\/.*\.vue|nav\.ts)$/.test(file)) return
			for (const module of server.moduleGraph.idToModuleMap.values()) {
				if (module.id?.startsWith(`\0${PAGE}`) || module.id === `\0${INDEX}`) {
					server.moduleGraph.invalidateModule(module)
				}
			}
			server.ws.send({ type: 'full-reload' })
			return []
		},
		generateBundle() {
			for (const [file, text] of packageFiles(readDocs())) {
				this.emitFile({ type: 'asset', fileName: `docs/${file}`, source: text })
			}
		},
	}
}
