import type { Component } from 'vue'

const query = new URLSearchParams(location.search)

type Page = {
	title: string
	load: () => Promise<{ default: Component }>
	/** The stylesheet of the page. One page has one, so the looks of a page never reach another. */
	styles: () => Promise<unknown>
	/** A page that a test opens by its address, and that the menu does not list. */
	hidden?: boolean
}

const plain = () => import('./style.css')

// The demo app has no router: a page is one query parameter, so a browser
// test opens a page with one address. A page loads when it is asked for, so
// one page does not carry the code of another: the server page imports the
// file writers, and no other page needs them.
export const pages: Record<string, Page> = {
	sink: {
		title: 'Sink',
		load: () => import('./pages/SinkPage.vue'),
		styles: () => import('./sink.css'),
	},
	benchmark: { title: 'Rows', load: () => import('./pages/BenchmarkPage.vue'), styles: plain },
	columns: { title: 'Columns', load: () => import('./pages/ColumnsPage.vue'), styles: plain },
	groups: {
		title: 'Groups and filters',
		load: () => import('./pages/GroupsPage.vue'),
		styles: plain,
	},
	window: { title: 'Row window', load: () => import('./pages/WindowPage.vue'), styles: plain },
	editing: { title: 'Editing', load: () => import('./pages/EditingPage.vue'), styles: plain },
	sheet: { title: 'Sheet', load: () => import('./pages/SheetPage.vue'), styles: plain },
	formulas: { title: 'Formulas', load: () => import('./pages/FormulasPage.vue'), styles: plain },
	server: { title: 'Server', load: () => import('./pages/ServerPage.vue'), styles: plain },
	proofs: {
		title: 'Proofs',
		load: () => import('./pages/ProofPage.vue'),
		styles: plain,
		hidden: true,
	},
	'formula-proofs': {
		title: 'Formula proofs',
		load: () => import('./pages/FormulaProofPage.vue'),
		styles: plain,
		hidden: true,
	},
}

const requested = query.get('page') ?? 'sink'

/** The id of the page in view. An id that no page has gives the first page, the overview. */
export const currentPage = requested in pages ? requested : 'sink'
