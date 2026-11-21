import {
	byCellRange,
	cellsToText,
	createCellRange,
	textToCells,
	type CellBounds,
	type CellRange,
	type CellRangeReason,
	type GridCell,
	type GridFocus,
	type PrimitiveContext,
} from '@ui-sdk/core'

export { byCellRange, cellsToText, textToCells }
export type { CellBounds, CellRange, CellRangeReason }

export type TableRange<State> = {
	/** The rows and columns of the range, or of the active cell alone, or `null`. */
	bounds(state: State): CellBounds | null
	contains(state: State, cell: GridCell): boolean
	/** `aria-selected`, `data-selected` and `data-range-edge` of a cell. */
	cellAttrs(
		state: State,
		cell: GridCell,
	): { 'aria-selected': string; 'data-selected'?: string; 'data-range-edge'?: string }
	/** Selects a range, or `null` for no range. */
	select(range: CellRange | null, details?: { reason: CellRangeReason; event?: Event }): boolean
	/** Selects every cell of the body. The active cell stays where it is. */
	selectAll(details?: { reason: CellRangeReason; event?: Event }): boolean
	/** Selects whole rows, from one grid row to another. Rows outside the body are left out. */
	selectRows(
		from: number,
		to?: number,
		details?: { reason: CellRangeReason; event?: Event },
	): boolean
	/** Selects whole columns, from one to another, over the rows of the body. */
	selectColumns(
		from: number,
		to?: number,
		details?: { reason: CellRangeReason; event?: Event },
	): boolean
	bind(el: HTMLElement, cell: GridCell): () => void
	/**
	 * Handles a key on a cell. Shift with an arrow, Home or End grows the
	 * range, Shift+Space takes its rows, Control+Space its columns, Control+A
	 * every cell, and Escape drops the range. Every other key goes to the grid.
	 */
	keydown(event: KeyboardEvent): boolean
	/** Starts a range on a press, and paints it while the pointer drags. Shift stretches the range. */
	pointerdown(event: PointerEvent, cell: GridCell): void
}

/**
 * A range of cells. It wraps `createCellRange` of UI SDK, which is
 * experimental, and it is the only file that calls it.
 *
 * `createCellRange` takes every row of the grid into a range. In a table,
 * the header rows and the footer row are rows of the grid, and they hold no
 * data: a range with a header cell in it would copy a header as a value. So
 * a range lives in the rows of the body. A range that starts outside them is
 * refused, and a range that reaches outside them ends at their edge.
 */
export function createTableRange<State extends object>(
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>,
	options: {
		/** The state key with the `CellRange`, or `null`. */
		key: keyof State & string
		grid: GridFocus
		rows: () => number
		cols: () => number
		/** The first and the last grid row that a range can hold. `undefined` when there is none. */
		body: () => { first: number; last: number } | undefined
		set: (range: CellRange | null, details: { reason: CellRangeReason; event?: Event }) => boolean
		/** Runs once when a drag that changed the range ends. */
		commit?: (range: CellRange | null, details: { reason: 'drag'; event?: Event }) => void
		reveal?: (cell: GridCell) => void
		message?: (bounds: CellBounds) => string
	},
): TableRange<State> {
	/** The range inside the rows of the body, or `null` when the body has no rows. */
	function inBody(range: CellRange | null): CellRange | null {
		if (!range) return null
		const body = options.body()
		if (!body) return null
		const clamp = (cell: GridCell): GridCell => {
			const row = Math.max(body.first, Math.min(body.last, cell.row))
			return row === cell.row ? cell : { row, col: cell.col }
		}
		const anchor = clamp(range.anchor)
		const end = clamp(range.end)
		// One cell is not a range: the active cell says the same.
		if (end.row === anchor.row && end.col === anchor.col) return null
		return anchor === range.anchor && end === range.end ? range : { anchor, end }
	}

	/** Whether the active cell is in a row that a range can hold. */
	function onBody(cell: GridCell | null | undefined): boolean {
		const body = options.body()
		return !!cell && !!body && cell.row >= body.first && cell.row <= body.last
	}

	const current = () => context.store.get()[options.key] as CellRange | null
	const same = (a: CellRange | null, b: CellRange | null) =>
		a === b ||
		(!!a &&
			!!b &&
			a.anchor.row === b.anchor.row &&
			a.anchor.col === b.anchor.col &&
			a.end.row === b.end.row &&
			a.end.col === b.end.col)

	// The last range that was asked for. A caller that controls the range may
	// not have passed it back yet when a drag ends, so the end of a drag reads
	// this value and not the state.
	let asked: { range: CellRange | null } | undefined
	let steps = 0
	let stop: (() => void) | undefined

	const range = createCellRange(context, {
		key: options.key,
		grid: options.grid,
		rows: options.rows,
		cols: options.cols,
		reveal: options.reveal,
		message: options.message,
		set: (next, details) => {
			const kept = inBody(next)
			if (same(kept, asked ? asked.range : current())) return false
			const accepted = options.set(kept, details)
			if (accepted) {
				asked = { range: kept }
				steps++
			}
			return accepted
		},
	})

	// A table that goes away in the middle of a drag must not hear its end.
	context.onDestroy(() => stop?.())
	// The state is the truth again once it holds what was asked for, or anything else.
	context.onDestroy(
		context.store.subscribe(() => {
			if (!stop) asked = undefined
		}),
	)

	return {
		bounds: (state) => range.bounds(state),
		contains: (state, cell) => range.contains(state, cell),
		cellAttrs: (state, cell) => range.cellAttrs(state, cell),
		select: (next, details) => range.select(next, details),
		selectAll: (details) => range.selectAll(details),
		selectRows: (from, to, details) => range.selectRows(from, to, details),
		selectColumns: (from, to, details) => range.selectColumns(from, to, details),
		bind: (el, cell) => range.bind(el, cell),
		// From a header cell or the footer row, a range has no start. The keys move focus there.
		keydown: (event) =>
			onBody(options.grid.active()) ? range.keydown(event) : options.grid.keydown(event),
		pointerdown(event, cell) {
			stop?.()
			const before = current()
			asked = undefined
			range.pointerdown(event, cell)
			if (!options.commit || event.shiftKey) return
			const page = event.target instanceof Node ? event.target.ownerDocument : null
			if (!page) return
			// The press itself can drop a range. Only what comes after it is a drag.
			steps = 0
			const end = (up: Event) => {
				stop?.()
				const now = asked ? asked.range : current()
				asked = undefined
				if (steps > 0 && !same(now, before)) options.commit?.(now, { reason: 'drag', event: up })
			}
			stop = () => {
				stop = undefined
				page.removeEventListener('pointerup', end, true)
				page.removeEventListener('pointercancel', end, true)
			}
			page.addEventListener('pointerup', end, true)
			page.addEventListener('pointercancel', end, true)
		},
	}
}
