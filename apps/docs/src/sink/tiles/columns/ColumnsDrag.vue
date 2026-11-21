<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef } from 'ui-sdk-table-vue'
import { animate } from 'motion'
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'
import { euro, orders, type Order } from '../../data'

// A few orders, so the table stands whole in its tile.
const rows = orders.slice(0, 4)

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer', width: 150 },
	{ id: 'city', header: 'City', width: 110 },
	{ id: 'status', header: 'Status', width: 90 },
	{ id: 'total', header: 'Total', width: 110, format: 'currency', formatOptions: euro },
	// The number of the order keeps its place at the end.
	{ id: 'id', header: 'Order', width: 70, reorderable: false },
]
const controller = createTableController()
const order = shallowRef<readonly string[]>([])

/*
 * The table moves the cells of a column to their new place at once, while a
 * header is dragged and on a move by a button. This page slides them there:
 * it keeps where each column stood, and when the cells move, it starts each
 * one at its old place and lets a spring take it home. The grabbed column
 * follows the pointer and is left alone.
 */
const frame = useTemplateRef<HTMLElement>('frame')
let places = new Map<string, number>()
let watcher: MutationObserver | undefined

const headers = () => [
	...(frame.value?.querySelectorAll<HTMLElement>('thead th[data-column]') ?? []),
]
const measure = () =>
	new Map(headers().map((th) => [th.dataset.column ?? '', th.offsetLeft] as const))

function slide() {
	const now = measure()
	if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
		for (const th of headers()) {
			const id = th.dataset.column ?? ''
			const before = places.get(id)
			const after = now.get(id)
			if (th.hasAttribute('data-grabbed') || before === undefined || after === undefined) continue
			if (before === after) continue
			const cells =
				frame.value?.querySelectorAll<HTMLElement>(`[data-column="${CSS.escape(id)}"]`) ?? []
			animate(
				[...cells],
				{ x: [before - after, 0] },
				{ type: 'spring', visualDuration: 0.22, bounce: 0.15 },
			)
		}
	}
	places = now
}

onMounted(() => {
	places = measure()
	watcher = new MutationObserver(slide)
	if (frame.value) watcher.observe(frame.value, { childList: true, subtree: true })
})
onBeforeUnmount(() => watcher?.disconnect())
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<Button @click="controller.moveColumn('total', 0)">Total first</Button>
			<Button :disabled="!order.length" @click="controller.resetColumnOrder()">Reset</Button>
			<p class="demo-note end" data-testid="column-order">
				{{ order.length ? order.join(', ') : 'The order of the definitions' }}
			</p>
		</div>
		<div ref="frame" class="sink-frame">
			<Table
				v-model:column-order="order"
				:rows="rows"
				:columns="columns"
				:controller="controller"
				reorderable
				sticky-header
				aria-label="Orders, with columns that move"
			/>
		</div>
	</div>
</template>
