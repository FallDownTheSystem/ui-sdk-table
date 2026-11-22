import { groups, type DocView } from 'virtual:docs'
import type { Component } from 'vue'

const query = new URLSearchParams(location.search)

type Page = {
	title: string
	/** The stylesheet of the page. One page has one, so the looks of a page never reach another. */
	styles: () => Promise<unknown>
} & (
	| {
			/** A page of the docs, written in Markdown in `src/docs/pages`. */
			kind: 'doc'
			load: () => Promise<{ default: DocView }>
	  }
	| {
			/** The sink page, or a test page: a page that a browser test opens. The menu lists it under "Test pages". */
			kind: 'sink' | 'test'
			load: () => Promise<{ default: Component }>
			/** A page that a test opens by its address, and that the menu does not list. */
			hidden?: boolean
	  }
)

const plain = () => import('./style.css')
const docs = () => import('./docs.css')

// The docs app has no router: a page is one query parameter, so a browser
// test opens a page with one address. A page loads when it is asked for, so
// one page does not carry the code of another: the server page imports the
// file writers, and no other page needs them.
export const pages: Record<string, Page> = {
	...Object.fromEntries(
		groups.flatMap((group) =>
			group.pages.map((page): [string, Page] => [
				page.id,
				{ kind: 'doc', title: page.title, load: page.load, styles: docs },
			]),
		),
	),
	sink: {
		kind: 'sink',
		title: 'Sink',
		load: () => import('./pages/SinkPage.vue'),
		styles: () => import('./sink.css'),
	},
	benchmark: {
		kind: 'test',
		title: 'Rows',
		load: () => import('./pages/BenchmarkPage.vue'),
		styles: plain,
	},
	columns: {
		kind: 'test',
		title: 'Columns',
		load: () => import('./pages/ColumnsPage.vue'),
		styles: plain,
	},
	groups: {
		kind: 'test',
		title: 'Groups and filters',
		load: () => import('./pages/GroupsPage.vue'),
		styles: plain,
	},
	window: {
		kind: 'test',
		title: 'Row window',
		load: () => import('./pages/WindowPage.vue'),
		styles: plain,
	},
	editing: {
		kind: 'test',
		title: 'Editing',
		load: () => import('./pages/EditingPage.vue'),
		styles: plain,
	},
	sheet: {
		kind: 'test',
		title: 'Sheet',
		load: () => import('./pages/SheetPage.vue'),
		styles: plain,
	},
	formulas: {
		kind: 'test',
		title: 'Formulas',
		load: () => import('./pages/FormulasPage.vue'),
		styles: plain,
	},
	server: {
		kind: 'test',
		title: 'Server',
		load: () => import('./pages/ServerPage.vue'),
		styles: plain,
	},
	pick: {
		kind: 'test',
		title: 'Pick cells',
		load: () => import('./pages/PickPage.vue'),
		styles: plain,
		hidden: true,
	},
	proofs: {
		kind: 'test',
		title: 'Proofs',
		load: () => import('./pages/ProofPage.vue'),
		styles: plain,
		hidden: true,
	},
	'formula-proofs': {
		kind: 'test',
		title: 'Formula proofs',
		load: () => import('./pages/FormulaProofPage.vue'),
		styles: plain,
		hidden: true,
	},
}

// A page of the docs and a test page share one parameter, so an id of the
// docs that a test page has already would hide the page of the docs.
for (const id of groups.flatMap((group) => group.pages.map((page) => page.id))) {
	if (pages[id]?.kind !== 'doc') {
		throw new Error(
			`The docs page "${id}" has the id of a test page. Give it another id in nav.ts.`,
		)
	}
}

/** The first page of the docs, which `/` opens. */
export const HOME = groups[0]?.pages[0]?.id ?? 'sink'

const requested = query.get('page') ?? HOME

/** The id of the page in view. An id that no page has gives the first page of the docs. */
export const currentPage = requested in pages ? requested : HOME

/** The groups of the sidebar: the groups of the docs, then the test pages. */
export const menu: { title: string; pages: { id: string; title: string }[] }[] = [
	...groups.map((group) => ({
		title: group.title,
		pages: group.pages.map(({ id, title }) => ({ id, title })),
	})),
	{
		title: 'Test pages',
		pages: Object.entries(pages)
			.filter(([, page]) => page.kind === 'test' && !page.hidden)
			.map(([id, page]) => ({ id, title: page.title })),
	},
]
