import { createGridFocus, type GridCell, type GridFocus, type PrimitiveContext } from '@ui-sdk/core'

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

const ROOT = '[data-slot="table"]'
const CELL = '[data-slot="table-cell"]'

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
}

/**
 * Cell focus for the table. `createGridFocus` of UI SDK is experimental, so
 * this file is the only one that calls it.
 */
export function createTableGrid<State extends object>(
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'options' | 'parts'>,
	options: {
		key: keyof State & string
		rows: () => number
		cols: () => number
		pageSize?: () => number
	},
): TableGrid {
	const grid = createGridFocus(context, options)

	return {
		...grid,
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
			return grid.keydown(event)
		},
		bindRoot(root) {
			let tabbing = false
			// A cell of this table, and not of a table or a calendar inside one of its cells.
			const ownCell = (el: HTMLElement) => el.matches(CELL) && el.closest(ROOT) === root
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
				if (!(target instanceof HTMLElement) || ownCell(target)) return
				if (from instanceof Node && root.contains(from)) return
				// Only a Tab key brings focus to the wrong place. Focus from a press, from a
				// script, or from a popup that closes is where the person or the app put it.
				if (!tabbing) return
				for (const cell of root.querySelectorAll<HTMLElement>(`${CELL}[tabindex="0"]`)) {
					if (ownCell(cell)) return cell.focus()
				}
			}
			const onDocumentKeydown = (event: KeyboardEvent) => {
				tabbing = event.key === 'Tab'
				// The browser moves focus right after this event, so the mark lasts one turn.
				if (tabbing) setTimeout(() => (tabbing = false))
			}
			const page = root.ownerDocument
			root.addEventListener('keydown', onKeydown)
			root.addEventListener('focusin', onFocusin)
			page.addEventListener('keydown', onDocumentKeydown, true)
			return () => {
				root.removeEventListener('keydown', onKeydown)
				root.removeEventListener('focusin', onFocusin)
				page.removeEventListener('keydown', onDocumentKeydown, true)
			}
		},
	}
}
