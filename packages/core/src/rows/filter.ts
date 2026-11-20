import { fuzzyScore } from '@ui-sdk/core/text-match'
import { cellValue, dayEnd, leafColumns, toText, toTime, valueKey } from './columns'
import type { ColumnDef, DataRow, FilterKind, FilterMatcher, FilterState } from './types'

export type FilterOptions<Row> = {
	columns: readonly ColumnDef<Row>[]
	/** The text a person sees in a cell, so the search and text filters match what is shown. */
	text?: (row: Row, column: ColumnDef<Row>) => string
	/** `contains` finds the search text inside a cell. `fuzzy` also accepts near matches. */
	searchMode?: 'contains' | 'fuzzy'
	/**
	 * A fuzzy score must be above this to count as a match. Scores run from 0
	 * (no match) to 1 (the same text): letters in order but apart score near
	 * 0.2, and a run of the same letters scores 0.6 or more. Defaults to 0.
	 */
	fuzzyThreshold?: number
	locale?: string
}

type Range = { min?: number | null; max?: number | null }
type DateRange = { from?: unknown; to?: unknown }

// Only a plain object is a range. A `Date`, a `Set` or a class instance has no
// own values to read, and would look like a filter that asks for nothing.
function isRecord(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null) return false
	const proto: unknown = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}

function finite(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Whether a filter value asks for nothing, so its column takes no part in the filter. */
export function isEmptyFilter(value: unknown): boolean {
	if (value === null || value === undefined || value === '') return true
	if (Array.isArray(value)) return value.length === 0
	if (isRecord(value)) return Object.values(value).every((part) => isEmptyFilter(part))
	return false
}

function kindOf(value: unknown): FilterKind {
	if (Array.isArray(value)) return 'select'
	if (isRecord(value)) return 'from' in value || 'to' in value ? 'dateRange' : 'range'
	return 'text'
}

function boundTime(value: unknown, endOfDay: boolean): number | undefined {
	if (value === null || value === undefined || value === '') return undefined
	// An end bound without a time of day means the whole day.
	return (endOfDay ? dayEnd(value) : undefined) ?? toTime(value)
}

function matcherFor<Row>(
	column: ColumnDef<Row>,
	filter: unknown,
	options: FilterOptions<Row>,
): (row: Row) => boolean {
	if (typeof column.filter === 'function') {
		const custom: FilterMatcher<Row> = column.filter
		return (row) => custom(cellValue(row, column), filter, row)
	}

	const kind = column.filter ?? kindOf(filter)

	if (kind === 'select') {
		const wanted = new Set((Array.isArray(filter) ? filter : [filter]).map(valueKey))
		return (row) => {
			const value = cellValue(row, column)
			return Array.isArray(value)
				? value.some((part) => wanted.has(valueKey(part)))
				: wanted.has(valueKey(value))
		}
	}

	if (kind === 'range') {
		const range = (isRecord(filter) ? filter : {}) as Range
		// A bound that is not a number is no bound; `NaN` would remove every row.
		const min = finite(range.min) ?? -Infinity
		const max = finite(range.max) ?? Infinity
		return (row) => {
			const value = cellValue(row, column)
			if (typeof value !== 'number' || Number.isNaN(value)) return false
			return min <= value && value <= max
		}
	}

	if (kind === 'dateRange') {
		const { from, to } = (isRecord(filter) ? filter : {}) as DateRange
		let start = boundTime(from, false)
		let end = boundTime(to, true)
		// A range picked backwards still means the days between the two dates.
		if (start !== undefined && end !== undefined && start > end) {
			start = boundTime(to, false)
			end = boundTime(from, true)
		}
		return (row) => {
			const time = boundTime(cellValue(row, column), false)
			if (time === undefined) return false
			return (start ?? -Infinity) <= time && time <= (end ?? Infinity)
		}
	}

	const needle = toText(filter).toLocaleLowerCase(options.locale)
	return (row) => textOf(row, column, options).toLocaleLowerCase(options.locale).includes(needle)
}

function textOf<Row>(row: Row, column: ColumnDef<Row>, options: FilterOptions<Row>): string {
	if (options.text) return options.text(row, column)
	return toText(cellValue(row, column))
}

/**
 * Builds the test a row must pass for the search and the column filters.
 * Returns `null` when nothing is active, so the caller can skip the stage.
 */
export function createRowPredicate<Row>(
	state: FilterState | undefined,
	options: FilterOptions<Row>,
): ((row: Row) => boolean) | null {
	const leaves = leafColumns(options.columns)
	const byId = new Map(leaves.map((column) => [column.id, column]))
	const tests: ((row: Row) => boolean)[] = []

	for (const [id, filter] of Object.entries(state?.columns ?? {})) {
		if (isEmptyFilter(filter)) continue
		const column = byId.get(id)
		if (!column) {
			throw new Error(
				`No column "${id}" to filter. Columns: ${[...byId.keys()].join(', ') || 'none'}.`,
			)
		}
		tests.push(matcherFor(column, filter, options))
	}

	const search = state?.search?.trim()
	if (search) {
		const searchable = leaves.filter((column) => column.searchable !== false)
		if (options.searchMode === 'fuzzy') {
			const threshold = options.fuzzyThreshold ?? 0
			tests.push((row) =>
				searchable.some((column) => fuzzyScore(textOf(row, column, options), search) > threshold),
			)
		} else {
			const needle = search.toLocaleLowerCase(options.locale)
			tests.push((row) =>
				searchable.some((column) =>
					textOf(row, column, options).toLocaleLowerCase(options.locale).includes(needle),
				),
			)
		}
	}

	if (!tests.length) return null
	return (row) => tests.every((test) => test(row))
}

/**
 * Keeps the rows that pass. In a tree, a row that passes keeps its whole
 * subtree, and a row that fails stays when a descendant passes, with only the
 * passing branches under it. When no row is removed, the input array comes
 * back unchanged, so later stages can keep their results.
 */
export function filterRows<Row>(
	rows: readonly DataRow<Row>[],
	predicate: (row: Row) => boolean,
): readonly DataRow<Row>[] {
	let changed = false
	const kept: DataRow<Row>[] = []

	for (const node of rows) {
		if (predicate(node.row)) {
			kept.push(node)
			continue
		}
		if (node.children) {
			const children = filterRows(node.children, predicate)
			if (children.length) {
				// With every child kept, the node is as it was: no new node, and no change to report.
				if (children === node.children) {
					kept.push(node)
				} else {
					kept.push({ ...node, children })
					changed = true
				}
				continue
			}
		}
		changed = true
	}

	return changed ? kept : rows
}
