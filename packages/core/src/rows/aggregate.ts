import { cellValue, leafColumns } from './columns'
import type { AggregateFn, AggregateName, ColumnDef, DataRow } from './types'

function numbers(values: readonly unknown[]): number[] {
	return values.filter(
		(value): value is number => typeof value === 'number' && !Number.isNaN(value),
	)
}

function present(values: readonly unknown[]): unknown[] {
	return values.filter((value) => value !== null && value !== undefined && value !== '')
}

function extreme(values: readonly unknown[], pick: (a: number, b: number) => boolean): unknown {
	let best: unknown
	let bestOrder: number | undefined
	for (const value of present(values)) {
		const order = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : NaN
		if (Number.isNaN(order)) continue
		if (bestOrder === undefined || pick(order, bestOrder)) {
			best = value
			bestOrder = order
		}
	}
	return best
}

export const aggregates: Record<AggregateName, (values: readonly unknown[]) => unknown> = {
	sum: (values) => numbers(values).reduce((total, value) => total + value, 0),
	mean: (values) => {
		const list = numbers(values)
		return list.length ? list.reduce((total, value) => total + value, 0) / list.length : undefined
	},
	min: (values) => extreme(values, (a, b) => a < b),
	max: (values) => extreme(values, (a, b) => a > b),
	count: (values) => present(values).length,
	uniqueCount: (values) => new Set(present(values)).size,
	first: (values) => present(values)[0],
}

/** One value for each column that has an `aggregate`, over the given rows. */
export function aggregateRows<Row>(
	rows: readonly DataRow<Row>[],
	columns: readonly ColumnDef<Row>[],
): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	for (const column of leafColumns(columns)) {
		if (!column.aggregate) continue
		const values = rows.map((node) => cellValue(node.row, column))
		if (typeof column.aggregate === 'function') {
			const custom: AggregateFn<Row> = column.aggregate
			result[column.id] = custom(
				values,
				rows.map((node) => node.row),
			)
			continue
		}
		const built = aggregates[column.aggregate] as
			| ((values: readonly unknown[]) => unknown)
			| undefined
		if (!built) {
			throw new Error(
				`No aggregate "${String(column.aggregate)}" for column "${column.id}". Aggregates: ${Object.keys(aggregates).join(', ')}, or a function.`,
			)
		}
		result[column.id] = built(values)
	}
	return result
}
