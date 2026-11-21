<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { isEmptyFilter } from 'ui-sdk-table-vue'
import { computed } from 'vue'
import { buttonClass } from './DataTableClasses'
import { useDataTable } from './types'

const { controller, view, messages } = useDataTable()

const search = computed(() => view.value?.filter.search?.trim() ?? '')
const filtered = computed(() =>
	Object.values(view.value?.filter.columns ?? {}).some((value) => !isEmptyFilter(value)),
)
</script>

<template>
	<div
		data-slot="data-table-empty"
		class="flex flex-col items-center gap-2 px-2 py-6 text-center text-muted-foreground"
	>
		<span v-if="search">{{ messages.noRowsForSearch({ search }) }}</span>
		<span v-else-if="filtered">{{ messages.noRowsForFilters() }}</span>
		<span v-else>{{ messages.noRows() }}</span>
		<Button
			v-if="search || filtered"
			:class="buttonClass('outline', 'sm')"
			@click="controller.clearFilters()"
		>
			{{ messages.clearFilters() }}
		</Button>
	</div>
</template>
