<script setup lang="ts">
import {
	Pagination,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationList,
	PaginationNext,
	PaginationPrevious,
} from '@ui-sdk/vue/pagination'
import SinkIcon from './SinkIcon.vue'

defineProps<{
	/** The accessible name of the navigation: which table it pages. */
	label: string
	page: number
	pageCount: number
}>()
const emit = defineEmits<{ change: [page: number] }>()
</script>

<template>
	<Pagination
		:aria-label="label"
		:page="page"
		:page-count="pageCount"
		:siblings="0"
		@page-change="(next) => emit('change', next)"
	>
		<PaginationList v-slot="{ state }">
			<PaginationItem>
				<PaginationPrevious aria-label="Previous page"
					><SinkIcon name="chevron"
				/></PaginationPrevious>
			</PaginationItem>
			<PaginationItem v-for="item in state.items" :key="item">
				<PaginationLink v-if="typeof item === 'number'" :page="item" />
				<PaginationEllipsis v-else />
			</PaginationItem>
			<PaginationItem>
				<PaginationNext aria-label="Next page"><SinkIcon name="chevron" /></PaginationNext>
			</PaginationItem>
		</PaginationList>
	</Pagination>
</template>
