import type { ColumnDef } from '../rows/types'
import { compileRowFormula, type FormulaOptions } from './compile'
import { keptByRow } from './engine'
import { formulaShows } from './kinds'

export type FormulaColumnDef<Row> = Omit<ColumnDef<Row>, 'value' | 'key' | 'editable'> & {
	/** The formula of each cell of the column in the stored form, such as `=[price]*[qty]`. */
	formula: string
}

/**
 * A column whose value is a formula of its own row: a computed column, for
 * code that knows the formula when it writes the columns. `columns` are the
 * columns that the formula can name, by id or by header.
 *
 * The value of a row is computed once for each row object and kept. An owner
 * that changes a row passes a new object for it, as the table asks, and the
 * new object is computed again; a row changed inside its old object keeps
 * its old value. The cells cannot be edited. A formula whose value is a
 * period, such as `=WEEKOF([created], 2)`, gets the format `period` when the
 * definition has no `format`. It throws when the formula cannot be read,
 * with the words that say why.
 */
export function formulaColumn<Row>(
	definition: FormulaColumnDef<Row>,
	columns: readonly ColumnDef<Row>[],
	options: FormulaOptions = {},
): ColumnDef<Row> {
	const { formula, ...column } = definition
	const run = compileRowFormula(formula, columns, { ...options, self: definition.id })
	const shows =
		column.format === undefined
			? formulaShows(formula, columns as readonly ColumnDef<never>[], options.timeZone)
			: undefined
	return {
		...shows,
		...column,
		editable: false,
		value: keptByRow(run as (row: unknown) => unknown),
	}
}
