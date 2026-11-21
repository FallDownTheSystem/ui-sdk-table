<script setup lang="ts">
// The colour of a status is a dot beside the text. The text keeps the text
// colour: the status tokens are fills, and most are too light for text.
defineProps<{ tone?: 'neutral' | 'success' | 'info' | 'warning' | 'destructive' }>()
</script>

<template>
	<span
		data-slot="badge"
		:data-tone="tone ?? 'neutral'"
		class="group/badge inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground"
	>
		<span
			aria-hidden="true"
			class="size-2 rounded-full bg-muted-foreground group-data-[tone=destructive]/badge:bg-destructive group-data-[tone=info]/badge:bg-info group-data-[tone=success]/badge:bg-success group-data-[tone=warning]/badge:bg-warning-ink"
		/>
		<slot />
	</span>
</template>
