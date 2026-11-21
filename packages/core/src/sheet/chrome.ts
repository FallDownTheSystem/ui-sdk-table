import { isLead, type ColumnLayout } from '../columns/layout'
import { leafColumns, type ColumnDef } from '../rows'

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

/**
 * Which letter each column shows in the row of letters, by column id. This
 * is the one rule for it, and every part of the table reads it here: the
 * text of a letter cell, its name, and which cells a press on it selects.
 *
 * A letter is the place of a column among the columns in view, counted
 * without the columns that lead the table (row numbers, a checkbox): those
 * have no letter. A column that moves or that stands after a hidden column
 * takes the letter of its new place, as the rows take their numbers.
 *
 * With `document`, the columns of the owner in the order of their
 * definition, a letter is an address of a formula instead: the place among
 * those columns, also without the columns that lead. A hidden column keeps
 * its letter, so the row of letters shows a gap (A, C), and a column that
 * moved keeps it too (A, C, B).
 */
export function lettersByColumn(
	layout: ColumnLayout,
	document?: readonly ColumnDef[],
): ReadonlyMap<string, string> {
	return document ? documentLetters(document) : lettersOf(layout.leaves)
}

/** The letters of the columns of the owner, in the order of their definition: the addresses of a formula. */
export function documentLetters(columns: readonly ColumnDef[]): ReadonlyMap<string, string> {
	return lettersOf(leafColumns(columns))
}

function lettersOf(columns: readonly ColumnDef[]): ReadonlyMap<string, string> {
	const letters = new Map<string, string>()
	for (const column of columns) {
		if (isLead(column)) continue
		letters.set(column.id, columnLetter(letters.size))
	}
	return letters
}
