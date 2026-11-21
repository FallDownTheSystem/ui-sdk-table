import type { ColumnDef } from '../rows'

export type ColumnPin = 'start' | 'end'

export type ColumnPinning = { start?: readonly string[]; end?: readonly string[] }

export type ColumnLayoutState = {
	/** Columns with `false` are hidden. The id of a header group hides all its columns. */
	visibility?: Readonly<Record<string, boolean>>
	/** Column ids in display order. Columns that are not listed come after, in definition order. */
	order?: readonly string[]
	pinning?: ColumnPinning
}

export type HeaderCell<Row = unknown> = {
	/** Unique in the header. A group that the column order splits gives one cell for each part. */
	key: string
	column: ColumnDef<Row>
	/** True for a column that holds cells, false for a header group. */
	leaf: boolean
	/** The header row, from 0. */
	row: number
	/** The first column that the cell covers, from 0. */
	col: number
	colSpan: number
	rowSpan: number
	pin: ColumnPin | undefined
}

export type ColumnLayout<Row = unknown> = {
	/** The columns that hold cells: visible, in display order, pinned columns at their edge. */
	leaves: ColumnDef<Row>[]
	/** Every column that holds cells, hidden ones too, in definition order. */
	all: ColumnDef<Row>[]
	byId: Map<string, ColumnDef<Row>>
	/** Every header group, by id. */
	groups: Map<string, ColumnDef<Row>>
	/** The position of a visible column, from 0. */
	index: Map<string, number>
	pins: Map<string, ColumnPin>
	headerRows: HeaderCell<Row>[][]
}

type Leaf<Row> = { column: ColumnDef<Row>; path: ColumnDef<Row>[]; position: number }

/** Whether a top-level column leads the table: see `lead` of a column. */
export const isLead = (column: ColumnDef<any>) => column.lead === true && !column.columns?.length

/**
 * Works out which columns show, in which order, and how the header rows
 * cover them. Every part of the table reads the columns from this one result,
 * so the header, the cells, the footer and the keyboard grid cannot disagree.
 */
export function layoutColumns<Row>(
	columns: readonly ColumnDef<Row>[],
	state: ColumnLayoutState = {},
): ColumnLayout<Row> {
	const { visibility = {}, order = [], pinning = {} } = state
	const found: Leaf<Row>[] = []
	const shown: Leaf<Row>[] = []
	const groups = new Map<string, ColumnDef<Row>>()

	const walk = (list: readonly ColumnDef<Row>[], path: ColumnDef<Row>[], hidden: boolean) => {
		for (const column of list) {
			const off = hidden || visibility[column.id] === false
			if (column.columns?.length) {
				groups.set(column.id, column)
				walk(column.columns, [...path, column], off)
				continue
			}
			const leaf = { column, path, position: found.length }
			found.push(leaf)
			if (!off) shown.push(leaf)
		}
	}
	walk(columns, [], false)

	const pins = new Map<string, ColumnPin>()
	for (const id of pinning.start ?? []) pins.set(id, 'start')
	for (const id of pinning.end ?? []) if (!pins.has(id)) pins.set(id, 'end')

	// A leading column has no pin of its own. It goes where the first columns
	// go: to the start edge while a column in view is pinned there, so it never
	// scrolls under that column, and with the columns that scroll otherwise.
	const leads = (leaf: Leaf<Row>) => isLead(leaf.column) && leaf.path.length === 0
	const startHeld = shown.some((leaf) => !leads(leaf) && pins.get(leaf.column.id) === 'start')
	for (const leaf of found) {
		if (!leads(leaf)) continue
		if (startHeld) pins.set(leaf.column.id, 'start')
		else pins.delete(leaf.column.id)
	}

	const rank = (ids: readonly string[]) => new Map(ids.map((id, position) => [id, position]))
	const ordered = rank(order)
	const pinnedStart = rank(pinning.start ?? [])
	const pinnedEnd = rank(pinning.end ?? [])
	const section = (leaf: Leaf<Row>) => {
		const pin = pins.get(leaf.column.id)
		return pin === 'start' ? 0 : pin === 'end' ? 2 : 1
	}
	const place = (leaf: Leaf<Row>) => {
		const id = leaf.column.id
		const pin = pins.get(id)
		// Before every place that an order or a pin gives, in definition order.
		if (leads(leaf)) return leaf.position - found.length
		// A pinned column takes its place from the order of the pins.
		if (pin === 'start') return pinnedStart.get(id) ?? 0
		if (pin === 'end') return pinnedEnd.get(id) ?? 0
		return ordered.get(id) ?? order.length + leaf.position
	}
	shown.sort((a, b) => section(a) - section(b) || place(a) - place(b) || a.position - b.position)

	const depth = Math.max(0, ...shown.map((leaf) => leaf.path.length))
	const headerRows: HeaderCell<Row>[][] = Array.from({ length: depth + 1 }, () => [])
	shown.forEach((leaf, col) => {
		const pin = pins.get(leaf.column.id)
		leaf.path.forEach((group, row) => {
			const cells = headerRows[row] as HeaderCell<Row>[]
			const last = cells.at(-1)
			const before = shown[col - 1]
			// A group covers its columns only while they are side by side and on the same side of a pin.
			const joins =
				last &&
				!last.leaf &&
				last.column === group &&
				last.col + last.colSpan === col &&
				last.pin === pin &&
				before?.path[row] === group &&
				leaf.path.slice(0, row).every((parent, level) => before.path[level] === parent)
			if (joins) last.colSpan++
			else {
				cells.push({
					key: `${group.id}@${col}`,
					column: group,
					leaf: false,
					row,
					col,
					colSpan: 1,
					rowSpan: 1,
					pin,
				})
			}
		})
		const row = leaf.path.length
		;(headerRows[row] as HeaderCell<Row>[]).push({
			key: leaf.column.id,
			column: leaf.column,
			leaf: true,
			row,
			col,
			colSpan: 1,
			// A column with fewer groups above it reaches down to the last header row.
			rowSpan: depth - row + 1,
			pin,
		})
	})

	const leaves = shown.map((leaf) => leaf.column)
	const all = found.map((leaf) => leaf.column)
	return {
		leaves,
		all,
		byId: new Map(all.map((column) => [column.id, column])),
		groups,
		index: new Map(leaves.map((column, position) => [column.id, position])),
		pins,
		headerRows,
	}
}

/**
 * Every column id in display order, hidden columns too. This is the full form
 * of a column order. A leading column has its place without an order, so it
 * is not in one.
 */
export function fullColumnOrder<Row>(
	columns: readonly ColumnDef<Row>[],
	order: readonly string[] = [],
): string[] {
	const lead = new Set(columns.filter(isLead).map((column) => column.id))
	const all = layoutColumns(columns)
		.all.map((column) => column.id)
		.filter((id) => !lead.has(id))
	const known = new Set(all)
	const listed = order.filter((id, position) => known.has(id) && order.indexOf(id) === position)
	const rest = new Set(listed)
	return [...listed, ...all.filter((id) => !rest.has(id))]
}

/**
 * A full column order after a move among some of its columns. The columns of
 * `track` take the places that they hold in `order` now, in the sequence of
 * `track`; every other column keeps its place.
 */
export function mergeColumnTrack(order: readonly string[], track: readonly string[]): string[] {
	const moving = new Set(track)
	let next = 0
	return order.map((id) => (moving.has(id) ? (track[next++] ?? id) : id))
}

/** The header cell that covers each place of the header, by header row and column. */
export function headerCellMap<Row>(layout: ColumnLayout<Row>): (HeaderCell<Row> | undefined)[][] {
	const map: (HeaderCell<Row> | undefined)[][] = layout.headerRows.map(() => [])
	for (const cells of layout.headerRows) {
		for (const cell of cells) {
			for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
				const places = map[row]
				if (!places) continue
				for (let col = cell.col; col < cell.col + cell.colSpan; col++) places[col] = cell
			}
		}
	}
	return map
}
