import type { ColumnDef } from '../rows'

/**
 * A column of row numbers: it leads the table, its cells are the row headers,
 * and no range of cells holds it. Pass what should differ, such as a width.
 */
export function rowNumberColumn<Row = unknown>(
	options: Partial<ColumnDef<Row>> = {},
): ColumnDef<Row> {
	return {
		id: '#',
		header: '',
		width: 48,
		editable: false,
		hideable: false,
		resizable: false,
		reorderable: false,
		searchable: false,
		...options,
		lead: true,
		rowHeader: true,
	}
}

/**
 * The letter of a column as a spreadsheet writes it: 0 is `A`, 25 is `Z`,
 * 26 is `AA`. A text for a header, and no address: the columns of a table
 * have names and ids, and a letter would name other data after a column moved.
 */
export function columnLetter(index: number): string {
	if (!Number.isInteger(index) || index < 0) {
		throw new Error(`A column is counted from 0 in whole numbers, not ${String(index)}.`)
	}
	let letters = ''
	for (let rest = index; rest >= 0; rest = Math.floor(rest / 26) - 1) {
		letters = String.fromCharCode(65 + (rest % 26)) + letters
	}
	return letters
}
