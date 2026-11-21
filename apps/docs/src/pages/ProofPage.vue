<script setup lang="ts">
import { bindDrag, createAutoScroll } from '@ui-sdk/core'
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { createPeople, type Person } from '../benchmark/data'

// The page of a proof, and no demo: the menu does not list it. It shows that a
// pointer drag that is bound to the root of a table goes on while the row
// window takes the pressed row out of the page (`e2e/proofs.spec.ts`). The
// fill handle of a sheet will be built on what this page shows.

const ROW_HEIGHT = 36
const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name', width: 240 },
	{ id: 'team', header: 'Team', width: 140 },
	{ id: 'country', header: 'Country', width: 140 },
	{ id: 'score', header: 'Score', width: 120, format: 'decimal', aggregate: 'mean' },
]
const rows = createPeople(3000)
const frame = shallowRef<HTMLElement>()
const drag = shallowRef({ moves: 0, cell: '', pressedInPage: true, ended: '' })

let stop: (() => void) | undefined

onMounted(() => {
	const root = frame.value?.querySelector<HTMLElement>('[data-slot="table"]')
	if (!root) return
	/** The row and the column of the cell under a point, as ARIA counts them. */
	const cellAt = (x: number, y: number) => {
		const cell = document.elementFromPoint(x, y)?.closest('[data-slot="table-cell"]')
		const row = cell?.closest('tr')?.getAttribute('aria-rowindex')
		return cell && row ? `${row}:${cell.getAttribute('aria-colindex')}` : ''
	}
	const onPointerdown = (event: PointerEvent) => {
		const pressed = event.target instanceof Element ? event.target : undefined
		if (!event.altKey || !pressed) return
		// The table must not hear this press: it would make the row active, and
		// the row window keeps the active row in the page.
		event.stopPropagation()
		let last = { x: event.clientX, y: event.clientY }
		const look = () => {
			drag.value = {
				...drag.value,
				cell: cellAt(last.x, last.y),
				pressedInPage: pressed.isConnected,
			}
		}
		// A pointer that rests near an edge sends no move, and the rows still go by under it.
		const scroll = createAutoScroll({ onScroll: look })
		drag.value = { moves: 0, cell: cellAt(last.x, last.y), pressedInPage: true, ended: '' }
		bindDrag(root, event, {
			onMove: ({ x, y }) => {
				last = { x, y }
				drag.value = { ...drag.value, moves: drag.value.moves + 1 }
				scroll.update(x, y)
				look()
			},
			onEnd: (_event, canceled) => {
				scroll.stop()
				look()
				drag.value = { ...drag.value, ended: canceled ? 'canceled' : 'done' }
			},
		})
	}
	// Without this, the browser gives focus to the cell under the press, and the table follows focus.
	const onMousedown = (event: MouseEvent) => {
		if (event.altKey) event.preventDefault()
	}
	root.addEventListener('pointerdown', onPointerdown, true)
	root.addEventListener('mousedown', onMousedown, true)
	stop = () => {
		root.removeEventListener('pointerdown', onPointerdown, true)
		root.removeEventListener('mousedown', onMousedown, true)
	}
})
onBeforeUnmount(() => stop?.())
</script>

<template>
	<h1>Proofs</h1>
	<p>Hold Alt and drag from a cell to the lower edge of the frame.</p>
	<p>Drag: <output data-testid="drag">{{ JSON.stringify(drag) }}</output></p>
	<div ref="frame" class="scroller tall">
		<Table
			:rows="rows"
			:columns="columns"
			row-window
			:row-height="ROW_HEIGHT"
			sticky-header
			sticky-footer
			aria-label="People"
		/>
	</div>
</template>
