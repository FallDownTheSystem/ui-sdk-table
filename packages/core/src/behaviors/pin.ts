import type { PrimitiveContext } from '@ui-sdk/core'

export type PinSide = 'start' | 'end'

export type ColumnPins = {
	/** Joins the header cell of a column, so its width can be measured. Return the result from `bind`. */
	bind(el: HTMLElement, columnId: string): () => void
	/** Joins an element that holds cells: the head, the body or the foot. Return the result from `bind`. */
	bindGroup(group: HTMLElement): () => void
	/** The offset of a pinned column from its edge, as a CSS value, or `undefined` for a free column. */
	offset(columnId: string): string | undefined
	/** The width on the screen of each column whose header cell joined, by column id. */
	widths(): Map<string, number>
}

/**
 * Offsets for pinned columns. A pinned column sticks to an edge of the
 * scroller, after the pinned columns before it, so its offset is the sum of
 * their widths.
 *
 * A width in the state of the table is what the caller asks for. The width on
 * the screen can differ: the browser gives a column more room for its text,
 * or shares spare room between the columns. An offset from the asked widths
 * then leaves a gap or hides a column. So this behavior measures the header
 * cells and writes the offsets as CSS variables. A cell reads its variable,
 * with the asked widths as the value before the first measurement and on the
 * server. `--table-pin-start-size` and `--table-pin-end-size` hold the width
 * that the pinned columns cover at each edge, for the scroll margin of a cell.
 *
 * The variables go on the head, the body and the foot, not on the root: the
 * root has a `style` attribute of its own, and a renderer that writes that
 * attribute again removes every variable that is not in it.
 */
export function createColumnPins<State extends object>(
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>,
	options: {
		/** The visible pinned columns in display order. */
		pinned: () => readonly { id: string; side: PinSide }[]
		/** The width that the table asks for a column, when it has one. */
		width: (columnId: string) => number | undefined
	},
): ColumnPins {
	const cells = new Map<string, HTMLElement>()
	const measured = new Map<string, number>()
	const written = new Set<string>()
	const groups = new Set<HTMLElement>()

	const name = (side: PinSide, index: number) => `--table-pin-${side}-${index}`

	/** Each pinned column with its place on its side and the columns between it and its edge. */
	function places() {
		const pinned = options.pinned()
		const start = pinned.filter((column) => column.side === 'start')
		// The first column from the end edge is the last one in display order.
		const end = pinned.filter((column) => column.side === 'end').reverse()
		return [...start, ...end].map((column) => {
			const side = column.side === 'start' ? start : end
			const index = side.indexOf(column)
			return { ...column, index, before: side.slice(0, index).map((other) => other.id) }
		})
	}

	const sum = (ids: readonly string[], width: (id: string) => number | undefined) =>
		ids.reduce((total, id) => total + (width(id) ?? 0), 0)

	function write(): void {
		if (!groups.size) return
		const stale = new Set(written)
		const shown = (id: string) => measured.get(id) ?? options.width(id)
		const set = (property: string, size: number) => {
			for (const group of groups) group.style.setProperty(property, `${size}px`)
			written.add(property)
			stale.delete(property)
		}
		const all = places()
		for (const place of all) set(name(place.side, place.index), sum(place.before, shown))
		// How much of each edge the pinned columns cover. A cell that scrolls into
		// view must stop this far from the edge, or it stops under a pinned column.
		for (const side of ['start', 'end'] as const) {
			const ids = all.filter((place) => place.side === side).map((place) => place.id)
			set(`--table-pin-${side}-size`, sum(ids, shown))
		}
		for (const property of stale) {
			for (const group of groups) group.style.removeProperty(property)
			written.delete(property)
		}
	}

	const Observer = typeof ResizeObserver === 'undefined' ? undefined : ResizeObserver
	const observer =
		Observer &&
		new Observer((entries) => {
			for (const entry of entries) {
				for (const [columnId, el] of cells) {
					if (el === entry.target) measured.set(columnId, el.getBoundingClientRect().width)
				}
			}
			write()
		})

	context.onDestroy(() => observer?.disconnect())
	context.onDestroy(
		context.store.subscribe((liveOnly) => {
			if (!liveOnly) write()
		}),
	)

	return {
		bind(el, columnId) {
			cells.set(columnId, el)
			observer?.observe(el)
			return () => {
				observer?.unobserve(el)
				if (cells.get(columnId) !== el) return
				cells.delete(columnId)
				measured.delete(columnId)
			}
		},
		bindGroup(group) {
			groups.add(group)
			write()
			return () => {
				groups.delete(group)
				for (const property of written) group.style.removeProperty(property)
			}
		},
		offset(columnId) {
			const place = places().find((column) => column.id === columnId)
			if (!place) return undefined
			return `var(${name(place.side, place.index)}, ${sum(place.before, options.width)}px)`
		},
		widths() {
			const widths = new Map<string, number>()
			for (const [columnId, el] of cells) {
				const width = el.getBoundingClientRect().width
				if (width > 0) widths.set(columnId, width)
			}
			return widths
		},
	}
}
