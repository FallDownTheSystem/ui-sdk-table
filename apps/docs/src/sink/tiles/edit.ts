import type { TileCopy } from '../types'

export const tiles: TileCopy[] = [
	{
		id: 'edit-price',
		title: 'Edit a price.',
		blurb: 'Enter opens a cell, Enter saves it, and a price below zero is refused.',
		size: 'wide',
		tone: 'clay',
	},
	{
		id: 'edit-paste',
		title: 'Paste a block.',
		blurb: 'Six cells from a spreadsheet land at once, or none of them does.',
		tone: 'sand',
	},
	{
		id: 'edit-range',
		title: 'Select a range.',
		blurb: 'Drag over cells, or hold Shift with the arrow keys.',
		size: 'wide',
		tone: 'paper',
	},
	{
		id: 'edit-check',
		title: 'Ask the server first.',
		blurb: 'A name that is taken comes back with the reason, after a wait.',
		tone: 'paper',
	},
	{
		id: 'edit-switch',
		title: 'Flip it in place.',
		blurb: 'A switch in a cell reports an edit like any other.',
		tone: 'mist',
	},
	{
		id: 'edit-day',
		title: 'Bring your own editor.',
		blurb: 'A date field takes the place of the text field of the table.',
		tone: 'sun',
	},
]
