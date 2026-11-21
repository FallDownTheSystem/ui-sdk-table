import type { Component } from 'vue'

const query = new URLSearchParams(location.search)

type Page = { title: string; load: () => Promise<{ default: Component }> }

// The demo app has no router: a page is one query parameter, so a browser
// test opens a page with one address. A page loads when it is asked for, so
// one page does not carry the code of another: the server page imports the
// file writers, and the styled page must show that it loads them on demand.
export const pages: Record<string, Page> = {
	benchmark: { title: 'Rows', load: () => import('./pages/BenchmarkPage.vue') },
	columns: { title: 'Columns', load: () => import('./pages/ColumnsPage.vue') },
	window: { title: 'Row window', load: () => import('./pages/WindowPage.vue') },
	editing: { title: 'Editing', load: () => import('./pages/EditingPage.vue') },
	server: { title: 'Server', load: () => import('./pages/ServerPage.vue') },
	styled: { title: 'Styled', load: () => import('./pages/StyledPage.vue') },
}

const requested = query.get('page') ?? 'benchmark'

/** The id of the page in view. An id that no page has gives the first page. */
export const currentPage = requested in pages ? requested : 'benchmark'

export const isStyledPage = currentPage === 'styled'

/** `?stress=1` adds the stress case to the styled page. */
export const isStress = query.get('stress') === '1'
