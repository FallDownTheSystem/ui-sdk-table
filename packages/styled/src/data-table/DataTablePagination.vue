<script setup lang="ts">
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
	EllipsisIcon,
} from '@lucide/vue'
import {
	Pagination,
	PaginationEllipsis,
	PaginationFirst,
	PaginationItem,
	PaginationLast,
	PaginationLink,
	PaginationList,
	PaginationNext,
	PaginationPrevious,
} from '@ui-sdk/vue/pagination'
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { buttonClass } from './DataTableClasses'
import DataTableSelect from './DataTableSelect.vue'
import { useDataTable } from './types'

const props = defineProps<{
	/** The page sizes that a person can choose. */
	pageSizes: readonly number[]
}>()

const { controller, view, messages, label } = useDataTable()

/** The sizes of the list, with the size of the table among them when it is another one. */
const sizes = computed(() => {
	const current = view.value?.pageSize
	const all = new Set(props.pageSizes)
	if (current !== undefined) all.add(current)
	return [...all]
		.sort((a, b) => a - b)
		.map((size) => ({ value: String(size), label: messages.value.pageSize({ size }) }))
})

const shown = computed(() => {
	const current = view.value
	const size = current?.pageSize
	if (!current || size === undefined) return undefined
	const from = (current.page - 1) * size + 1
	return { from, to: Math.min(current.page * size, current.rowCount), total: current.rowCount }
})

const step = buttonClass('outline', 'icon-sm')
const link = cn(
	buttonClass('outline', 'icon-sm'),
	'aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background aria-[current=page]:hover:bg-foreground/90 dark:aria-[current=page]:bg-foreground dark:aria-[current=page]:hover:bg-foreground/90',
)
</script>

<template>
	<div
		v-if="view && view.pageSize !== undefined && view.rowCount > 0"
		data-slot="data-table-pagination"
		class="flex flex-wrap items-center justify-between gap-3 text-sm"
	>
		<div class="flex flex-wrap items-center gap-3 text-muted-foreground">
			<span data-slot="data-table-page">
				{{
					view.lastPageKnown
						? messages.pageOf({ page: view.page, pageCount: view.pageCount })
						: messages.pageNumber({ page: view.page })
				}}
			</span>
			<DataTableSelect
				v-if="sizes.length > 1"
				class="h-8"
				:items="sizes"
				:value="String(view.pageSize)"
				:label="messages.pageSizeLabel({ table: label })"
				@change="(size) => controller.setPageSize(Number(size))"
			/>
			<span v-if="shown && view.lastPageKnown" data-slot="data-table-rows">
				{{ messages.showingRows(shown) }}
			</span>
			<span v-if="view.selected.length" data-slot="data-table-selected">
				{{ messages.selectedRows({ count: view.selected.length }) }}
			</span>
		</div>
		<Pagination
			:aria-label="messages.pagination({ table: label })"
			:page="view.page"
			:page-count="view.pageCount"
			@page-change="(page: number) => controller.setPage(page)"
		>
			<PaginationList v-slot="{ state }" class="flex items-center gap-1">
				<PaginationItem>
					<PaginationFirst :aria-label="messages.firstPage()" :class="step">
						<ChevronsLeftIcon aria-hidden="true" class="rtl:rotate-180" />
					</PaginationFirst>
				</PaginationItem>
				<PaginationItem>
					<PaginationPrevious :aria-label="messages.previousPage()" :class="step">
						<ChevronLeftIcon aria-hidden="true" class="rtl:rotate-180" />
					</PaginationPrevious>
				</PaginationItem>
				<PaginationItem v-for="item in state.items" :key="item" class="hidden sm:block">
					<PaginationLink
						v-if="typeof item === 'number'"
						:page="item"
						:aria-label="messages.pageNumber({ page: item })"
						:class="link"
					/>
					<PaginationEllipsis v-else class="flex size-8 items-center justify-center">
						<EllipsisIcon aria-hidden="true" class="size-4 text-muted-foreground" />
					</PaginationEllipsis>
				</PaginationItem>
				<PaginationItem>
					<PaginationNext :aria-label="messages.nextPage()" :class="step">
						<ChevronRightIcon aria-hidden="true" class="rtl:rotate-180" />
					</PaginationNext>
				</PaginationItem>
				<PaginationItem v-if="view.lastPageKnown">
					<PaginationLast :aria-label="messages.lastPage()" :class="step">
						<ChevronsRightIcon aria-hidden="true" class="rtl:rotate-180" />
					</PaginationLast>
				</PaginationItem>
			</PaginationList>
		</Pagination>
	</div>
</template>
