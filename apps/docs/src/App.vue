<script setup lang="ts">
import type { Component } from 'vue'
import { currentPage, isStyledPage, pages } from './page'

defineProps<{
	/** The component of the page in view. */
	page?: Component
}>()
</script>

<template>
	<!-- The plain pages style the list with `.pages`. The styled page has Tailwind CSS and no plain stylesheet. -->
	<nav
		class="pages"
		:class="
			isStyledPage &&
			'mx-auto flex max-w-7xl flex-wrap gap-4 px-6 pt-6 text-sm underline underline-offset-4'
		"
		aria-label="Demo pages"
	>
		<a
			v-for="(entry, id) in pages"
			:key="id"
			:href="`?page=${id}`"
			:aria-current="id === currentPage ? 'page' : undefined"
			:class="isStyledPage && 'aria-[current=page]:font-semibold'"
		>
			{{ entry.title }}
		</a>
	</nav>
	<main v-if="page" :class="isStyledPage && 'mx-auto max-w-7xl p-6'">
		<component :is="page" />
	</main>
</template>
