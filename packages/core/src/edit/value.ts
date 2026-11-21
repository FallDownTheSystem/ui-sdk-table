import { cellValue, toText, type ColumnDef } from '../rows'
import { checkValue, type Checked } from './schema'

const NUMBER_FORMATS: readonly string[] = ['integer', 'decimal', 'number', 'currency', 'percentage']

/** The text that the editor of a cell starts with: the value as plain text, without the format of the column. */
export function editText(row: unknown, column: ColumnDef): string {
	return toText(cellValue(row, column))
}

/**
 * The value that a text stands for in a column. The `parse` of the column
 * decides. Without it, the value that the cell holds now decides: a number
 * stays a number, a boolean a boolean, a date a date, and anything else gets
 * the text.
 */
export function parseText(
	text: string,
	row: unknown,
	column: ColumnDef,
	notNumber: (text: string) => string,
): Checked {
	if (column.parse) return { value: column.parse(text, row) }
	const current = cellValue(row, column)
	const numeric =
		typeof current === 'number' ||
		(current == null && !!column.format && NUMBER_FORMATS.includes(column.format))
	if (numeric) {
		const trimmed = text.trim()
		if (trimmed === '') return { value: null }
		const value = Number(trimmed)
		return Number.isNaN(value) ? { issues: [notNumber(text)] } : { value }
	}
	if (typeof current === 'boolean') {
		const word = text.trim().toLowerCase()
		if (word === 'true' || word === 'false') return { value: word === 'true' }
		return { issues: ['The value must be "true" or "false".'] }
	}
	if (current instanceof Date) {
		const value = new Date(text)
		return Number.isNaN(value.getTime()) ? { issues: [`"${text}" is not a date.`] } : { value }
	}
	return { value: text }
}

/** Whether two cell values are the same value, so an edit from one to the other changes nothing. */
export function sameValue(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true
	if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
	// An empty cell holds `null`, `undefined` or no text, and each of them shows the same.
	const empty = (value: unknown) => value == null || value === ''
	return empty(a) && empty(b)
}

/**
 * Parses a text when the input is a text, and checks the value with the
 * schema of the column. The answer is a promise only when the schema itself
 * answers with one.
 */
export function resolveValue(
	input: { text: string } | { value: unknown },
	row: unknown,
	column: ColumnDef,
	notNumber: (text: string) => string,
): Checked | Promise<Checked> {
	const parsed = 'text' in input ? parseText(input.text, row, column, notNumber) : input
	if ('issues' in parsed) return parsed
	return checkValue(column.schema, parsed.value)
}
