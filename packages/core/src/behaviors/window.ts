import type { PrimitiveContext } from '@ui-sdk/core'
import {
	fixedMetrics,
	measuredMetrics,
	rangeFor,
	windowSegments,
	type RowMetrics,
	type RowRange,
} from '../window/metrics'

export type RowAlign = 'start' | 'center' | 'end' | 'nearest'

/** The part of the rows that is rendered. Keep it in the state of the primitive. */
export type RowWindowState = RowRange & {
	/** Rows outside the range that stay rendered, such as the row that has focus. */
	keep: readonly number[]
}

export type RowWindowPart =
	| { kind: 'rows'; from: number; to: number }
	/** A spacer for the rows that are not rendered. `size` is their height in pixels. */
	| { kind: 'gap'; key: string; from: number; to: number; size: number }

export type RowWindow = {
	/**
	 * Joins the first spacer of the body: the place where the list of rows
	 * starts. Return the result from its `bind`.
	 */
	bindOrigin(el: HTMLElement): () => void
	/** Joins the element that holds the rows, to know which row has focus. Return the result from `bind`. */
	bindBody(el: HTMLElement): () => void
	/** Joins a row, so its height is measured. Return the result from the `bind` of the row slot. */
	bindRow(el: HTMLElement, id: string): () => void
	/** What the body renders, in order, or `undefined` when every row is rendered. */
	parts(): RowWindowPart[] | undefined
	/** Scrolls a row into the frame, in one step. Returns `false` for a row that is not in the list. */
	scrollTo(id: string, align?: RowAlign): boolean
	/** Reads the options again. Call it when an option of the window changed. */
	refresh(): void
}

/** The window before the page tells where the frame is: the first rows, as many as fill a frame of a usual size. */
export function firstRowWindow(rowHeight: number, overscan: number): RowWindowState {
	const end = Math.ceil(FIRST_FRAME / Math.max(1, rowHeight)) + Math.max(0, overscan)
	return { start: 0, end, keep: [] }
}

// The height of the frame before the page tells its real height, and on the server.
const FIRST_FRAME = 800

type Frame = {
	/** The edges of the frame in the list: distances from the top of the first row. */
	from: number
	to: number
	/** The same edges on the screen. */
	top: number
	bottom: number
}

/**
 * A row window for a real table: of many rows, only those near the scroll
 * frame are rendered, and a spacer row stands in for each run of rows that
 * is not.
 *
 * The scroll position belongs to the browser and to the person. This
 * behavior reads it, and writes it at two moments only, both outside a
 * render: when the caller asks for a row, and right after a row above the
 * frame turned out higher or lower than its estimate. In the second case
 * the content under that row moved, and the same number of pixels of scroll
 * puts it back before the browser paints. The browser has its own rule for
 * this (scroll anchoring), which not every browser has and which would count
 * the move a second time, so it is switched off on the scroll frame.
 *
 * Heights are kept by row id. A row that was never on the screen counts
 * with the estimate, so a jump to a far row lands near it, and the pixels
 * that the estimate was wrong by are corrected in the same frame.
 */
export function createRowWindow<State extends object>(
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>,
	options: {
		/** The state key with the `RowWindowState`. */
		key: keyof State & string
		enabled: () => boolean
		/** The rows in order. A new array means new rows. */
		rows: () => readonly { id: string }[]
		/** One height for every row, in pixels. Without it, rows are measured. */
		rowHeight: () => number | undefined
		/** The height of a row that was not measured yet. */
		estimate: () => number
		/** How many rows more than the frame shows are rendered on each side. */
		overscan: () => number
		/** The ids of rows that stay rendered wherever the frame is. */
		keep?: () => readonly string[]
		/** How much of the frame other things cover at its edges, such as a sticky header. */
		cover?: (frame: { top: number; bottom: number }) => { top: number; bottom: number }
	},
): RowWindow {
	const known = new Map<string, number>()
	const ids = new WeakMap<Element, string>()
	const elements = new Map<string, HTMLElement>()

	let origin: HTMLElement | undefined
	/** The element that scrolls the rows. `undefined` is the page itself. */
	let scroller: HTMLElement | undefined
	let frame: Frame = { from: 0, to: FIRST_FRAME, top: 0, bottom: FIRST_FRAME }
	let focused: string | undefined
	let sizes = 0
	/** A row that the caller asked for, until its place is certain. */
	let target: { id: string; align: RowAlign; sizes: number } | undefined
	let settle = 0
	let destroyed = false

	let kept:
		| { rows: readonly { id: string }[]; height?: number; estimate: number; metrics: RowMetrics }
		| undefined

	function metrics(): RowMetrics {
		const rows = options.rows()
		const height = options.rowHeight()
		const estimate = options.estimate()
		if (!kept || kept.rows !== rows || kept.height !== height || kept.estimate !== estimate) {
			// Heights of rows that are gone are of no use. The check is rare, so the map stays small.
			if (known.size > rows.length * 2 + 1000) {
				const present = new Set(rows.map((row) => row.id))
				for (const id of known.keys()) if (!present.has(id)) known.delete(id)
			}
			kept = {
				rows,
				height,
				estimate,
				metrics:
					height === undefined
						? measuredMetrics(rows, estimate, known)
						: fixedMetrics(rows, height),
			}
		}
		return kept.metrics
	}

	const current = () => context.store.get()[options.key] as RowWindowState

	/** Reads from the page where the frame is in the list. Returns `false` before the body is on the page. */
	function read(): boolean {
		if (!origin?.isConnected) return false
		const view = origin.ownerDocument.defaultView
		if (!view) return false
		const start = origin.getBoundingClientRect().top
		let top = 0
		let bottom = view.innerHeight
		if (scroller) {
			top = scroller.getBoundingClientRect().top + scroller.clientTop
			bottom = top + scroller.clientHeight
		}
		frame = { from: top - start, to: bottom - start, top, bottom }
		return true
	}

	// A table without a row window can render many thousands of rows, and none
	// of them needs a measurement. So rows are observed only while the window
	// measures them.
	let observing = false
	function watch(): void {
		const wanted = !destroyed && options.enabled() && options.rowHeight() === undefined
		if (wanted === observing) return
		observing = wanted
		if (!rowObserver) return
		if (wanted) for (const el of elements.values()) rowObserver.observe(el)
		else rowObserver.disconnect()
	}

	/** Works out the rows to render from the frame, and writes them to the state when they changed. */
	function update(): void {
		watch()
		if (destroyed || !options.enabled()) return
		const measured = metrics()
		const range = rangeFor(measured, frame.from, frame.to, Math.max(0, options.overscan()))
		const wanted = [...(options.keep?.() ?? []), ...(focused === undefined ? [] : [focused])]
		const keep = [...new Set(wanted.map((id) => measured.indexOf(id)))]
			.filter((index) => index >= 0 && (index < range.start || index >= range.end))
			.sort((a, b) => a - b)
		const now = current()
		const same =
			now.start === range.start &&
			now.end === range.end &&
			now.keep.length === keep.length &&
			now.keep.every((index, position) => index === keep[position])
		if (!same) context.store.set({ [options.key]: { ...range, keep } } as Partial<State>)
	}

	// The browser tells the heights of rows in a step of its own, right before
	// it paints. A renderer that adds rows inside that step makes the browser
	// report an error ("ResizeObserver loop"), because the new rows cannot be
	// measured in the same step. So the answer to a new height has two parts:
	// the scroll position is corrected at once, which keeps the rows in view
	// where they are, and the rows to render are worked out in the next frame.
	// The rows of `overscan` cover the frame until then.
	let later = 0
	function updateSoon(): void {
		const view = origin?.ownerDocument.defaultView
		if (!view || later) return
		later = view.requestAnimationFrame(() => {
			later = 0
			if (read()) update()
		})
	}

	function scrollBy(pixels: number): void {
		if (!pixels) return
		if (scroller) scroller.scrollTop += pixels
		else origin?.ownerDocument.defaultView?.scrollBy(0, pixels)
	}

	/** Scrolls so that the target row is where the caller asked for it. `measuring` is true inside the measurement step of the browser. */
	function reach(measuring = false): void {
		if (!target || !read()) return
		const measured = metrics()
		const index = measured.indexOf(target.id)
		if (index < 0) {
			target = undefined
			return
		}
		const covered = options.cover?.({ top: frame.top, bottom: frame.bottom })
		const from = frame.from + (covered?.top ?? 0)
		const to = frame.to - (covered?.bottom ?? 0)
		const start = measured.offset(index)
		const end = start + measured.size(index)
		let move = 0
		if (target.align === 'start') move = start - from
		else if (target.align === 'end') move = end - to
		else if (target.align === 'center') move = (start + end) / 2 - (from + to) / 2
		// The nearest edge. A row higher than the frame shows its start.
		else if (start < from || end - start > to - from) move = start - from
		else if (end > to) move = end - to
		scrollBy(move)
		if (measuring) updateSoon()
		else {
			read()
			update()
		}
		target.sizes = sizes
		// Rows that are new on the screen get their real heights within a frame
		// or two. With no new height after that, the row is where it must be.
		const view = origin?.ownerDocument.defaultView
		if (!view) return
		view.cancelAnimationFrame(settle)
		const asked = target
		settle = view.requestAnimationFrame(() => {
			settle = view.requestAnimationFrame(() => {
				if (target === asked && asked.sizes === sizes) target = undefined
			})
		})
	}

	const Observer = typeof ResizeObserver === 'undefined' ? undefined : ResizeObserver

	const rowObserver =
		Observer &&
		new Observer((entries) => {
			if (destroyed || !options.enabled() || options.rowHeight() !== undefined) return
			read()
			const measured = metrics()
			let above = 0
			let changed = false
			for (const entry of entries) {
				const id = ids.get(entry.target)
				if (id === undefined || !entry.target.isConnected) continue
				const index = measured.indexOf(id)
				if (index < 0) continue
				const start = measured.offset(index)
				const delta = measured.measure(id, entry.target.getBoundingClientRect().height)
				if (!delta) continue
				changed = true
				// The row starts above the frame, so everything in the frame moved by the difference.
				if (start < frame.from) above += delta
			}
			if (!changed) return
			sizes++
			if (target) reach(true)
			else {
				scrollBy(above)
				updateSoon()
			}
		})

	const frameObserver =
		Observer &&
		new Observer(() => {
			if (read()) update()
		})

	const onScroll = () => {
		if (read()) update()
	}
	// A person who scrolls takes the scroll position back from a jump that is
	// not settled yet. The listeners run in the capture phase: a key on a cell
	// can ask for a row, and that request comes after this and stays.
	const onInput = () => {
		target = undefined
	}
	const INPUTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

	function scrollParent(el: HTMLElement): HTMLElement | undefined {
		const view = el.ownerDocument.defaultView
		for (let parent = el.parentElement; parent && view; parent = parent.parentElement) {
			if (parent === el.ownerDocument.documentElement || parent === el.ownerDocument.body) break
			const overflow = view.getComputedStyle(parent).overflowY
			if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return parent
		}
		return undefined
	}

	// The rows, the options or the rows to keep can change with the state.
	context.onDestroy(
		context.store.subscribe((liveOnly) => {
			if (!liveOnly) update()
		}),
	)
	context.onDestroy(() => {
		destroyed = true
		rowObserver?.disconnect()
		frameObserver?.disconnect()
	})

	return {
		bindOrigin(el) {
			origin = el
			let leave: (() => void) | undefined
			let left = false
			// A renderer can call this before the element is in the page, and the
			// frame is found from the parents of the element. So the search waits
			// until the element is in the page: for the end of the render that runs
			// now, and else for the first layout of the element.
			const join = () => {
				if (left || leave || !el.isConnected) return
				const view = el.ownerDocument.defaultView
				const frameEl = scrollParent(el)
				scroller = frameEl
				const source: HTMLElement | Window | null = frameEl ?? view
				const anchored = frameEl ?? el.ownerDocument.documentElement
				const anchoring = anchored.style.getPropertyValue('overflow-anchor')
				anchored.style.setProperty('overflow-anchor', 'none')
				source?.addEventListener('scroll', onScroll, { passive: true })
				view?.addEventListener('resize', onScroll, { passive: true })
				for (const name of INPUTS) {
					source?.addEventListener(name, onInput, { passive: true, capture: true })
				}
				if (frameEl) frameObserver?.observe(frameEl)
				leave = () => {
					source?.removeEventListener('scroll', onScroll)
					view?.removeEventListener('resize', onScroll)
					for (const name of INPUTS) {
						source?.removeEventListener(name, onInput, { capture: true })
					}
					if (frameEl) frameObserver?.unobserve(frameEl)
					if (anchoring) anchored.style.setProperty('overflow-anchor', anchoring)
					else anchored.style.removeProperty('overflow-anchor')
					view?.cancelAnimationFrame(settle)
					view?.cancelAnimationFrame(later)
					later = 0
				}
				if (read()) update()
			}
			const waiting = Observer && new Observer(join)
			waiting?.observe(el)
			join()
			queueMicrotask(join)
			return () => {
				left = true
				waiting?.disconnect()
				leave?.()
				if (origin === el) {
					origin = undefined
					scroller = undefined
				}
			}
		},
		bindBody(el) {
			const rowOf = (node: EventTarget | null): string | undefined => {
				for (
					let at = node instanceof Element ? node : null;
					at && at !== el;
					at = at.parentElement
				) {
					const id = ids.get(at)
					if (id !== undefined) return id
				}
				return undefined
			}
			const onFocusin = (event: FocusEvent) => {
				const id = rowOf(event.target)
				if (id === focused) return
				focused = id
				update()
			}
			const onFocusout = (event: FocusEvent) => {
				// Focus that goes to another row comes in again through `focusin`.
				if (event.relatedTarget instanceof Node && el.contains(event.relatedTarget)) return
				if (focused === undefined) return
				focused = undefined
				update()
			}
			el.addEventListener('focusin', onFocusin)
			el.addEventListener('focusout', onFocusout)
			return () => {
				el.removeEventListener('focusin', onFocusin)
				el.removeEventListener('focusout', onFocusout)
			}
		},
		bindRow(el, id) {
			ids.set(el, id)
			elements.set(id, el)
			watch()
			if (observing) rowObserver?.observe(el)
			return () => {
				rowObserver?.unobserve(el)
				ids.delete(el)
				if (elements.get(id) === el) elements.delete(id)
			}
		},
		parts() {
			if (!options.enabled()) return undefined
			const measured = metrics()
			const state = current()
			return windowSegments(state, state.keep, measured.count()).map((segment) =>
				segment.kind === 'gap'
					? { ...segment, size: measured.offset(segment.to) - measured.offset(segment.from) }
					: segment,
			)
		},
		refresh() {
			if (read()) update()
			else update()
		},
		scrollTo(id, align = 'nearest') {
			if (!options.enabled()) {
				const el = elements.get(id)
				if (!el) return false
				if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: align })
				return true
			}
			if (metrics().indexOf(id) < 0) return false
			target = { id, align, sizes }
			reach()
			return true
		},
	}
}
