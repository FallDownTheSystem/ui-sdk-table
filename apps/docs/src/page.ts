import type { Component } from 'vue'

const query = new URLSearchParams(location.search)

type Page = { title: string; load: () => Promise<{ default: Component }> }

// The demo app has no router: a page is one query parameter, so a browser
// test opens a page with one address. A page loads when it is asked for, so
// one page does not carry the code of another: the server page imports the
// file writers, and no other page needs them.
export const pages: Record<string, Page> = {
	benchmark: { title: 'Rows', load: () => import('./pages/BenchmarkPage.vue') },
	columns: { title: 'Columns', load: () => import('./pages/ColumnsPage.vue') },
	groups: { title: 'Groups and filters', load: () => import('./pages/GroupsPage.vue') },
	window: { title: 'Row window', load: () => import('./pages/WindowPage.vue') },
	editing: { title: 'Editing', load: () => import('./pages/EditingPage.vue') },
	server: { title: 'Server', load: () => import('./pages/ServerPage.vue') },
}

const requested = query.get('page') ?? 'benchmark'

/** The id of the page in view. An id that no page has gives the first page. */
export const currentPage = requested in pages ? requested : 'benchmark'
