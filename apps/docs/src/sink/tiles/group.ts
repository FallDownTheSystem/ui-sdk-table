import type { TileCopy } from '../types'

export const tiles: TileCopy[] = [
	{
		id: 'group-totals',
		title: 'Totals under their columns.',
		blurb: 'Each city adds up its orders under the header, over the total of the footer.',
		size: 'large',
		tone: 'paper',
	},
	{
		id: 'group-path',
		title: 'Groups name their path.',
		blurb: 'A team inside a country reads "Finland / Design".',
		tone: 'mist',
	},
	{
		id: 'group-switch',
		title: 'Group by anything.',
		blurb: 'Pick the column, then open or close every group at once.',
		size: 'wide',
		tone: 'moss',
	},
	{
		id: 'group-select',
		title: 'Select a whole group.',
		blurb: 'The box of a group picks its rows, and so does Space on its row.',
		size: 'tall',
		tone: 'mist',
	},
	{
		id: 'group-label',
		title: 'Totals in the label.',
		blurb: 'One wide cell for each group, with a mean and a count of your own.',
		size: 'wide',
		tone: 'wine',
	},
]
