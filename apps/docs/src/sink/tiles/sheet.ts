import type { TileCopy } from '../types'

export const tiles: TileCopy[] = [
	{
		id: 'sheet-type',
		title: 'Type over a cell.',
		blurb: 'A character opens the cell, Enter goes down, and an arrow key goes on.',
		size: 'wide',
		tone: 'sand',
	},
	{
		id: 'sheet-fill',
		title: 'Drag to fill.',
		blurb: 'Two numbers go on with their step, and one value repeats.',
		size: 'tall',
		tone: 'moss',
	},
	{
		id: 'sheet-undo',
		title: 'Take it back.',
		blurb: 'An undo reports the old value, as any edit does.',
		tone: 'wine',
	},
	{
		id: 'sheet-formats',
		title: 'Format a range.',
		blurb: 'Bold, a colour and one decimal more are data that the page keeps.',
		size: 'wide',
		tone: 'paper',
	},
	{
		id: 'sheet-sum',
		title: 'Sum a selection.',
		blurb: 'Drag over numbers, and the sum shows after a pause.',
		size: 'tall',
		tone: 'navy',
	},
	{
		id: 'sheet-numbers',
		title: 'Number the rows.',
		blurb: 'A press on a number selects its row, and Shift takes the rows between.',
		tone: 'sun',
	},
	{
		id: 'sheet-letters',
		title: 'Select a column.',
		blurb: 'A press on a letter takes its column, and the corner takes every cell.',
		size: 'wide',
		tone: 'mist',
	},
	{
		id: 'sheet-totals',
		title: 'Pick the total.',
		blurb: 'The footer turns a sum into an average, and the group rows follow.',
		size: 'wide',
		tone: 'plum',
	},
	{
		id: 'sheet-cut',
		title: 'Cut, paste, empty.',
		blurb: 'A cut and a paste move a block, each as one step.',
		tone: 'sand',
	},
	{
		id: 'sheet-saved',
		title: 'Open saved formats.',
		blurb: 'A column shown as a share and two marked cells come with the document.',
		tone: 'paper',
	},
]
