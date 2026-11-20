import { createReorder, type PrimitiveContext, type ReorderDraft } from '@ui-sdk/core'

export type { ReorderDraft }

export type ColumnReorderReason = 'drag' | 'move-key' | 'imperative'

export type ColumnReorderMessage = {
	type: 'grab' | 'move' | 'drop' | 'cancel'
	columnId: string
	label: string
	/** The position of the column among the columns that can move, from 1. */
	position: number
	total: number
}

export type ColumnReorder<State> = {
	/** Joins the header cell of a column. Return the result from the `bind` of the cell slot. */
	bind(el: HTMLElement, columnId: string): () => void
	/** The order to show: the order of the move while a column moves, else the track. */
	order(state: State): string[]
	/** Whether the column is picked up, by a pointer or by the keyboard. */
	moving(state: State, columnId: string): boolean
	/** Whether a pointer drags the column. */
	dragging(state: State, columnId: string): boolean
	/**
	 * Handles a key on a header cell. Space picks the column up. While it is
	 * up, the arrows, Home and End move it, Space or Enter drops it and Escape
	 * puts it back. Returns `true` when the key is used.
	 */
	keydown(event: KeyboardEvent, columnId: string): boolean
	pointerdown(event: PointerEvent, columnId: string): void
	/** Moves a column to a position in the track at once. Returns whether the move went through. */
	move(columnId: string, index: number): boolean
}

/**
 * Column order by drag and by keyboard. It wraps `createReorder` of UI SDK,
 * and it is the only file that calls it.
 *
 * `createReorder` moves the keys of one list, and every key in that list
 * takes part in a move. The columns of a table are not such a list: some are
 * hidden and some are pinned. So the table keeps a list of the columns that
 * can move, the track, and this behavior moves the keys of the track. The
 * header cells come and go as columns hide and pin; this behavior joins a
 * cell to the move only while its column is in the track.
 */
export function createColumnReorder<State extends object>(
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>,
	options: {
		/** The state key with the ids of the columns that can move, in display order. */
		track: keyof State & string
		/** The state key with the `ReorderDraft` of a move, or `null`. */
		draft: keyof State & string
		set: (track: string[], details: { reason: ColumnReorderReason; event?: Event }) => boolean
		disabled?: (columnId: string) => boolean
		label?: (columnId: string) => string | undefined
		message?: (message: ColumnReorderMessage) => string
	},
): ColumnReorder<State> {
	const track = (state: State) => state[options.track] as readonly string[]
	const draft = (state: State) => state[options.draft] as ReorderDraft | null

	const { message } = options
	const reorder = createReorder(context, {
		slot: 'cell',
		key: options.track,
		draft: options.draft,
		orientation: () => 'horizontal',
		set: options.set,
		disabled: options.disabled && ((item) => options.disabled?.(item.key) ?? false),
		label: options.label,
		message:
			message &&
			((event) =>
				message({
					type: event.type,
					columnId: event.key,
					label: event.label,
					position: event.position,
					total: event.total,
				})),
	})

	const cells = new Map<string, { el: HTMLElement; leave?: () => void }>()

	function join(columnId: string): void {
		const cell = cells.get(columnId)
		if (!cell) return
		const member = track(context.store.get()).includes(columnId)
		if (member && !cell.leave) cell.leave = reorder.bind(cell.el, { key: columnId, props: {} })
		else if (!member && cell.leave) {
			cell.leave()
			cell.leave = undefined
		}
	}

	context.onDestroy(
		context.store.subscribe((_liveOnly, _delivered, changed) => {
			if (changed.includes(options.track)) for (const columnId of cells.keys()) join(columnId)
		}),
	)

	const member = (columnId: string) => track(context.store.get()).includes(columnId)

	return {
		bind(el, columnId) {
			cells.get(columnId)?.leave?.()
			const cell = { el }
			cells.set(columnId, cell)
			join(columnId)
			return () => {
				const current = cells.get(columnId)
				if (current !== cell) return
				current.leave?.()
				cells.delete(columnId)
			}
		},
		order: (state) => draft(state)?.order ?? [...track(state)],
		moving: (state, columnId) => reorder.moving(state, columnId),
		dragging: (state, columnId) => reorder.dragging(state, columnId),
		keydown(event, columnId) {
			if (!member(columnId)) return false
			const up = draft(context.store.get())
			// Enter on a header sorts. So only Space picks a column up; once it is up,
			// every key belongs to the move.
			if (!up && event.key !== ' ') return false
			return reorder.keydown(event, columnId)
		},
		pointerdown(event, columnId) {
			if (member(columnId)) reorder.pointerdown(event, columnId)
		},
		move: (columnId, index) => member(columnId) && reorder.move(columnId, index),
	}
}
