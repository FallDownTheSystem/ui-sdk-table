import {
	createResize,
	isRTL,
	type PrimitiveContext,
	type ResizeBox,
	type ResizeDraft,
	type ResizeHandle,
} from '@ui-sdk/core'

export type { ResizeDraft }

export type ColumnResizeReason = 'drag' | 'resize-key' | 'imperative' | 'escape-key'

export type ColumnResizeDetails = {
	reason: ColumnResizeReason
	event?: Event
	/** The kind of pointer of a drag. A step of a drag has no event of its own. */
	source?: 'mouse' | 'touch' | 'pen'
}

type Drag = { before: unknown; source?: 'mouse' | 'touch' | 'pen' }

export type ColumnResize<State> = {
	/** Starts a drag of the resize handle of a column. `from` is the width the column has on the screen. */
	pointerdown(event: PointerEvent, columnId: string, handle: HTMLElement, from: number): void
	/** Handles an arrow key on the resize handle. Returns `true` when the key is used. */
	keydown(event: KeyboardEvent, columnId: string, handle: HTMLElement, from: number): boolean
	/** Changes a width by a number of pixels, as an arrow key does. Returns whether it changed. */
	resizeBy(columnId: string, delta: number, from: number, details: ColumnResizeDetails): boolean
	/** Whether a pointer drags the handle of the column. */
	dragging(state: State, columnId: string): boolean
	/** The attributes of a handle that do not depend on state: the cursor, and no touch scrolling. */
	handleAttrs(): { style: string }
}

/**
 * Column resize. It wraps `createResize` of UI SDK, which is experimental,
 * and it is the only file that calls it.
 *
 * `createResize` resizes boxes with a position and two sizes, by handles that
 * are named for compass points. A column has one size, and its handle is on
 * the side where the text ends. So a column is a box that has only a width,
 * and the handle is the east edge, or the west edge in right-to-left text.
 *
 * `createResize` keeps a drag in a draft and reports the new size once, on
 * release. A table reports each step of a drag as a change and the end as a
 * commit, like every other drag. So this behavior follows the draft: each new
 * draft is a step, the release is the commit, and a drag that ends without a
 * release (Escape) puts the widths back.
 */
export function createColumnResize<State extends object>(
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>,
	options: {
		/** The state key with the `ResizeDraft` of a drag, or `null`. List it in `live`. */
		draft: keyof State & string
		/** Asks for a new width and returns whether it went through. */
		set: (columnId: string, width: number, details: ColumnResizeDetails) => boolean
		/** Reports the end of an interaction. */
		commit: (details: ColumnResizeDetails) => void
		/** Something that `restore` can put back: the widths before an interaction. */
		snapshot: () => unknown
		restore: (snapshot: unknown, details: ColumnResizeDetails) => void
		min: (columnId: string) => number
		max: (columnId: string) => number | undefined
		step?: () => number
		largeStep?: () => number
		label?: (columnId: string) => string | undefined
		message?: (message: { columnId: string; label: string; width: number }) => string
	},
): ColumnResize<State> {
	// The column of the interaction that runs now, with the width it started from.
	let current: { columnId: string; from: number } | undefined
	// A press on a handle becomes a drag only when the pointer moves.
	let pressed: Drag | undefined
	let drag: Drag | undefined

	const toBox = (width: number): ResizeBox => ({ x: 0, y: 0, width, height: 1 })
	const { message } = options

	const resize = createResize(context, {
		boxes: () => (current ? { [current.columnId]: toBox(current.from) } : {}),
		draft: options.draft,
		set(value, details) {
			if (!current) return false
			const box = value[current.columnId]
			if (!box) return false
			const ended = drag
			drag = undefined
			const report = { ...details, source: ended?.source }
			// After a drag, the last step already holds this width. Then the change
			// says "same value", and the drag still ended well.
			const changed = options.set(current.columnId, box.width, report) || !!ended
			if (changed) options.commit(report)
			return changed
		},
		min: (columnId) => ({ width: options.min(columnId), height: 1 }),
		max: (columnId) => {
			const width = options.max(columnId)
			return width === undefined ? undefined : { width, height: 1 }
		},
		step: options.step,
		largeStep: options.largeStep,
		label: options.label,
		message: (event) => {
			const width = Math.round(event.box.width)
			return message
				? message({ columnId: event.key, label: event.label, width })
				: `${event.label}, ${width} pixels wide.`
		},
	})

	context.onDestroy(
		context.store.subscribe((_liveOnly, _delivered, changed) => {
			if (!changed.includes(options.draft) || !current) return
			const draft = context.store.get()[options.draft] as ResizeDraft | null
			if (draft) {
				drag ??= pressed ?? { before: options.snapshot() }
				options.set(draft.key, draft.box.width, { reason: 'drag', source: drag.source })
				return
			}
			const ended = drag
			if (!ended) return
			// On release, `createResize` clears the draft and then calls `set`. When
			// no `set` follows, the drag was canceled.
			queueMicrotask(() => {
				if (drag !== ended) return
				drag = undefined
				options.restore(ended.before, { reason: 'escape-key' })
			})
		}),
	)

	// The handle is on the side where the text ends, and the compass points are physical.
	const edge = (el: HTMLElement): ResizeHandle => (isRTL(el) ? 'w' : 'e')
	const pointerKind = (event: PointerEvent) =>
		event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse'

	return {
		pointerdown(event, columnId, handle, from) {
			current = { columnId, from }
			drag = undefined
			pressed = { before: options.snapshot(), source: pointerKind(event) }
			resize.pointerdown(event, columnId, edge(handle), handle)
		},
		keydown(event, columnId, handle, from) {
			current = { columnId, from }
			drag = undefined
			pressed = undefined
			return resize.keydown(event, columnId, edge(handle))
		},
		resizeBy(columnId, delta, from, details) {
			current = { columnId, from }
			drag = undefined
			pressed = undefined
			return resize.resizeBy(columnId, 'e', delta, 0, {
				reason: details.reason === 'escape-key' ? 'imperative' : details.reason,
				event: details.event,
			})
		},
		dragging: (state, columnId) => resize.dragging(state, columnId) !== undefined,
		handleAttrs: () => ({ style: resize.handleAttrs('e').style }),
	}
}
