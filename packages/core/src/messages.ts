import type { ColumnReorderMessage } from './behaviors/reorder'

/**
 * Every text that the table itself writes: names of controls and messages
 * for screen readers. Each entry is a function, so a translation can put the
 * parts in the order of its language.
 */
export type TableMessages = {
	/** What the body says when no row passes the filters. */
	noRows: () => string
	/** The name of the resize handle of a column. */
	resizeColumn: (column: string) => string
	/** What a screen reader says after a column gets a new width. */
	columnResized: (details: { column: string; width: number }) => string
	/** What a screen reader says while a column moves. */
	columnMoved: (details: ColumnReorderMessage) => string
}

export const defaultMessages: TableMessages = {
	noRows: () => 'No rows.',
	resizeColumn: (column) => `Resize ${column}`,
	columnResized: ({ column, width }) => `${column}, ${width} pixels wide.`,
	columnMoved: ({ type, label, position, total }) => {
		if (type === 'grab') return `Picked up ${label}, column ${position} of ${total}.`
		if (type === 'drop') return `Dropped ${label} at column ${position} of ${total}.`
		if (type === 'cancel') return `${label} is back at column ${position} of ${total}.`
		return `${label}, column ${position} of ${total}.`
	},
}
