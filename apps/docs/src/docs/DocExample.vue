<script setup lang="ts">
import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/vue/tabs'
import type { DocExample } from 'virtual:docs'

defineProps<{ example: DocExample }>()
</script>

<template>
	<figure class="example" :data-example="example.name">
		<Tabs default-value="preview">
			<div class="example-bar">
				<TabsList :aria-label="`Example ${example.file}`">
					<TabsTab value="preview">Preview</TabsTab>
					<TabsTab value="code">Code</TabsTab>
				</TabsList>
				<span class="example-file">{{ example.file }}</span>
			</div>
			<!-- The preview stays mounted, so a sort or a focus in it survives a look at the code. -->
			<TabsPanel value="preview" keep-mounted class="example-preview">
				<component :is="example.component" />
			</TabsPanel>
			<TabsPanel value="code" class="example-code">
				<!-- The highlighted code comes from the example file at build time. -->
				<!-- eslint-disable-next-line vue/no-v-html -->
				<div v-html="example.code" />
			</TabsPanel>
		</Tabs>
		<figcaption>{{ example.caption }}</figcaption>
	</figure>
</template>
