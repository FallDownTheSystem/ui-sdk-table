import { CONDITION_FUNCTIONS } from './conditions'
import { DATE_FUNCTIONS } from './dates'
import { LOGIC_FUNCTIONS } from './logic'
import { LOOKUP_FUNCTIONS } from './lookup'
import { MATH_FUNCTIONS } from './math'
import type { FormulaFunction } from './shared'
import { TEXT_FUNCTIONS } from './text'

export type { CellReader, FormulaArgs, FormulaContext, FormulaFunction } from './shared'

/** Every function of the engine, by its name in capital letters. */
export const FUNCTIONS: Readonly<Record<string, FormulaFunction>> = {
	...MATH_FUNCTIONS,
	...CONDITION_FUNCTIONS,
	...LOOKUP_FUNCTIONS,
	...LOGIC_FUNCTIONS,
	...TEXT_FUNCTIONS,
	...DATE_FUNCTIONS,
}

export type FormulaFunctionInfo = { name: string; args: string; help: string }

/** The functions as a list for a person or an agent: a name, its arguments and one line of help. */
export const FORMULA_FUNCTIONS: readonly FormulaFunctionInfo[] = Object.keys(FUNCTIONS)
	.sort()
	.map((name) => ({ name, args: FUNCTIONS[name]?.args ?? '', help: FUNCTIONS[name]?.help ?? '' }))
