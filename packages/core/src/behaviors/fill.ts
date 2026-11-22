import {
	bindDrag,
	createAutoScroll,
	type CellBounds,
	type GridCell,
	type PrimitiveContext,
} from '@ui-sdk/core'

/** A fill that a drag paints: the cells that it starts from and the cells that it would fill. */
export type FillDraft = {
	/** The cells that the fill starts from, by their places in the grid. */
	source: CellBounds
	/** The cells that it would fill, by their places in the grid. */
	target: CellBounds
}

/** Where a fill can go: along the rows, along the columns, or both. */
export type FillDirection = 'both' | 'vertical' | 'horizontal'

export type FillHandle<State> = {
	/** A press on the handle starts a drag. */
	pointerdown(event: PointerEvent): void
	/** `data-fill-target` and `data-fill-edge` of a cell. */
	cellAttrs(
		state: State,
		cell: GridCell,
	): { 'data-fill-target'?: string; 'data-fill-edge'?: string }
	/** Whether the handle sits in this cell: the last row and the last column of the source. */
	holds(cell: GridCell): boolean
	/** Keeps the element that hears a drag. */
	bindRoot(el: HTMLElement): () => void
}

const same = (a: CellBounds | undefined, b: CellBounds | undefined) =>
	a === b ||
	(!!a &&
		!!b &&
		a.top === b.top &&
		a.bottom === b.bottom &&
		a.left === b.left &&
		a.right === b.right)

/**
 * The cells that a drag fills when the pointer is over a cell: from the
 * source to that cell, along one axis, the one that the pointer went further
 * on in cells. `undefined` when the cell is inside the source.
 */
export function fillTarget(
	source: CellBounds,
	cell: GridCell,
	limits: CellBounds,
	direction: FillDirection = 'both',
): CellBounds | undefined {
	const row = Math.max(limits.top, Math.min(limits.bottom, cell.row))
	const col = Math.max(limits.left, Math.min(limits.right, cell.col))
	const down = row - source.bottom
	const up = source.top - row
	const forward = col - source.right
	const back = source.left - col
	const rows = direction === 'horizontal' ? 0 : Math.max(down, up, 0)
	const cols = direction === 'vertical' ? 0 : Math.max(forward, back, 0)
	if (!rows && !cols) return undefined
	if (rows >= cols) {
		return down > 0
			? { top: source.bottom + 1, bottom: row, left: source.left, right: source.right }
			: { top: row, bottom: source.top - 1, left: source.left, right: source.right }
	}
	return forward > 0
		? { top: source.top, bottom: source.bottom, left: source.right + 1, right: col }
		: { top: source.top, bottom: source.bottom, left: col, right: source.left - 1 }
}

/**
 * For `selects` of a cell slot: a new draft of a fill wakes the cells of the
 * rows whose marks change, and no other cell. A cell listens by the number
 * of its row in the grid. A drag that grows by one row wakes that row and
 * the row that was the edge before, however many rows the draft holds.
 */
export const byFillDraft = {
	moved: (
		previous: FillDraft | null | undefined,
		next: FillDraft | null | undefined,
		notify: (name: string) => void,
	): void => {
		const before = previous?.target
		const after = next?.target
		if (!before || !after || before.left !== after.left || before.right !== after.right) {
			for (const target of [before, after]) {
				if (!target) continue
				for (let row = target.top; row <= target.bottom; row++) notify(String(row))
			}
			return
		}
		// The same columns: the rows that joined or left, and the rows at the edges, whose lines move.
		const tops = [before.top, after.top].toSorted((a, b) => a - b)
		const bottoms = [before.bottom, after.bottom].toSorted((a, b) => a - b)
		for (let row = tops[0] ?? 0; row <= (tops[1] ?? 0); row++) notify(String(row))
		for (let row = bottoms[0] ?? 0; row <= (bottoms[1] ?? 0); row++) notify(String(row))
	},
}

// How far from the pointer a cell of the body is looked for when the pointer
// is over a row that sticks to an edge of the frame, in pixels.
const PROBE_STEP = 8
const PROBE_REACH = 160

/**
 * The fill handle of a sheet: a drag from the corner of the selected cells
 * that paints the cells to fill, along one axis, and reports the fill once
 * when the pointer lifts. It knows no value: `commit` of the caller fills.
 *
 * The drag is bound to the root of the table and not to the handle. With a
 * row window, the cell of the handle leaves the page during a long drag, and
 * a drag that is bound to an element that left would end there. `bindDrag`
 * and `createAutoScroll` of UI SDK are used in this file only.
 */
export function createFillHandle<State extends object>(
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>,
	options: {
		/** The state key with the `FillDraft` of a drag, or `null`. */
		draft: keyof State & string
		/** The live state key that says whether a drag runs. */
		dragging: keyof State & string
		/** The cells that a fill starts from: the range, or the active cell. */
		source: () => CellBounds | undefined
		/** The place of the cell that holds an element of the page. */
		placeOf: (el: Element) => GridCell | undefined
		/** The rows and columns that a fill can reach. */
		limits: () => CellBounds | undefined
		direction: () => FillDirection
		/** Runs once when a drag ends on a target. */
		commit: (draft: FillDraft, details: { reason: 'drag'; event?: Event }) => void
	},
): FillHandle<State> {
	let root: HTMLElement | undefined
	let stop: (() => void) | undefined
	context.onDestroy(() => stop?.())

	const draftOf = (state: State) => state[options.draft] as FillDraft | null

	function setDraft(next: FillDraft | null): void {
		const current = draftOf(context.store.get())
		if (current === next || (current && next && same(current.target, next.target))) return
		context.store.set({ [options.draft]: next } as Partial<State>)
	}

	/** The cell of the body under a point. Over a row outside the limits, the nearest cell inside them. */
	function cellAt(x: number, y: number, limits: CellBounds): GridCell | undefined {
		const page = root?.ownerDocument
		if (!page || !root) return undefined
		const read = (top: number) => {
			const el = page.elementFromPoint(x, top)
			return el && root?.contains(el) ? options.placeOf(el) : undefined
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

	return {
		pointerdown(event) {
			const source = options.source()
			if (event.button !== 0 || !source || !root) return
			stop?.()
			let last = { x: event.clientX, y: event.clientY }
			const look = () => {
				const limits = options.limits()
				const cell = limits && cellAt(last.x, last.y, limits)
				// A pointer outside the rows keeps the cells that it painted last.
				if (!limits || !cell) return
				const target = fillTarget(source, cell, limits, options.direction())
				setDraft(target ? { source, target } : null)
			}
			// A pointer that rests near an edge sends no move, and the rows still go by under it.
			const scroll = createAutoScroll({ onScroll: look })
			const end = () => {
				scroll.stop()
				stop = undefined
				const draft = draftOf(context.store.get())
				context.store.set({
					[options.draft]: null,
					[options.dragging]: false,
				} as Partial<State>)
				return draft
			}
			context.store.set({ [options.dragging]: true } as Partial<State>)
			const release = bindDrag(root, event, {
				cancelOnEscape: true,
				onMove: ({ x, y }) => {
					last = { x, y }
					scroll.update(x, y)
					look()
				},
				onEnd: (up, canceled) => {
					const draft = end()
					if (draft && !canceled) options.commit(draft, { reason: 'drag', event: up })
				},
			})
			stop = () => {
				release()
				end()
			}
			// The page must not select text or move focus while the pointer drags.
			// After the start of the drag: a drag does not start from a press that
			// is already prevented.
			event.preventDefault()
		},
		cellAttrs(state, cell) {
			const target = draftOf(state)?.target
			if (
				!target ||
				cell.row < target.top ||
				cell.row > target.bottom ||
				cell.col < target.left ||
				cell.col > target.right
			) {
				return {}
			}
			const edges = [
				cell.row === target.top ? 'top' : '',
				cell.row === target.bottom ? 'bottom' : '',
				cell.col === target.left ? 'left' : '',
				cell.col === target.right ? 'right' : '',
			].filter(Boolean)
			return { 'data-fill-target': '', 'data-fill-edge': edges.join(' ') || undefined }
		},
		holds(cell) {
			const source = options.source()
			return !!source && cell.row === source.bottom && cell.col === source.right
		},
		bindRoot(el) {
			root = el
			return () => {
				if (root === el) root = undefined
			}
		},
	}
}
