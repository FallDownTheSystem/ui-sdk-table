import type { FormulaIssue } from '../formula/types'

const list = (names: readonly string[]) => names.join(', ') || 'none'

function takes(min: number, max: number, even?: boolean): string {
	if (even) return `pairs of values, at least ${min}`
	if (min === max) return `${min} ${min === 1 ? 'value' : 'values'}`
	if (max === min + 1) return `${min} or ${max} values`
	if (max >= 255) return `at least ${min} ${min === 1 ? 'value' : 'values'}`
	return `${min} to ${max} values`
}

/**
 * The words for an issue of a formula, in English. Each names what is valid,
 * so a person or an agent can correct the formula without other help.
 */
export function describeFormulaIssue(issue: FormulaIssue): string {
	switch (issue.code) {
		case 'empty':
			return 'The formula is empty. Write it after `=`, such as =[price]*[qty].'
		case 'tooLong':
			return `A formula holds at most ${issue.limit} characters.`
		case 'tooDeep':
			return `A formula nests at most ${issue.limit} levels of brackets and functions.`
		case 'syntax':
			return issue.found === ''
				? 'The formula ends too soon.'
				: `\`${issue.found}\` cannot stand at character ${issue.at + 1}.`
		case 'decimalSign':
			return `This language writes a decimal number with \`${issue.expected}\`, such as 1${issue.expected}5.`
		case 'separator':
			return `This language puts \`${issue.expected}\` between the values of a function, such as IF([a]>1${issue.expected} "yes"${issue.expected} "no").`
		case 'unknownFunction':
			return `No function \`${issue.name}\`. Functions: ${list(issue.valid)}.`
		case 'unknownColumn':
			return `No column \`${issue.name}\`. Columns: ${list(issue.valid)}.`
		case 'sharedHeader':
			return `More than one column has the header \`${issue.name}\`. Write the id of one of them: ${issue.valid.map((id) => `[${id}]`).join(', ')}.`
		case 'unknownName':
			return `No name \`${issue.name}\`. Write a column in brackets, such as [${issue.name}], and a text in quotes, such as "${issue.name}".`
		case 'arguments':
			return `\`${issue.name}\` takes ${takes(issue.min, issue.max, issue.even)}, not ${issue.given}.`
		case 'otherRow':
			return `\`${issue.name}\` names another row or a range of cells. This formula reads the cells of its own row only.`
		case 'cycle':
			return `The formula of column \`${issue.name}\` reads that column itself.`
	}
}
