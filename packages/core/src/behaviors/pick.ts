import type { CellBounds, GridCell, PrimitiveContext } from '@ui-sdk/core'
import { cellUnder, dragCells, edgesOf } from './drag'

/**
 * Cells that a person picks with the pointer while the table is in the pick
 * mode, as places in the grid like `cellRange`: from the cell where the
 * press started to the cell that the drag reaches. `columns` is true for a
 * pick that started on a letter of `columnLetters`: whole columns, over the
 * rows of the body.
 */
export type CellPick = {
	/** The cell where the press started. */
	anchor: GridCell
	/** The cell that the drag reaches, the same as `anchor` for one cell. */
	end: GridCell
	/** Whether the pick is whole columns. */
	columns: boolean
}

export type CellPicker<State> = {
	/** A press on a cell picks it, or its column with `columns`, and a drag picks more. */
	pointerdown(event: PointerEvent, cell: GridCell, columns: boolean): void
	/** `data-picked` and `data-pick-edge` of a cell. */
	cellAttrs(state: State, cell: GridCell): { 'data-picked'?: string; 'data-pick-edge'?: string }
	/** Keeps the element that hears a drag. */
	bindRoot(el: HTMLElement): () => void
}

/** The rows and columns of a pick, from the top and the start. */
export function pickBounds(pick: CellPick): CellBounds {
	return {
		top: Math.min(pick.anchor.row, pick.end.row),
		bottom: Math.max(pick.anchor.row, pick.end.row),
		left: Math.min(pick.anchor.col, pick.end.col),
		right: Math.max(pick.anchor.col, pick.end.col),
	}
}

const same = (a: CellPick | null, b: CellPick) =>
	!!a &&
	a.columns === b.columns &&
	a.anchor.row === b.anchor.row &&
	a.anchor.col === b.anchor.col &&
	a.end.row === b.end.row &&
	a.end.col === b.end.col

/**
 * The pick mode: a press or a drag on cells reports them and changes
 * nothing else. The press is prevented, so focus and the caret stay in the
 * field where a person types, and no range, active cell or editor moves.
 * The drag is bound to the root of the table, as the fill is.
 */
export function createCellPick<State extends object>(
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>,
	options: {
		/** The state key with the `CellPick`, or `null`. */
		key: keyof State & string
		/** The place of the cell that holds an element of the page. */
		placeOf: (el: Element) => GridCell | undefined
		/** The rows of the body and the columns that a pick can hold, or `undefined` when there is none. */
		limits: () => CellBounds | undefined
		/** The first column that a pick of whole columns can hold: the first column with a letter. */
		columnsFrom: () => number
		set: (pick: CellPick, details: { reason: 'item-press' | 'drag'; event?: Event }) => boolean
		/** Runs once when a drag that changed the pick ends. */
		commit: (pick: CellPick, details: { reason: 'drag'; event?: Event }) => void
	},
): CellPicker<State> {
	let root: HTMLElement | undefined
	let stop: (() => void) | undefined
	context.onDestroy(() => stop?.())

	return {
		pointerdown(event, cell, columns) {
			const limits = options.limits()
			if (!root || !limits || event.button !== 0) {
				event.preventDefault()
				return
			}
			stop?.()
			const left = columns ? Math.max(limits.left, options.columnsFrom()) : limits.left
			const place = (at: GridCell, top: boolean): GridCell => ({
				row: columns
					? top
						? limits.top
						: limits.bottom
					: Math.max(limits.top, Math.min(limits.bottom, at.row)),
				col: Math.max(left, Math.min(limits.right, at.col)),
			})
			const anchor = place(cell, true)
			let last: CellPick | null = null
			let steps = 0
			const pick = (end: GridCell, reason: 'item-press' | 'drag', from?: Event) => {
				const next = { anchor, end: place(end, false), columns }
				// A press reports also the cells that are picked already: a person picks them again.
				if (last && same(last, next)) return
				if (!options.set(next, { reason, event: from })) return
				last = next
				if (reason === 'drag') steps++
			}
			// The press itself is a pick. A drag that starts here picks more.
			stop = dragCells(root, event, {
				move: (x, y) => {
					// Over the letters, a pick of whole columns follows the pointer.
					const found =
						root && cellUnder(root, x, y, columns ? { ...limits, top: 0 } : limits, options.placeOf)
					if (found) pick(found, 'drag')
				},
				end: (up) => {
					stop = undefined
					if (steps && last) options.commit(last, { reason: 'drag', event: up })
				},
			})
			pick(cell, 'item-press', event)
		},
		cellAttrs(state, cell) {
			const pick = state[options.key] as CellPick | null
			const edges = pick ? edgesOf(pickBounds(pick), cell) : undefined
			return edges === undefined ? {} : { 'data-picked': '', 'data-pick-edge': edges || undefined }
		},
		bindRoot(el) {
			root = el
			return () => {
				if (root === el) root = undefined
			}
		},
	}
}
