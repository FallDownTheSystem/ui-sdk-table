import { CONDITION_FUNCTIONS } from './conditions'
import { DATE_FUNCTIONS } from './dates'
import { LOGIC_FUNCTIONS } from './logic'
import { LOOKUP_FUNCTIONS } from './lookup'
import { MATH_FUNCTIONS } from './math'
import type { FormulaFunction } from './shared'
import { TEXT_FUNCTIONS } from './text'
import type {
	FormulaArgument,
	FormulaFunctionGroup,
	FormulaFunctionInfo,
} from '../../formula/types'

export type { CellReader, FormulaArgs, FormulaContext, FormulaFunction } from './shared'
export type { FormulaArgument, FormulaFunctionGroup, FormulaFunctionInfo }

const GROUPS: readonly [FormulaFunctionGroup, Record<string, FormulaFunction>][] = [
	['math', MATH_FUNCTIONS],
	['condition', CONDITION_FUNCTIONS],
	['lookup', LOOKUP_FUNCTIONS],
	['logic', LOGIC_FUNCTIONS],
	['text', TEXT_FUNCTIONS],
	['date', DATE_FUNCTIONS],
]

/** Every function of the engine, by its name in capital letters. */
export const FUNCTIONS: Readonly<Record<string, FormulaFunction>> = Object.assign(
	{},
	...GROUPS.map(([, functions]) => functions),
)

/**
 * The arguments of `args` as a list: a name in `[...]` is optional, and the
 * names of the `[...]` before `…` repeat.
 */
function argumentsOf(args: string): FormulaArgument[] {
	const list: FormulaArgument[] = []
	let group: FormulaArgument[] = []
	for (const part of args.match(/\[[^\]]*\]|[^,\s][^,]*/g) ?? []) {
		if (part.trim() === '…') {
			for (const argument of group) argument.repeats = true
			continue
		}
		const optional = part.startsWith('[')
		group = (optional ? part.slice(1, -1) : part)
			.split(',')
			.map((name) => ({ name: name.trim(), optional, repeats: false }))
		list.push(...group)
	}
	return list
}

/** The functions as a list for a person or an agent: a name, its arguments and one line of help. */
export const FORMULA_FUNCTIONS: readonly FormulaFunctionInfo[] = GROUPS.flatMap(
	([group, functions]) =>
		Object.entries(functions).map(([name, fn]) => ({
			name,
			args: fn.args,
			help: fn.help,
			group,
			arguments: argumentsOf(fn.args),
		})),
).sort((a, b) => (a.name < b.name ? -1 : 1))

/**
 * The place in `arguments` of the argument of a call at index `index`, from
 * 0: a repeated argument counts again in its group. `undefined` past the
 * last argument.
 */
export function argumentAt(info: FormulaFunctionInfo, index: number): number | undefined {
	const list = info.arguments
	const first = list.findIndex((argument) => argument.repeats)
	if (index < list.length && (first < 0 || index < first)) return index
	if (first < 0) return undefined
	let count = 0
	while (list[first + count]?.repeats) count++
	return first + ((index - first) % count)
}
