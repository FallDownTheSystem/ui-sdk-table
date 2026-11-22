import { bindDrag, createAutoScroll, type CellBounds, type GridCell } from '@ui-sdk/core'

// A drag over the cells of a table, bound to its root: with a row window,
// the cell where a drag started can leave the page, and a drag that is bound
// to an element that left would end there. `bindDrag` and
// `createAutoScroll` of UI SDK are used in this file only.

// How far from the pointer a cell of the body is looked for when the pointer
// is over a row that sticks to an edge of the frame, in pixels.
const PROBE_STEP = 8
const PROBE_REACH = 160

/** The cell of the body under a point. Over a row outside the limits, the nearest cell inside them. */
export function cellUnder(
	root: HTMLElement,
	x: number,
	y: number,
	limits: CellBounds,
	placeOf: (el: Element) => GridCell | undefined,
): GridCell | undefined {
	const read = (top: number) => {
		const el = root.ownerDocument.elementFromPoint(x, top)
		return el && root.contains(el) ? placeOf(el) : undefined
	}
	const found = read(y)
	if (!found) return undefined
	if (found.row >= limits.top && found.row <= limits.bottom) return found
	// A header or a footer that sticks covers the rows that scroll under it.
	// The pointer means the last row that is in view at that edge.
	const way = found.row < limits.top ? 1 : -1
	for (let off = PROBE_STEP; off <= PROBE_REACH; off += PROBE_STEP) {
		const near = read(y + way * off)
		if (near && near.row >= limits.top && near.row <= limits.bottom) return near
	}
	return undefined
}

/**
 * Follows a drag that starts with a press: `move` runs for each move of the
 * pointer and while the rows scroll under a pointer that rests near an edge,
 * and `end` once when the pointer lifts. Returns a function that stops the
 * drag without `end`. It prevents the press after the start, so the page
 * neither selects text nor moves focus: a drag does not start from a press
 * that is already prevented.
 */
export function dragCells(
	root: HTMLElement,
	event: PointerEvent,
	options: {
		move: (x: number, y: number) => void
		end: (up: Event | undefined, canceled: boolean) => void
		cancelOnEscape?: boolean
	},
): () => void {
	let last = { x: event.clientX, y: event.clientY }
	const scroll = createAutoScroll({ onScroll: () => options.move(last.x, last.y) })
	const release = bindDrag(root, event, {
		cancelOnEscape: options.cancelOnEscape,
		onMove: ({ x, y }) => {
			last = { x, y }
			scroll.update(x, y)
			options.move(x, y)
		},
		onEnd: (up, canceled) => {
			scroll.stop()
			options.end(up, canceled)
		},
	})
	event.preventDefault()
	return () => {
		scroll.stop()
		release()
	}
}

/** The edges of the bounds that a cell is on, as `data-*-edge` writes them, or `undefined` for a cell outside. */
export function edgesOf(bounds: CellBounds | null | undefined, cell: GridCell): string | undefined {
	if (
		!bounds ||
		cell.row < bounds.top ||
		cell.row > bounds.bottom ||
		cell.col < bounds.left ||
		cell.col > bounds.right
	) {
		return undefined
	}
	return [
		cell.row === bounds.top ? 'top' : '',
		cell.row === bounds.bottom ? 'bottom' : '',
		cell.col === bounds.left ? 'left' : '',
		cell.col === bounds.right ? 'right' : '',
	]
		.filter(Boolean)
		.join(' ')
}
