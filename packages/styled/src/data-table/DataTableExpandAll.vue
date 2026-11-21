<script setup lang="ts">
import { ChevronsDownUpIcon, ChevronsUpDownIcon } from '@lucide/vue'
import { Button } from '@ui-sdk/vue/button'
import { computed } from 'vue'
import { buttonClass } from './DataTableClasses'
import { useDataTable } from './types'

const { controller, view, messages } = useDataTable()

const open = computed(() => (view.value?.expanded.length ?? 0) > 0)

function toggle() {
	if (open.value) controller.collapseAll()
	else controller.expandAll()
}
</script>

<template>
	<!-- `expandAll` opens groups and rows with child rows. A table that has neither has nothing for the button to do. -->
	<Button
		v-if="view?.hasExpandable"
		:aria-label="open ? messages.collapseAllRows() : messages.expandAllRows()"
		:aria-expanded="open"
		:class="buttonClass('ghost', 'icon-xs')"
		@click="toggle"
	>
		<ChevronsDownUpIcon v-if="open" aria-hidden="true" />
		<ChevronsUpDownIcon v-else aria-hidden="true" />
	</Button>
	<span v-else class="sr-only">{{ messages.expandColumn() }}</span>
</template>
