<script setup lang="ts">
import { ChevronDownIcon, ChevronRightIcon } from '@lucide/vue'

/** The mark of a button that opens a row or a group: it points down while the row is open. */
defineProps<{ expanded: boolean }>()
</script>

<template>
	<ChevronDownIcon v-if="expanded" aria-hidden="true" />
	<ChevronRightIcon v-else aria-hidden="true" class="rtl:rotate-180" />
</template>
