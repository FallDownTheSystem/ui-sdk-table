import type { PrimitiveContext } from '@ui-sdk/core'

export type StickyEdge = 'top' | 'bottom'

export type StickyRows = {
	/**
	 * Joins a row that can stick to an edge of the scroll frame, such as a
	 * header row. `edge` says whether it does now, so one row element can start
	 * and stop to stick. Return the result from the `bind` of the row slot.
	 */
	bind(el: HTMLElement, edge: () => StickyEdge | undefined): () => void
	/**
	 * Joins a row of the data by its key. The `keyed` option says which of
	 * these rows stick. A table can have many thousands of rows and a few that
	 * stick, so a row that joins this way costs one entry in a map.
	 */
	bindKeyed(el: HTMLElement, key: string): () => void
	/** Joins an element that holds cells, which gets the sizes of the sticky parts. Return the result from `bind`. */
	bindGroup(group: HTMLElement): () => void
	/**
	 * How much of the scroll frame the sticky rows cover at each edge, when
	 * they are at their edge. A header that is still below the top of the page
	 * counts the same: after a scroll to a far row it is at the edge, and the
	 * place of that row must be right in one step.
	 */
	cover(): { top: number; bottom: number }
	/** Works the offsets out again. Call it when an option changed whether a row sticks. */
	refresh(): void
}

/**
 * Offsets for rows that stick to the top or the bottom of the scroll frame:
 * header rows, pinned rows and the footer row.
 *
 * A cell sticks where its CSS says, and two rows that stick to the same edge
 * need different places: the second row starts where the first row ends. That
 * place is the sum of the heights of the rows before it, and a height is
 * known only on the screen. So this behavior measures the rows and writes
 * `--table-sticky-offset` on each row. It also writes the height that all
 * sticky rows cover at each edge, `--table-sticky-top-size` and
 * `--table-sticky-bottom-size`, on the elements that hold cells: a cell that
 * scrolls into view must stop that far from the edge.
 */
export function createStickyRows<State extends object>(
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>,
	options: {
		/** The rows joined by key that stick now, with their edge. Return the same array while it is the same. */
		keyed?: () => readonly { key: string; edge: StickyEdge }[]
	} = {},
): StickyRows {
	const fixed = new Map<HTMLElement, () => StickyEdge | undefined>()
	const byKey = new Map<string, HTMLElement>()
	/** The rows that stick now, with the height they have on the screen. */
	const active = new Map<HTMLElement, { edge: StickyEdge; size: number; offset?: string }>()
	const groups = new Set<HTMLElement>()
	let covered = { top: '', bottom: '' }
	let scheduled = false
	let destroyed = false

	const Observer = typeof ResizeObserver === 'undefined' ? undefined : ResizeObserver
	const observer =
		Observer &&
		new Observer((entries) => {
			for (const entry of entries) {
				const row = active.get(entry.target as HTMLElement)
				if (row) row.size = entry.target.getBoundingClientRect().height
			}
			layout()
		})

	function layout(): void {
		scheduled = false
		if (destroyed) return
		const now = new Map<HTMLElement, StickyEdge>()
		for (const [el, edge] of fixed) {
			const at = edge()
			if (at) now.set(el, at)
		}
		for (const { key, edge } of options.keyed?.() ?? []) {
			const el = byKey.get(key)
			if (el) now.set(el, edge)
		}
		// Deleting the entry that the loop is on is safe in a Map.
		for (const el of active.keys()) {
			if (now.has(el)) continue
			active.delete(el)
			observer?.unobserve(el)
			el.style.removeProperty('--table-sticky-offset')
		}
		for (const [el, edge] of now) {
			const row = active.get(el)
			if (row) row.edge = edge
			else {
				active.set(el, { edge, size: el.getBoundingClientRect().height })
				observer?.observe(el)
			}
		}

		const ordered = [...active.keys()].sort((a, b) =>
			a.compareDocumentPosition(b) & 4 /* DOCUMENT_POSITION_FOLLOWING */ ? -1 : 1,
		)
		const place = (el: HTMLElement, pixels: number) => {
			const row = active.get(el)
			const offset = `${pixels}px`
			if (!row || row.offset === offset) return
			row.offset = offset
			el.style.setProperty('--table-sticky-offset', offset)
		}
		let top = 0
		for (const el of ordered) {
			const row = active.get(el)
			if (row?.edge !== 'top') continue
			place(el, top)
			top += row.size
		}
		let bottom = 0
		for (const el of ordered.reverse()) {
			const row = active.get(el)
			if (row?.edge !== 'bottom') continue
			place(el, bottom)
			bottom += row.size
		}
		const next = { top: `${top}px`, bottom: `${bottom}px` }
		if (next.top === covered.top && next.bottom === covered.bottom) return
		covered = next
		for (const group of groups) write(group)
	}

	function write(group: HTMLElement): void {
		group.style.setProperty('--table-sticky-top-size', covered.top || '0px')
		group.style.setProperty('--table-sticky-bottom-size', covered.bottom || '0px')
	}

	/** Takes a row that leaves out of the sticky rows, and gives the others their new places. */
	function release(el: HTMLElement): void {
		if (!active.delete(el)) return
		observer?.unobserve(el)
		el.style.removeProperty('--table-sticky-offset')
		schedule()
	}

	// Rows join one after the other while a renderer builds the table. One pass after them is enough.
	function schedule(): void {
		if (scheduled || destroyed) return
		scheduled = true
		queueMicrotask(layout)
	}

	context.onDestroy(() => {
		destroyed = true
		observer?.disconnect()
	})
	// Whether a row sticks can follow the state, with no new element.
	context.onDestroy(
		context.store.subscribe((liveOnly) => {
			if (!liveOnly) schedule()
		}),
	)

	return {
		refresh: schedule,
		bind(el, edge) {
			fixed.set(el, edge)
			schedule()
			return () => {
				fixed.delete(el)
				release(el)
			}
		},
		bindKeyed(el, key) {
			byKey.set(key, el)
			if (options.keyed?.().some((row) => row.key === key)) schedule()
			return () => {
				if (byKey.get(key) === el) byKey.delete(key)
				release(el)
			}
		},
		bindGroup(group) {
			groups.add(group)
			write(group)
			return () => {
				groups.delete(group)
				group.style.removeProperty('--table-sticky-top-size')
				group.style.removeProperty('--table-sticky-bottom-size')
			}
		},
		cover() {
			let top = 0
			let bottom = 0
			for (const row of active.values()) {
				if (row.edge === 'top') top += row.size
				else bottom += row.size
			}
			return { top, bottom }
		},
	}
}
