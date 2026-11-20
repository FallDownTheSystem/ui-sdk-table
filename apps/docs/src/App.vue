<script setup lang="ts">
import type { Component } from 'vue'
import BenchmarkPage from './pages/BenchmarkPage.vue'
import ColumnsPage from './pages/ColumnsPage.vue'
import WindowPage from './pages/WindowPage.vue'

// The demo app has no router: a page is one query parameter, so a browser
// test opens a page with one address.
const pages: Record<string, { title: string; component: Component }> = {
	benchmark: { title: 'Rows', component: BenchmarkPage },
	columns: { title: 'Columns', component: ColumnsPage },
	window: { title: 'Row window', component: WindowPage },
}

const requested = new URLSearchParams(location.search).get('page') ?? 'benchmark'
const current = pages[requested] ?? pages.benchmark
</script>

<template>
	<nav class="pages" aria-label="Demo pages">
		<a
			v-for="(page, id) in pages"
			:key="id"
			:href="`?page=${id}`"
			:aria-current="page === current ? 'page' : undefined"
		>
			{{ page.title }}
		</a>
	</nav>
	<component :is="current.component" v-if="current" />
</template>
