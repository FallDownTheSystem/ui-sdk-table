import type { CellBounds } from '../behaviors/range'
import type { GridCell } from '../behaviors/grid'

/** Where focus goes after a save: Enter moves down and with Shift up, Tab moves forward and with Shift back. */
export type Move = 'down' | 'up' | 'forward' | 'back'

/** The grid rows that hold body rows, and how many columns the table shows. */
export type MoveLimits = { first: number; last: number; cols: number }

/**
 * The cell after a cell. `forward` and `back` are in reading order, so a
 * table that reads from right to left needs no rule here.
 *
 * Without `bounds`, forward and back go on in the next row and stop at the
 * last cell, and down and up stop at the edge. Inside `bounds`, the selected
 * range, a move never leaves: forward and back walk the range row by row,
 * down and up walk it column by column, and after its last cell comes its
 * first. A place where `holds` is false, such as a group row, is passed
 * over. When no other cell is left, the answer is the cell itself.
 */
export function moveFrom(
	from: GridCell,
	move: Move,
	limits: MoveLimits,
	bounds?: CellBounds,
	holds: (cell: GridCell) => boolean = () => true,
): GridCell {
	const back = move === 'up' || move === 'back'
	const byRow = move === 'forward' || move === 'back'
	const inside =
		bounds &&
		from.row >= bounds.top &&
		from.row <= bounds.bottom &&
		from.col >= bounds.left &&
		from.col <= bounds.right
	const box = inside
		? bounds
		: { top: limits.first, bottom: limits.last, left: 0, right: limits.cols - 1 }
	if (box.top > box.bottom || box.left > box.right) return from
	const rows = box.bottom - box.top + 1
	const cols = box.right - box.left + 1
	// The cells of the box as one line: row by row for forward and back, column by column for down and up.
	const place = (cell: GridCell) =>
		byRow
			? (cell.row - box.top) * cols + (cell.col - box.left)
			: (cell.col - box.left) * rows + (cell.row - box.top)
	const cellAt = (index: number): GridCell =>
		byRow
			? { row: box.top + Math.floor(index / cols), col: box.left + (index % cols) }
			: { row: box.top + (index % rows), col: box.left + Math.floor(index / rows) }
	const count = rows * cols
	const step = back ? -1 : 1
	let index = place(from)
	// Down and up outside a range stay in their column.
	const first = inside || byRow ? 0 : index - (index % rows)
	const last = inside || byRow ? count - 1 : first + rows - 1
	const span = last - first + 1
	for (let tried = 1; tried < span; tried++) {
		index += step
		if (index > last || index < first) {
			if (!inside) return from
			index = index > last ? first : last
		}
		const cell = cellAt(index)
		if (holds(cell)) return cell
	}
	return from
}
