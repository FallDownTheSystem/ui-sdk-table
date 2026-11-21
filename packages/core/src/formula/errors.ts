/**
 * The error values of a formula. An error is this text in the row, so a
 * server, a chart and the next formula read one value and need no engine to
 * see that it is an error.
 */
export const FORMULA_ERRORS = [
	'#DIV/0!',
	'#VALUE!',
	'#REF!',
	'#NAME?',
	'#NUM!',
	'#N/A',
	'#CYCLE!',
] as const

export type FormulaError = (typeof FORMULA_ERRORS)[number]

const errors: ReadonlySet<string> = new Set(FORMULA_ERRORS)

/** Whether a value is one of the error texts of a formula. */
export function isFormulaError(value: unknown): value is FormulaError {
	return typeof value === 'string' && value.charCodeAt(0) === 35 && errors.has(value)
}
