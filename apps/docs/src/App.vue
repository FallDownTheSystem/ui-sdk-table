<script setup lang="ts">
import type { Component } from 'vue'
import { currentPage, pages } from './page'

defineProps<{
	/** The component of the page in view. */
	page?: Component
}>()

const listed = Object.fromEntries(Object.entries(pages).filter(([, entry]) => !entry.hidden))
</script>

<template>
	<nav class="pages" aria-label="Demo pages">
		<a
			v-for="(entry, id) in listed"
			:key="id"
			:href="`?page=${id}`"
			:aria-current="id === currentPage ? 'page' : undefined"
		>
			{{ entry.title }}
		</a>
	</nav>
	<component :is="page" v-if="page" />
</template>
