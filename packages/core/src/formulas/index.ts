// The formula engine, an entry of its own: a table without formulas does not
// carry it. No file outside this folder imports from it (`formulas-entry.test.ts`).
export { FORMULA_ERRORS, isFormulaError, type FormulaError } from '../formula/errors'
export type {
	CellFormulas,
	FormulaEngine,
	FormulaIssue,
	FormulaIssueCode,
	FormulaSheet,
	FormulaArgument,
	FormulaFunctionGroup,
	FormulaReference,
	FormulaReferenceMark,
} from '../formula/types'
export { formulaColumn, type FormulaColumnDef } from './column'
export { createFormulaEngine, type FormulaEngineOptions } from './engine'
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
export {
	formulaHelp,
	insertReference,
	type FormulaHelp,
	type FormulaHelpOptions,
	type FormulaToken,
	type FormulaTokenKind,
} from './writer'
export { describeFormulaIssue } from './words'
export { formulaAt, pruneFormulas, revertFormulas, setFormulas } from './state'
export { EXCEL_FUNCTIONS, excelFormulas } from './excel'
