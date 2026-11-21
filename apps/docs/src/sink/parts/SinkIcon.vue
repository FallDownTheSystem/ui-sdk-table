<script setup lang="ts">
// Line icons of the page, drawn on a 16 by 16 grid. Each is decoration beside a text or inside a named control.
const PATHS = {
	chevron: 'M6 3.5 10.5 8 6 12.5',
	check: 'M3.5 8.5 6.5 11.5 12.5 4.5',
	minus: 'M4 8h8',
	x: 'M4 4l8 8M12 4l-8 8',
	up: 'M8 13V3M4 7l4-4 4 4',
	pin: 'M8 10v4M5 2.5h6l-1 4 2 3.5H4l2-3.5z',
	search: 'M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM14 14l-3.4-3.4',
	download: 'M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10',
	grip: 'M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01',
	folder: 'M2 4.5h4l1.5 1.5H14v6.5H2z',
	file: 'M4 2h5l3 3v9H4zM9 2v3h3',
	lock: 'M4.5 7.5h7v6h-7zM6 7.5V5a2 2 0 0 1 4 0v2.5',
} as const

defineProps<{ name: keyof typeof PATHS }>()
</script>

<template>
	<svg
		class="sink-icon"
		:data-icon="name"
		viewBox="0 0 16 16"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path :d="PATHS[name]" />
	</svg>
</template>
