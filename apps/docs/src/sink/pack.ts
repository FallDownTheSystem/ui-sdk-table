import type { TileSize } from './types'

export type Span = { columns: number; rows: number }

export const SPANS: Record<TileSize, Span> = {
	s: { columns: 1, rows: 1 },
	wide: { columns: 2, rows: 1 },
	tall: { columns: 1, rows: 2 },
	large: { columns: 2, rows: 2 },
}

export type Placed<Item> = Span & {
	item: Item
	/** The first row and the first column of the item, from 1. */
	row: number
	column: number
}

/**
 * Places items of several sizes in a grid: each item goes to the first free
 * place that holds it, so a small item fills a gap that a large one left.
 * The result is in reading order, by row and then by column.
 *
 * CSS can do the same with `grid-auto-flow: dense`, but it then shows the
 * items in another order than the document has, and the Tab key jumps around
 * the page. With the places from here, the document order is the order on
 * the screen.
 */
export function pack<Item>(
	items: readonly Item[],
	spanOf: (item: Item) => Span,
	columns: number,
): Placed<Item>[] {
	const width = Math.max(1, Math.floor(columns))
	// Who holds each cell, by row and then by column.
	const owners: (Placed<Item> | undefined)[][] = []
	const at = (row: number, column: number) => owners[row - 1]?.[column - 1]
	const isFree = (row: number, column: number, span: Span) => {
		if (column < 1 || column + span.columns - 1 > width) return false
		for (let y = row; y < row + span.rows; y++) {
			for (let x = column; x < column + span.columns; x++) {
				if (at(y, x)) return false
			}
		}
		return true
	}
	const take = (owner: Placed<Item>) => {
		for (let y = owner.row; y < owner.row + owner.rows; y++) {
			const cells = (owners[y - 1] ??= [])
			for (let x = owner.column; x < owner.column + owner.columns; x++) cells[x - 1] = owner
		}
	}

	const placed: Placed<Item>[] = []
	for (const item of items) {
		const wanted = spanOf(item)
		const span = { rows: wanted.rows, columns: Math.min(wanted.columns, width) }
		for (let row = 1, found = false; !found; row++) {
			for (let column = 1; column + span.columns - 1 <= width; column++) {
				if (!isFree(row, column, span)) continue
				const owner = { item, row, column, ...span }
				take(owner)
				placed.push(owner)
				found = true
				break
			}
		}
	}

	// A cell that no item took is a hole in the page. A neighbour grows over
	// it: the one before it in the row, else the one above, else the one after.
	for (let row = 1; row <= owners.length; row++) {
		for (let column = 1; column <= width; column++) {
			if (at(row, column)) continue
			const before = at(row, column - 1)
			const above = at(row - 1, column)
			const after = at(row, column + 1)
			if (before && isFree(before.row, column, { rows: before.rows, columns: 1 })) {
				before.columns++
				take(before)
			} else if (above && isFree(row, above.column, { rows: 1, columns: above.columns })) {
				above.rows++
				take(above)
			} else if (after && isFree(after.row, column, { rows: after.rows, columns: 1 })) {
				after.column--
				after.columns++
				take(after)
			}
		}
	}

	return placed.sort((a, b) => a.row - b.row || a.column - b.column)
}
