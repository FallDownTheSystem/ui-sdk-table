import type { TableRow } from './types'

export type FlatRow<Row> = {
	id: string
	node: TableRow<Row>
	/** How far to indent: grouping levels plus tree levels above this row, from 0. `aria-level` is this plus 1. */
	level: number
	parentId: string | null
	/** The position among the rows with the same parent, from 1, for `aria-posinset`. */
	position: number
	/** How many rows have the same parent, for `aria-setsize`. */
	setSize: number
	expandable: boolean
	expanded: boolean
	/**
	 * True for the detail row of a data row: one wide row under it with more
	 * about the same row. `node` is the data row, and `id` is `detailRowId` of
	 * its id.
	 */
	detail?: true
	/** The edge that a pinned row stays at. */
	pinned?: 'top' | 'bottom'
}

/** The id of the detail row of a data row. */
export function detailRowId(rowId: string): string {
	return `detail/${rowId}`
}

/**
 * The rows a person can see, in order: each group or tree row, then its
 * children when it is expanded. This is the list that rendering, the row
 * window and keyboard navigation count rows in.
 *
 * A data row without children can have a detail row: `hasDetail` says which
 * rows do. Such a row expands like a tree row, and its detail row follows it.
 */
export function flattenRows<Row>(
	rows: readonly TableRow<Row>[],
	isExpanded: (node: TableRow<Row>) => boolean,
	hasDetail?: (row: Row) => boolean,
): FlatRow<Row>[] {
	const flat: FlatRow<Row>[] = []

	const walk = (list: readonly TableRow<Row>[], level: number, parentId: string | null) => {
		for (let index = 0; index < list.length; index++) {
			const node = list[index] as TableRow<Row>
			const children = node.children
			const detail = !children?.length && node.kind === 'row' && !!hasDetail?.(node.row)
			const expandable = !!children?.length || detail
			const expanded = expandable && isExpanded(node)
			flat.push({
				id: node.id,
				node,
				level,
				parentId,
				position: index + 1,
				setSize: list.length,
				expandable,
				expanded,
			})
			if (!expanded) continue
			if (detail) {
				flat.push({
					id: detailRowId(node.id),
					node,
					level: level + 1,
					parentId: node.id,
					position: 1,
					setSize: 1,
					expandable: false,
					expanded: false,
					detail: true,
				})
			} else if (children) walk(children, level + 1, node.id)
		}
	}

	walk(rows, 0, null)
	return flat
}
