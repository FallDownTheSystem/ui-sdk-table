<script setup lang="ts">
import type { Component } from 'vue'
import DocsShell from './docs/DocsShell.vue'
import type { DocView } from 'virtual:docs'
import { currentPage, pages } from './page'

defineProps<{
	/** The component of the page in view, for the sink and the test pages. */
	page?: Component
	/** The page of the docs in view. */
	doc?: DocView
}>()

const kind = pages[currentPage]?.kind
const REPOSITORY = 'https://github.com/FallDownTheSystem/ui-sdk-table'
</script>

<template>
	<!-- The bar is the same on every page. The stylesheet of the page gives it its looks. -->
	<nav class="pages" aria-label="Site">
		<a class="brand" href="./">ui-sdk-table</a>
		<a href="./" :aria-current="kind === 'doc' ? 'page' : undefined">Docs</a>
		<a href="?page=sink" :aria-current="kind === 'sink' ? 'page' : undefined">Sink</a>
		<a class="repository" :href="REPOSITORY">GitHub</a>
	</nav>
	<DocsShell v-if="doc" :doc="doc" />
	<component :is="page" v-else-if="page" />
</template>
