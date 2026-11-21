<script setup lang="ts">
defineProps<{ id: string; title: string }>()
</script>

<template>
	<section :id="id" data-slot="page-section" class="flex scroll-mt-6 flex-col gap-4">
		<h2 :id="`${id}-heading`" class="text-xl font-semibold tracking-tight">{{ title }}</h2>
		<p v-if="$slots.description" class="max-w-prose text-sm text-muted-foreground">
			<slot name="description" />
		</p>
		<slot />
	</section>
</template>
