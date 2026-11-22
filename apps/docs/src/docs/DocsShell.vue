<script setup lang="ts">
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/vue/collapsible'
import { groups, type DocView } from 'virtual:docs'
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { menu } from '../page'
import DocExample from './DocExample.vue'

const props = defineProps<{ doc: DocView }>()

const order = groups.flatMap((group) => group.pages)
const at = order.findIndex((page) => page.id === props.doc.id)
const previous = at > 0 ? order[at - 1] : undefined
const next = order[at + 1]

// On a narrow screen the sidebar is a menu that opens over the page. On a
// wide one it is always open, and the button is hidden.
const wide = matchMedia('(min-width: 900px)')
const open = shallowRef(wide.matches)
const follow = () => {
	open.value = wide.matches
}

onMounted(() => {
	wide.addEventListener('change', follow)
	// The page is rendered after the browser read the address, so the jump to a heading is ours.
	if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
})
onBeforeUnmount(() => wide.removeEventListener('change', follow))
</script>

<template>
	<div class="docs">
		<Collapsible v-model:open="open" class="sidebar">
			<CollapsibleTrigger class="menu-button">Menu</CollapsibleTrigger>
			<CollapsiblePanel>
				<nav aria-label="Docs">
					<div v-for="(group, index) in menu" :key="group.title" class="group">
						<p :id="`group-${index}`" class="group-title">{{ group.title }}</p>
						<ul :aria-labelledby="`group-${index}`">
							<li v-for="page in group.pages" :key="page.id">
								<a
									:href="`?page=${page.id}`"
									:aria-current="page.id === doc.id ? 'page' : undefined"
								>
									{{ page.title }}
								</a>
							</li>
						</ul>
					</div>
				</nav>
			</CollapsiblePanel>
		</Collapsible>

		<main class="doc">
			<template v-for="(segment, index) in doc.segments" :key="index">
				<!-- The HTML comes from the Markdown of the docs at build time; it holds no input of a reader. -->
				<!-- eslint-disable-next-line vue/no-v-html -->
				<div v-if="'html' in segment" class="prose" v-html="segment.html" />
				<DocExample v-else :example="segment.example" />
			</template>

			<nav class="pager" aria-label="Previous and next">
				<a v-if="previous" class="previous" :href="`?page=${previous.id}`" rel="prev">
					<span class="pager-hint">Previous</span>
					{{ previous.title }}
				</a>
				<a v-if="next" class="next" :href="`?page=${next.id}`" rel="next">
					<span class="pager-hint">Next</span>
					{{ next.title }}
				</a>
			</nav>
		</main>

		<aside class="toc" aria-labelledby="toc-title">
			<p id="toc-title" class="toc-title">On this page</p>
			<ul>
				<li v-for="heading in doc.headings" :key="heading.id" :data-level="heading.level">
					<a :href="`#${heading.id}`">{{ heading.text }}</a>
				</li>
			</ul>
			<a class="markdown" :href="`docs/${doc.id}.md`">Open as Markdown</a>
		</aside>
	</div>
</template>
