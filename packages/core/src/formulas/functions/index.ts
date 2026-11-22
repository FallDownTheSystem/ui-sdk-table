import { DATE_FUNCTIONS } from './dates'
import { LOGIC_FUNCTIONS } from './logic'
import { MATH_FUNCTIONS } from './math'
import type { FormulaFunction } from './shared'
import { TEXT_FUNCTIONS } from './text'

export type { CellReader, FormulaArgs, FormulaContext, FormulaFunction } from './shared'

/** Every function of the engine, by its name in capital letters. */
export const FUNCTIONS: Readonly<Record<string, FormulaFunction>> = {
	...MATH_FUNCTIONS,
	...LOGIC_FUNCTIONS,
	...TEXT_FUNCTIONS,
	...DATE_FUNCTIONS,
}

export type FormulaFunctionInfo = {
	/** The name of the function, such as `SUM`. */
	name: string
	/** Its arguments as a person writes them, such as `number, ...`. */
	args: string
	/** One line that says what it gives. */
	help: string
}

/** The functions as a list for a person or an agent: a name, its arguments and one line of help. */
export const FORMULA_FUNCTIONS: readonly FormulaFunctionInfo[] = Object.keys(FUNCTIONS)
	.sort()
	.map((name) => ({ name, args: FUNCTIONS[name]?.args ?? '', help: FUNCTIONS[name]?.help ?? '' }))
