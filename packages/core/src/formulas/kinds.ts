import type { FormatName, FormatOptions, PeriodUnit } from '../format/types'
import { timeZoneOf } from '../rows/columns'
import type { ColumnDef } from '../rows/types'
import { namedColumns, parseTree, type FormulaNode } from './parser'
import { STORED_SIGNS } from './tokens'

export type FormulaShows = {
	/** The format that the value needs. */
	format: FormatName
	/** The options of that format, such as the unit of a period. */
	formatOptions: FormatOptions
}

const PERIODS: Readonly<Record<string, PeriodUnit>> = {
	DAYOF: 'day',
	WEEKOF: 'week',
	MONTHOF: 'month',
	QUARTEROF: 'quarter',
	YEAROF: 'year',
	HOUROF: 'hour',
}

const same = (a: FormulaShows | undefined, b: FormulaShows | undefined) =>
	!!a && !!b && JSON.stringify(a) === JSON.stringify(b)

/**
 * The format that the value of a formula needs: `period` for a function of
 * a period, and for `WEEKDAY` with a type written in the formula. `IF`,
 * `IFS` and `SWITCH` pass it on when all their results agree. Anything else
 * needs no format of its own.
 */
export function formulaShows(
	formula: string,
	columns: readonly ColumnDef<never>[],
	timeZone: string | undefined,
): FormulaShows | undefined {
	const parsed = parseTree(formula, { columns, signs: STORED_SIGNS })
	if ('issues' in parsed) return undefined
	const byId = new Map(namedColumns(columns).map((column) => [column.id, column]))
	const zoneOf = (node: FormulaNode | undefined) => {
		const column = node?.kind === 'column' ? byId.get(node.id) : undefined
		return (column && timeZoneOf(column)) ?? timeZone
	}
	const walk = (node: FormulaNode): FormulaShows | undefined => {
		if (node.kind === 'group') return walk(node.inner)
		if (node.kind !== 'call') return undefined
		const unit = PERIODS[node.name]
		if (unit === 'hour') {
			const zone = zoneOf(node.args[0])
			return { format: 'period', formatOptions: zone ? { unit, timeZone: zone } : { unit } }
		}
		if (unit) return { format: 'period', formatOptions: { unit } }
		if (node.name === 'WEEKDAY') {
			const type = node.args[1]
			if (type && type.kind !== 'number') return undefined
			return { format: 'period', formatOptions: { unit: 'weekday', weekdays: type?.value ?? 1 } }
		}
		// The results of a condition: the 2nd and 3rd of IF, every 2nd of IFS, and of SWITCH the
		// results after the value with the default at the end.
		let results: FormulaNode[] = []
		if (node.name === 'IF') results = node.args.slice(1)
		else if (node.name === 'IFS') results = node.args.filter((_, index) => index % 2 === 1)
		else if (node.name === 'SWITCH') {
			results = node.args.filter(
				(_, index) => index > 0 && (index % 2 === 0 || index === node.args.length - 1),
			)
		}
		if (node.name === 'IF' && results.length < 2) return undefined
		const kinds = results.map(walk)
		const first = kinds[0]
		return first && kinds.every((kind) => same(kind, first)) ? first : undefined
	}
	return walk(parsed.tree)
}
