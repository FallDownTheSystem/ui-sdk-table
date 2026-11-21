import { cellValue, leafColumns, requireColumns, valueKey } from './columns'
import type { ColumnDef, DataRow, GroupRow, TableRow } from './types'

export type GroupOptions<Row> = {
	columns: readonly ColumnDef<Row>[]
	/** Rows that stay outside every group, at the top level. */
	canGroup?: (row: Row) => boolean
}

/**
 * Nests rows under one group for each value of the `groupBy` columns, first
 * column outermost. Groups and their rows keep the order of the input, so
 * sorted input gives sorted groups. Data rows are the same objects as in the
 * input. Rows that `canGroup` refuses come first, before every group.
 *
 * A group is one value as a person reads it: `null`, `undefined` and empty
 * text share the group without a value, and `1` shares a group with `'1'`.
 */
export function groupRows<Row>(
	rows: readonly DataRow<Row>[],
	groupBy: readonly string[],
	options: GroupOptions<Row>,
): readonly TableRow<Row>[] {
	if (!groupBy.length) return rows
	const columns = requireColumns(leafColumns(options.columns), groupBy, 'group by')
	const { canGroup } = options

	const level = (
		list: readonly DataRow<Row>[],
		depth: number,
		parentId: string | null,
	): TableRow<Row>[] => {
		const column = columns[depth]
		if (!column) return [...list]

		const result: TableRow<Row>[] = []
		const buckets = new Map<string, { value: unknown; rows: DataRow<Row>[] }>()
		for (const node of list) {
			if (depth === 0 && canGroup && !canGroup(node.row)) {
				result.push(node)
				continue
			}
			const value = cellValue(node.row, column)
			const key = valueKey(value)
			let bucket = buckets.get(key)
			if (!bucket) {
				bucket = { value, rows: [] }
				buckets.set(key, bucket)
			}
			bucket.rows.push(node)
		}

		for (const [key, bucket] of buckets) {
			// The id holds the whole path, so the same value under two parents gives two groups.
			const id = `${parentId ?? 'group'}/${column.id}=${encodeURIComponent(key)}`
			const group: GroupRow<Row> = {
				kind: 'group',
				id,
				columnId: column.id,
				value: bucket.value,
				depth,
				parentId,
				children: level(bucket.rows, depth + 1, id),
				leaves: bucket.rows,
			}
			result.push(group)
		}
		return result
	}

	return level(rows, 0, null)
}
