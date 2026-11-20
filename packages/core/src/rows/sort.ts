import { cellValue, leafColumns, requireColumns, toText } from './columns'
import type { ColumnDef, DataRow, SortRule } from './types'

export type SortOptions<Row> = {
	columns: readonly ColumnDef<Row>[]
	locale?: string
	/** Also sort the tree children of each row. */
	sortChildren?: boolean
}

const collators = new Map<string, Intl.Collator>()

function collatorFor(locale: string | undefined): Intl.Collator {
	const key = locale ?? ''
	let collator = collators.get(key)
	if (!collator) {
		collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
		collators.set(key, collator)
	}
	return collator
}

function isEmpty(value: unknown): boolean {
	if (value === null || value === undefined || value === '') return true
	// `NaN` and an invalid date have no order. A comparison with one of them
	// gives `NaN`, and that breaks the order of every row, not only of this one.
	if (typeof value === 'number') return Number.isNaN(value)
	return value instanceof Date && Number.isNaN(value.getTime())
}

/** Compares two non-empty cell values. Text compares by the locale, with numbers inside text in numeric order. */
export function compareValues(a: unknown, b: unknown, locale?: string): number {
	if (typeof a === 'number' && typeof b === 'number') return a - b
	if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
	if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
	if (typeof a === 'bigint' && typeof b === 'bigint') return a < b ? -1 : a > b ? 1 : 0
	return collatorFor(locale).compare(toText(a), toText(b))
}

/**
 * Sorts rows by the rules, first rule first. The sort is stable, and empty
 * values come last in both directions. Cell values are read once for each
 * row, not once for each comparison.
 */
export function sortRows<Row>(
	rows: readonly DataRow<Row>[],
	rules: readonly SortRule[],
	options: SortOptions<Row>,
): readonly DataRow<Row>[] {
	if (!rules.length) return rows
	const columns = requireColumns(
		leafColumns(options.columns),
		rules.map((rule) => rule.id),
		'sort by',
	)
	return sortLevel(rows, rules, columns, options)
}

function sortLevel<Row>(
	rows: readonly DataRow<Row>[],
	rules: readonly SortRule[],
	columns: readonly ColumnDef<Row>[],
	options: SortOptions<Row>,
): readonly DataRow<Row>[] {
	const values = rows.map((node) => columns.map((column) => cellValue(node.row, column)))
	const order = rows.map((_, index) => index)

	order.sort((left, right) => {
		const leftValues = values[left] as unknown[]
		const rightValues = values[right] as unknown[]
		for (let rule = 0; rule < rules.length; rule++) {
			const a = leftValues[rule]
			const b = rightValues[rule]
			const emptyA = isEmpty(a)
			const emptyB = isEmpty(b)
			if (emptyA || emptyB) {
				if (emptyA && emptyB) continue
				return emptyA ? 1 : -1
			}
			const column = columns[rule] as ColumnDef<Row>
			const result = column.compare
				? column.compare(a, b, (rows[left] as DataRow<Row>).row, (rows[right] as DataRow<Row>).row)
				: compareValues(a, b, options.locale)
			if (result !== 0) return rules[rule]?.desc ? -result : result
		}
		return left - right
	})

	return order.map((index) => {
		const node = rows[index] as DataRow<Row>
		if (!options.sortChildren || !node.children) return node
		const children = sortLevel(node.children, rules, columns, options)
		return { ...node, children }
	})
}
