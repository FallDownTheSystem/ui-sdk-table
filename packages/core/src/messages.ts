import type { ColumnReorderMessage } from './behaviors/reorder'
import type { FormulaIssue } from './formula/types'

/**
 * Every text that the table itself writes: names of controls and messages
 * for screen readers. Each entry is a function, so a translation can put the
 * parts in the order of its language.
 */
export type TableMessages = {
	/**
	 * The words for an issue of a formula. Without it, the words of the
	 * engine: a table without formulas carries none.
	 */
	formulaIssue?: (issue: FormulaIssue) => string
	/** What the body says when no row passes the filters. */
	noRows: () => string
	/** What the body says while the first rows are on their way. */
	loading: () => string
	/** The name of the button that opens a row with child rows or a detail row. */
	expandRow: () => string
	/** The name of the button that closes such a row. */
	collapseRow: () => string
	/** The sign on the button of a closed row. */
	expandSign: () => string
	/** The sign on the button of an open row. */
	collapseSign: () => string
	/** The text of a group row: the value of the group and how many rows it holds. */
	groupRow: (details: { text: string; count: number }) => string
	/** The name of the resize handle of a column. */
	resizeColumn: (column: string) => string
	/** What a screen reader says after a column gets a new width. */
	columnResized: (details: { column: string; width: number }) => string
	/** What a screen reader says while a column moves. */
	columnMoved: (details: ColumnReorderMessage) => string
	/** The name of the text field that edits a cell. */
	editCell: (details: { column: string }) => string
	/** Why a text is refused in a column of numbers. */
	notNumber: (text: string) => string
	/** Why a text is refused in a cell that holds a date. */
	notDate: (text: string) => string
	/** Why a text is refused in a cell that holds true or false. */
	notBoolean: (text: string) => string
	/** Why a value is refused when its schema gives no message. */
	invalidValue: () => string
	/** Why an edit is refused when a listener of `onCellEdit` cancels it. */
	editRefused: () => string
	/** What a screen reader says after the range of cells changed from the keyboard. */
	cellsSelected: (details: { rows: number; columns: number }) => string
	/** What a screen reader says after a copy. */
	cellsCopied: (details: { cells: number }) => string
	/** What a screen reader says after a paste. */
	cellsPasted: (details: { cells: number }) => string
	/** Why a paste did nothing: one of its values was refused. */
	pasteRefused: (details: { column: string; text: string; message: string }) => string
	/** Why a paste did nothing: no cell under it can be edited. */
	pasteNowhere: () => string
	/** Why a paste did nothing: the text has more rows or columns than the table has from the first cell on. */
	pasteTooLarge: (details: { rows: number; columns: number }) => string
	/** Why a paste did nothing: a row under it is a group row or a detail row, which holds no values. */
	pasteOverRow: () => string
	/** Why an edit was not saved: its row left the table while the value was checked. */
	editRowGone: () => string
	/** What a screen reader says after Delete or `clearCells` emptied cells. */
	cellsCleared: (details: { cells: number }) => string
	/** What a screen reader says after a cut. */
	cellsCut: (details: { cells: number }) => string
	/** Why a clear or a cut did nothing: a column refuses an empty value. */
	clearRefused: (details: { column: string; message: string }) => string
	/** Why a clear or a cut did nothing: no cell under it can be edited. */
	clearNowhere: () => string
	/**
	 * What a screen reader says after an undo. `cells` got their old value
	 * back, `gone` of the step are not in the table any more, and `hidden` of
	 * the cells that changed are not in view: a filter, a page or a closed row
	 * hides them.
	 */
	undone: (details: { cells: number; gone: number; hidden: number }) => string
	/** What a screen reader says after a redo. */
	redone: (details: { cells: number; gone: number; hidden: number }) => string
	/** Why an undo or a redo did nothing: a listener of `onCellEdit` refused it. */
	undoRefused: () => string
	nothingToUndo: () => string
	nothingToRedo: () => string
	/** Why an undo or a redo must wait: the check of a new value runs. */
	historyBusy: () => string
	/** What a screen reader says when one change holds more cells than the history keeps, so it cannot be undone. */
	historyTooLarge: (details: { cells: number }) => string
	/** The name of the header of a row: its number, from 1. A screen reader says it with each cell of the row. */
	rowNumber: (details: { number: number }) => string
	/** The name of the corner cell of the row of letters, which selects every cell. */
	cornerCell: () => string
	/** What a screen reader says after a fill. */
	cellsFilled: (details: { cells: number }) => string
	/** Why a fill did nothing: a column refuses one of its values. */
	fillRefused: (details: { column: string; text: string; message: string }) => string
	/** Why a fill did nothing: no cell under it can be edited. */
	fillNowhere: () => string
	/** Why a fill did nothing: it would go from pinned rows to rows of the list, which are no neighbours in the data. */
	fillOverPinned: () => string
	/** What a screen reader says after the formats of cells changed from a key or from code. */
	cellsFormatted: (details: { cells: number }) => string
	/**
	 * The name of a function of the sum row, for a picker and for the name of
	 * a footer cell: `sum`, `mean`, `min`, `max`, `count`, `uniqueCount`,
	 * `first`, or `custom` for a function of the column.
	 */
	aggregateLabel: (name: string) => string
	/** The name of a footer cell whose function a person chose: the function and the total. */
	totalLabel: (details: { label: string; text: string }) => string
}

const cellCount = (cells: number) => (cells === 1 ? '1 cell' : `${cells} cells`)

const AGGREGATE_LABELS: Readonly<Record<string, string>> = {
	sum: 'Sum',
	mean: 'Average',
	min: 'Smallest',
	max: 'Largest',
	count: 'Count',
	uniqueCount: 'Different values',
	first: 'First',
}

/** What an undo or a redo did, in one text: the cells that changed, then the ones that could not, then the ones out of view. */
function stepText(
	{ cells, gone, hidden }: { cells: number; gone: number; hidden: number },
	how: string,
): string {
	const parts = [cells ? `${cellCount(cells)} changed ${how}.` : `No cell changed ${how}.`]
	if (gone) parts.push(`${cellCount(gone)} ${gone === 1 ? 'is' : 'are'} not in the table any more.`)
	if (hidden) parts.push(`${cellCount(hidden)} of them ${hidden === 1 ? 'is' : 'are'} not in view.`)
	return parts.join(' ')
}

export const defaultMessages: TableMessages = {
	noRows: () => 'No rows.',
	loading: () => 'Loading rows.',
	expandRow: () => 'Expand row',
	collapseRow: () => 'Collapse row',
	expandSign: () => '+',
	collapseSign: () => '−',
	groupRow: ({ text, count }) => `${text} (${count})`,
	resizeColumn: (column) => `Resize ${column}`,
	columnResized: ({ column, width }) => `${column}, ${width} pixels wide.`,
	columnMoved: ({ type, label, position, total }) => {
		if (type === 'grab') return `Picked up ${label}, column ${position} of ${total}.`
		if (type === 'drop') return `Dropped ${label} at column ${position} of ${total}.`
		if (type === 'cancel') return `${label} is back at column ${position} of ${total}.`
		return `${label}, column ${position} of ${total}.`
	},
	editCell: ({ column }) => `Edit ${column}`,
	notNumber: (text) => `"${text}" is not a number.`,
	notDate: (text) =>
		`"${text}" is not a date. Write it as 2026-01-31, with a time after it or not.`,
	notBoolean: () => 'The value must be "true" or "false".',
	invalidValue: () => 'This value is not valid.',
	editRefused: () => 'The change was not saved.',
	cellsSelected: ({ rows, columns }) =>
		rows * columns === 1
			? '1 cell selected.'
			: `${rows} ${rows === 1 ? 'row' : 'rows'} by ${columns} ${columns === 1 ? 'column' : 'columns'} selected.`,
	cellsCopied: ({ cells }) => (cells === 1 ? '1 cell copied.' : `${cells} cells copied.`),
	cellsPasted: ({ cells }) => (cells === 1 ? '1 cell changed.' : `${cells} cells changed.`),
	pasteRefused: ({ column, text, message }) =>
		`Nothing was pasted. ${column} refuses "${text}": ${message}`,
	pasteNowhere: () => 'Nothing was pasted. No cell here can be edited.',
	pasteTooLarge: ({ rows, columns }) =>
		`Nothing was pasted. The text has ${rows} ${rows === 1 ? 'row' : 'rows'} and ${columns} ${columns === 1 ? 'column' : 'columns'}, and the table has fewer from this cell on.`,
	pasteOverRow: () => 'Nothing was pasted. A row here holds no values.',
	editRowGone: () => 'The change was not saved. The row is not in the table any more.',
	cellsCleared: ({ cells }) => `${cellCount(cells)} cleared.`,
	cellsCut: ({ cells }) => `${cellCount(cells)} cut.`,
	clearRefused: ({ column, message }) =>
		`Nothing was cleared. ${column} refuses an empty value: ${message}`,
	clearNowhere: () => 'Nothing was cleared. No cell here can be edited.',
	undone: (details) => stepText(details, 'back'),
	redone: (details) => stepText(details, 'again'),
	undoRefused: () => 'The change was not taken back.',
	nothingToUndo: () => 'Nothing to undo.',
	nothingToRedo: () => 'Nothing to redo.',
	historyBusy: () => 'A value is checked now. Undo and redo wait for the answer.',
	historyTooLarge: ({ cells }) =>
		`A change of ${cellCount(cells)} is too large to undo. The history is empty now.`,
	rowNumber: ({ number }) => `Row ${number}`,
	cornerCell: () => 'All cells',
	cellsFilled: ({ cells }) => `${cellCount(cells)} filled.`,
	fillRefused: ({ column, text, message }) =>
		`Nothing was filled. ${column} refuses "${text}": ${message}`,
	fillNowhere: () => 'Nothing was filled. No cell here can be edited.',
	fillOverPinned: () =>
		'Nothing was filled. A fill cannot go from pinned rows to the rows of the list.',
	cellsFormatted: ({ cells }) => `${cellCount(cells)} formatted.`,
	aggregateLabel: (name) => AGGREGATE_LABELS[name] ?? 'Total',
	totalLabel: ({ label, text }) => `${label}: ${text}`,
}
