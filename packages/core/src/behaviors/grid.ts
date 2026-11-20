import {
	createGridFocus,
	isRTL,
	type GridCell,
	type GridFocus,
	type PrimitiveContext,
} from '@ui-sdk/core'

export type { GridCell }

export const GRID_KEYS = [
	'ArrowUp',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'Home',
	'End',
	'mod+Home',
	'mod+End',
	'PageUp',
	'PageDown',
] as const

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Whether focus came from the keyboard, as far as the browser tells. */
function keyboardFocus(el: HTMLElement): boolean {
	// A test page without layout has no scrolling, and some have no `:focus-visible`.
	if (typeof el.scrollIntoView !== 'function') return false
	try {
		return el.matches(':focus-visible')
	} catch {
		return false
	}
}

const ROOT = '[data-slot="table"]'
const CELL = '[data-slot="table-cell"]'

/** The cells that one element covers: its first cell, and how many rows and columns it spans. */
export type GridArea = GridCell & { rowSpan: number; colSpan: number }

export type TableGrid = GridFocus & {
	/**
	 * Handles a key on a cell. Returns `true` when the key is used.
	 *
	 * A cell can hold controls, and arrow keys cannot serve both the grid and a
	 * control. So focus is in one of two places: on the cell, where arrows move
	 * between cells, or inside the cell, where keys belong to the control.
	 * Enter or F2 goes in, Escape or F2 comes back.
	 */
	cellKeydown(event: KeyboardEvent, cell: HTMLElement | undefined): boolean
	/**
	 * Makes the table one stop in the tab order. Return it from the `bind` of
	 * the root slot.
	 *
	 * The controls inside cells are in the tab order of the browser, and the
	 * table does not own them: they come from the slots of the caller. So the
	 * rule is kept at the two moments when it can break. On Tab, the controls
	 * leave the tab order for that one key, and focus goes out of the table.
	 * When focus comes in from outside onto a control, it goes to the cell that
	 * holds the tab stop.
	 */
	bindRoot(root: HTMLElement): () => void
	/**
	 * Moves the active cell onto a cell that exists. Call it when the number
	 * of rows or columns changed, or when cells joined or split.
	 */
	settle(): void
}

/**
 * Cell focus for the table. `createGridFocus` of UI SDK is experimental, so
 * this file is the only one that calls it.
 *
 * `createGridFocus` knows cells of one row and one column. A table also has
 * cells that span: a header group, a header that reaches down past a group,
 * a group row that is one wide cell. So this behavior works out the target
 * of each key itself, from `area`, and uses `createGridFocus` for the tab
 * stop and for the move of focus.
 */
export function createTableGrid<State extends object>(
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'options' | 'parts'>,
	options: {
		key: keyof State & string
		rows: () => number
		cols: () => number
		pageSize?: () => number
		/** The element that covers a cell. Without it, each cell is its own element. */
		area?: (cell: GridCell) => GridArea
		/** Shows a row that may not be rendered, before focus moves to it. */
		reveal?: (cell: GridCell) => void
	},
): TableGrid {
	const grid = createGridFocus(context, {
		key: options.key,
		rows: options.rows,
		cols: options.cols,
		pageSize: options.pageSize,
		reveal: options.reveal,
	})

	const area = (cell: GridCell): GridArea =>
		options.area?.(cell) ?? { ...cell, rowSpan: 1, colSpan: 1 }
	const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

	// The row and the column that the person moves along. A wide cell has one
	// column of its own, so after a move down through a group row, the next
	// move down goes on in the column where the person started.
	let line: GridCell | undefined
	let reached: GridCell | undefined

	function target(event: KeyboardEvent, rtl: boolean): GridCell | undefined {
		const active = grid.active()
		const rows = options.rows()
		const cols = options.cols()
		if (!active || rows < 1 || cols < 1) return undefined
		const here = area(active)
		const moved = !reached || reached.row !== active.row || reached.col !== active.col
		const from = !line || moved ? { row: active.row, col: active.col } : line
		// The line stays inside the cell that has focus.
		const row = clamp(from.row, here.row, here.row + here.rowSpan - 1)
		const col = clamp(from.col, here.col, here.col + here.colSpan - 1)
		const mod = event.ctrlKey || event.metaKey
		const page = Math.max(1, options.pageSize?.() ?? 10)
		const back = rtl ? 'ArrowRight' : 'ArrowLeft'
		const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
		switch (event.key) {
			case 'ArrowUp':
				return { row: here.row - 1, col }
			case 'ArrowDown':
				return { row: here.row + here.rowSpan, col }
			case back:
				return { row, col: here.col - 1 }
			case forward:
				return { row, col: here.col + here.colSpan }
			case 'Home':
				return mod ? { row: 0, col: 0 } : { row, col: 0 }
			case 'End':
				return mod ? { row: rows - 1, col: cols - 1 } : { row, col: cols - 1 }
			case 'PageUp':
				return { row: Math.max(0, here.row - page), col }
			case 'PageDown':
				return { row: Math.min(rows - 1, here.row + here.rowSpan - 1 + page), col }
			default:
				return undefined
		}
	}

	function keydown(event: KeyboardEvent): boolean {
		if (event.altKey) return false
		const el = event.target instanceof Element ? event.target : undefined
		const next = target(event, !!el && isRTL(el))
		if (!next) return false
		// The key belongs to the grid, also at an edge, so the page does not scroll.
		event.preventDefault()
		if (next.row < 0 || next.col < 0 || next.row >= options.rows() || next.col >= options.cols()) {
			return false
		}
		const cell = area(next)
		const active = grid.active()
		if (active && cell.row === active.row && cell.col === active.col) return false
		line = next
		reached = { row: cell.row, col: cell.col }
		return grid.focus(reached, { reason: 'list-navigation', event, shift: event.shiftKey })
	}

	function settle(): void {
		const active = grid.active()
		if (!active) return
		const rows = options.rows()
		const cols = options.cols()
		if (rows < 1 || cols < 1) return
		const cell = area({
			row: clamp(active.row, 0, rows - 1),
			col: clamp(active.col, 0, cols - 1),
		})
		if (cell.row === active.row && cell.col === active.col) return
		context.store.set({ [options.key]: { row: cell.row, col: cell.col } } as Partial<State>)
	}

	return {
		...grid,
		keydown,
		settle,
		cellKeydown(event, cell) {
			const inside = !!cell && event.target instanceof Node && event.target !== cell
			if (inside) {
				if (event.key === 'Escape' || event.key === 'F2') {
					event.preventDefault()
					cell.focus()
					return true
				}
				// The control inside the cell owns every other key.
				return false
			}
			if ((event.key === 'Enter' || event.key === 'F2') && cell) {
				const control = cell.querySelector<HTMLElement>(FOCUSABLE)
				if (control) {
					event.preventDefault()
					control.focus()
					return true
				}
			}
			return keydown(event)
		},
		bindRoot(root) {
			let tabbing = false
			// A cell of this table, and not of a table or a calendar inside one of its cells.
			const ownCell = (el: HTMLElement) => el.matches(CELL) && el.closest(ROOT) === root
			const tabStop = () => {
				for (const cell of root.querySelectorAll<HTMLElement>(`${CELL}[tabindex="0"]`)) {
					if (ownCell(cell)) return cell
				}
				return undefined
			}
			const onKeydown = (event: KeyboardEvent) => {
				if (event.key !== 'Tab' || event.defaultPrevented) return
				const held: [HTMLElement, string | null][] = []
				for (const control of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
					// The cells are in this list too. They keep their tab index, which is the tab stop.
					if (ownCell(control)) continue
					held.push([control, control.getAttribute('tabindex')])
					control.setAttribute('tabindex', '-1')
				}
				// The browser picks the next element right after this event, so one turn is enough.
				setTimeout(() => {
					for (const [control, tabindex] of held) {
						if (tabindex === null) control.removeAttribute('tabindex')
						else control.setAttribute('tabindex', tabindex)
					}
				})
			}
			const onFocusin = (event: FocusEvent) => {
				const target = event.target
				const from = event.relatedTarget
				if (!(target instanceof HTMLElement)) return
				if (ownCell(target)) {
					// A browser does not scroll for focus when the element is inside the
					// scroll frame, also when a pinned column or a sticky header covers
					// it there. A scroll into view counts the scroll margin of the cell,
					// which holds the size of what covers the edge. Only for the
					// keyboard: a cell under the pointer is where the person looks.
					if (keyboardFocus(target)) target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
					return
				}
				if (from instanceof Node && root.contains(from)) return
				// Only a Tab key brings focus to the wrong place. Focus from a press, from a
				// script, or from a popup that closes is where the person or the app put it.
				if (!tabbing) return
				tabStop()?.focus()
			}
			const onDocumentKeydown = (event: KeyboardEvent) => {
				tabbing = event.key === 'Tab'
				// The browser moves focus right after this event, so the mark lasts one turn.
				if (tabbing) setTimeout(() => (tabbing = false))
			}

			// A change of the rows or the columns can remove the element that has
			// focus. The browser then gives focus to the page, and the keyboard
			// loses its place. So when focus was in the table before a change and is
			// nowhere after it, focus goes to the active cell.
			const page = root.ownerDocument
			const view = page.defaultView
			let check = 0
			const stopWatch = context.store.subscribe((liveOnly) => {
				if (liveOnly || check || !view) return
				const held = page.activeElement
				if (!held || !root.contains(held)) return
				check = view.requestAnimationFrame(() => {
					check = 0
					const now = page.activeElement
					if (now && now !== page.body && now.isConnected) return
					tabStop()?.focus({ preventScroll: true })
				})
			})

			root.addEventListener('keydown', onKeydown)
			root.addEventListener('focusin', onFocusin)
			page.addEventListener('keydown', onDocumentKeydown, true)
			return () => {
				stopWatch()
				if (check) view?.cancelAnimationFrame(check)
				root.removeEventListener('keydown', onKeydown)
				root.removeEventListener('focusin', onFocusin)
				page.removeEventListener('keydown', onDocumentKeydown, true)
			}
		},
	}
}
