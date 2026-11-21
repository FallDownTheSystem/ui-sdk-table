// The formula engine, an entry of its own: a table without formulas does not
// carry it. No file outside this folder imports from it (`formulas-entry.test.ts`).
export { FORMULA_ERRORS, isFormulaError, type FormulaError } from '../formula/errors'
export type { FormulaIssue, FormulaIssueCode } from '../formula/types'
export { formulaColumn, type FormulaColumnDef } from './column'
export {
	compileRowFormula,
	parseFormula,
	printFormula,
	type FormulaOptions,
	type FormulaTextOptions,
} from './compile'
export { FORMULA_FUNCTIONS, type FormulaFunctionInfo } from './functions'
export { formulaShows, type FormulaShows } from './kinds'
export { formulaSigns, type FormulaSigns } from './tokens'
export { describeFormulaIssue } from './words'
