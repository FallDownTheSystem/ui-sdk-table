import type { FormatName, FormatOptions } from '../format/types'
import type { ColumnDef } from '../rows/types'

/**
 * Why a formula cannot be read, as data. The words come from the code that
 * shows the issue, so the engine holds no language. `at` is the place in the
 * text, counted from 0.
 */
export type FormulaIssue =
	| { code: 'empty' }
	| { code: 'tooLong'; limit: number }
	| { code: 'tooDeep'; at: number; limit: number }
	/** `found` is the text that cannot stand there, or `''` when the formula ends too soon. */
	| { code: 'syntax'; at: number; found: string }
	/** A decimal sign of another language, such as `1.5` where the decimal sign is `,`. */
	| { code: 'decimalSign'; at: number; expected: '.' | ',' }
	/** A sign between arguments that this language does not use. */
	| { code: 'separator'; at: number; expected: ',' | ';' }
	| { code: 'unknownFunction'; at: number; name: string; valid: readonly string[] }
	| { code: 'unknownColumn'; at: number; name: string; valid: readonly string[] }
	/** Two or more columns have this header; `valid` holds their ids. */
	| { code: 'sharedHeader'; at: number; name: string; valid: readonly string[] }
	/** A word that is no function, no column and no value. */
	| { code: 'unknownName'; at: number; name: string }
	| {
			code: 'arguments'
			at: number
			name: string
			min: number
			max: number
			even?: boolean
			given: number
	  }
	/** A reference to another row, or a range, where only the own row can be read. */
	| { code: 'otherRow'; at: number; name: string }
	/** The formula of a column reads that column. */
	| { code: 'cycle'; at: number; name: string }
	/** An address of a row that the document does not hold. `rows` is how many it holds. */
	| { code: 'unknownCell'; at: number; name: string; rows: number }
	/** The formula would read its own cell, directly or through others. `cells` is the path, in addresses. */
	| { code: 'circle'; cells: readonly string[] }
	/** One change would read more cells than `limit`. */
	| { code: 'tooLarge'; reads: number; limit: number }

export type FormulaIssueCode = FormulaIssue['code']

/**
 * The formulas of a table, held as data by the owner, as `cellFormats` is.
 * `columns` holds the formula of a computed column; `cells` the formula of
 * one cell, by row id and then column id. A formula is in the stored form:
 * the ids of the columns in brackets, `.` as the decimal sign and `,`
 * between arguments, the same in every locale.
 */
export type CellFormulas = {
	readonly columns?: Readonly<Record<string, string>>
	readonly cells?: Readonly<Record<string, Readonly<Record<string, string>>>>
}

/** A cell of the table, by ids. */
export type FormulaPlace = { rowId: string; columnId: string }

/**
 * What the engine reads from a table. The table gives it; a test can give a
 * plain object. Every read is by id, and the numbers and letters of the
 * addresses are places in the document: the rows in the order the owner
 * passes them, and the columns in the order of their definition.
 */
export type FormulaSheet = {
	/** The columns as the owner defines them, with the formulas of the columns in place. */
	columns(): readonly ColumnDef[]
	/**
	 * The ids of the rows in the order of the document, children after their
	 * parent. The same array while the rows are the same: the engine keeps
	 * its maps for it.
	 */
	rowIds(): readonly string[]
	/** The row object of an id, or `undefined` for a row that is gone. */
	row(rowId: string): unknown
	/** The value of a cell now: what the table reported in this turn, else the row. */
	value(rowId: string, columnId: string): unknown
	/** The locale of the text that a person types and reads. */
	locale(): string | undefined
}

/** A formula as data of a column, with the columns that it reads and the format its value needs. */
export type FormulaColumn = {
	value: (row: unknown) => unknown
	/** The ids of the columns that the formula reads, directly. */
	reads: readonly string[]
	shows?: {
		format: FormatName
		formatOptions: FormatOptions
	}
}

/** A new formula for a column (a text) or none (`null`). */
export type ColumnFormulaPatch = { columnId: string; formula: string | null }
/** A new formula for a cell (a text) or none (`null`). */
export type CellFormulaPatch = { rowId: string; columnId: string; formula: string | null }

/** The columns with their formulas in place, and why a formula of a column does not run. */
export type FormulaColumns = {
	columns: readonly ColumnDef[]
	/** The issues of a column formula that gives an error in every row, by column id. */
	issues: ReadonlyMap<string, readonly FormulaIssue[]>
}

/** A cell that changed: a new value, or a formula that was set (a text) or taken away (`null`). */
export type FormulaChange = FormulaPlace & { value?: unknown; formula?: string | null }

/** A new value for a formula cell, and the value that the cell held before. */
export type FormulaResult = FormulaPlace & { value: unknown; previous: unknown }

/**
 * The formula engine, as the table knows it. The value of
 * `createFormulaEngine()` of the entry `ui-sdk-table-core/formulas`, so a
 * table without formulas carries no engine.
 */
export type FormulaEngine = {
	/**
	 * Reads the text of a person (address form, in the signs of the locale of
	 * the sheet) or a stored formula, at a cell or for a column, into the
	 * stored form. Or the issues, as data.
	 */
	parse(
		text: string,
		at: FormulaPlace | { columnId: string },
		sheet: FormulaSheet,
	): { formula: string } | { issues: FormulaIssue[] }
	/** The text of a stored formula as a person reads it: addresses for a cell, headers for a column, in the signs of the locale. */
	print(formula: string, at: FormulaPlace | { columnId: string }, sheet: FormulaSheet): string
	/** The value function of a column formula. `columns` are the columns that it can read. */
	column(
		formula: string,
		columnId: string,
		columns: readonly ColumnDef[],
	): FormulaColumn | { issues: FormulaIssue[] }
	/** The value of a formula at a cell. Nothing is written. */
	evaluate(formula: string, at: FormulaPlace, sheet: FormulaSheet): unknown
	/**
	 * The formula cells that follow from changed cells, in an order in which
	 * each comes after the cells it reads, each with its new value. Only a
	 * value that differs from the value of now is in the list. `formulas` are
	 * the formulas after the change.
	 */
	follow(
		changes: readonly FormulaChange[],
		formulas: CellFormulas,
		sheet: FormulaSheet,
	): { results: FormulaResult[] } | { issues: FormulaIssue[] }
	/** The cells that a formula at a cell reads, directly, by ids; for the check of a circle. */
	reads(formula: string, at: FormulaPlace, sheet: FormulaSheet): readonly FormulaPlace[] | undefined
	/** The functions, for a list of a person or an agent. */
	functions(): readonly { name: string; args: string; help: string }[]
	/**
	 * The columns of the owner with the formulas of the `columns` layer in
	 * place. The same columns come back when the layer has no formula for
	 * them, so no stage of the rows runs again.
	 */
	withColumns(columns: readonly ColumnDef[], layer: CellFormulas['columns']): FormulaColumns
	/** A circle that a new formula of a column would make with the other formulas of columns. */
	columnCircle(
		columnId: string,
		formula: string,
		columns: readonly ColumnDef[],
		layer: CellFormulas['columns'],
	): FormulaIssue | undefined
	/** New formulas with the changes put on; `now` itself when nothing changes. */
	setFormulas(
		now: CellFormulas,
		changes: { columns?: readonly ColumnFormulaPatch[]; cells?: readonly CellFormulaPatch[] },
	): CellFormulas
	/** Takes a change of formulas back, or puts it on again, in `now`. */
	revertFormulas(now: CellFormulas, from: CellFormulas, to: CellFormulas): CellFormulas
	/** The words for an issue, in English. */
	describe(issue: FormulaIssue): string
	/** The number of a row in the document, from 1, or `undefined` for a row it does not hold. */
	rowNumber(rowId: string, sheet: FormulaSheet): number | undefined
	/** The address of a cell, such as `D7`, or `undefined` for a column without a letter or a row that is gone. */
	address(place: FormulaPlace, sheet: FormulaSheet): string | undefined
	/** The cell of an address such as `D7` or `$D$7`, or the issue. */
	cellAt(address: string, sheet: FormulaSheet): FormulaPlace | { issues: FormulaIssue[] }
}
