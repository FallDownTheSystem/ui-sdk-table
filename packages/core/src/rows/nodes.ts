import type { DataRow } from './types'

export type RowNodeOptions<Row> = {
	/**
	 * A stable id for a row. Without it, the row's own `id` property is used,
	 * and a row without one gets its position in the source data. A position
	 * changes when the data is replaced, so selection and expansion only
	 * survive new data when rows have real ids.
	 */
	getRowId?: (row: Row, index: number, parent: DataRow<Row> | null) => string | number
	getChildren?: (row: Row) => readonly Row[] | undefined
}

export type RowNodes<Row> = {
	rows: DataRow<Row>[]
	byId: Map<string, DataRow<Row>>
}

/** The `id` of a row object, when it has one that can be an id. */
export function ownId(row: unknown): string | undefined {
	if (typeof row !== 'object' || row === null) return undefined
	const id = (row as { id?: unknown }).id
	return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined
}

export function createRowNodes<Row>(
	rows: readonly Row[],
	options: RowNodeOptions<Row> = {},
): RowNodes<Row> {
	const { getRowId, getChildren } = options
	const byId = new Map<string, DataRow<Row>>()

	const build = (list: readonly Row[], parent: DataRow<Row> | null, depth: number) => {
		const nodes: DataRow<Row>[] = []
		for (let index = 0; index < list.length; index++) {
			const row = list[index] as Row
			const id = getRowId
				? String(getRowId(row, index, parent))
				: (ownId(row) ?? (parent ? `${parent.id}.${index}` : String(index)))
			if (byId.has(id)) {
				throw new Error(
					`Two rows have the id "${id}". Row ids must be unique: give each row its own \`id\`, or pass \`getRowId\`.`,
				)
			}
			const node: DataRow<Row> = {
				kind: 'row',
				id,
				row,
				index,
				depth,
				parentId: parent ? parent.id : null,
			}
			byId.set(id, node)
			const children = getChildren?.(row)
			if (children?.length) node.children = build(children, node, depth + 1)
			nodes.push(node)
		}
		return nodes
	}

	return { rows: build(rows, null, 0), byId }
}

/** Calls `visit` for each data row and its tree descendants, parents first. */
export function walkRows<Row>(
	rows: readonly DataRow<Row>[],
	visit: (row: DataRow<Row>) => void,
): void {
	for (const row of rows) {
		visit(row)
		if (row.children) walkRows(row.children, visit)
	}
}

/**
 * The rows without the rows of `ids`, at any depth. A row that goes takes
 * its tree children with it. When no row goes, the result is `rows` itself.
 */
export function omitRows<Row>(
	rows: readonly DataRow<Row>[],
	ids: ReadonlySet<string>,
): readonly DataRow<Row>[] {
	if (!ids.size) return rows
	let changed = false
	const kept: DataRow<Row>[] = []
	for (const node of rows) {
		if (ids.has(node.id)) {
			changed = true
			continue
		}
		const children = node.children && omitRows(node.children, ids)
		if (children === node.children) kept.push(node)
		else {
			changed = true
			// A new node around the same row: the caller's row object is not touched.
			const { children: _before, ...rest } = node
			kept.push(children?.length ? { ...rest, children } : rest)
		}
	}
	return changed ? kept : rows
}
