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
}

/**
 * The rows a person can see, in order: each group or tree row, then its
 * children when it is expanded. This is the list that rendering, the row
 * window and keyboard navigation count rows in.
 */
export function flattenRows<Row>(
	rows: readonly TableRow<Row>[],
	isExpanded: (node: TableRow<Row>) => boolean,
): FlatRow<Row>[] {
	const flat: FlatRow<Row>[] = []

	const walk = (list: readonly TableRow<Row>[], level: number, parentId: string | null) => {
		for (let index = 0; index < list.length; index++) {
			const node = list[index] as TableRow<Row>
			const children = node.children
			const expandable = !!children?.length
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
			if (expanded && children) walk(children, level + 1, node.id)
		}
	}

	walk(rows, 0, null)
	return flat
}
