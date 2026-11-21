import type { TileCopy } from '../types'

// Formulas as in a spreadsheet: computed columns, periods of a date, and formulas in cells.
export const tiles: TileCopy[] = [
	{
		id: 'formula-period',
		title: 'Group by the week.',
		blurb: 'A formula turns each day into its week, month, quarter or year, and the groups sum up.',
		size: 'tall',
		tone: 'moss',
	},
	{
		id: 'formula-sheet',
		title: 'Type a formula.',
		blurb: 'Type =SUM(D1:D14) in a cell or in the bar, and the cells that read it follow.',
		size: 'large',
		tone: 'paper',
	},
	{
		id: 'formula-column',
		title: 'Compute a column.',
		blurb: 'A total from price and quantity, and a band from IFS, for every row that comes.',
		size: 'wide',
		tone: 'sand',
	},
	{
		id: 'formula-errors',
		title: 'Catch a broken formula.',
		blurb: 'A division by zero shows its code, and a circle is refused with its path.',
		tone: 'ink',
	},
	{
		id: 'formula-locale',
		title: 'Type a decimal comma.',
		blurb: 'The formula is the same in every language; only its signs change.',
		tone: 'navy',
	},
	{
		id: 'formula-own',
		title: 'Write a column formula.',
		blurb: 'The formula of a column is state: set it here or in one of its cells, and undo it.',
		size: 'wide',
		tone: 'mist',
	},
	{
		id: 'formula-file',
		title: 'Open a saved sheet.',
		blurb:
			'Totals saved by another program are checked again, and the Excel file keeps the formulas.',
		size: 'large',
		tone: 'sun',
	},
]
