import type { TileCopy } from '../types'

export const tiles: TileCopy[] = [
	{
		id: 'sort-two-columns',
		title: 'Sort by two columns.',
		blurb: 'Press a header, then hold Shift and press another.',
		size: 'wide',
		tone: 'mist',
	},
	{
		id: 'sort-always',
		title: 'Always sorted.',
		blurb: 'A press turns the order and never clears it.',
		tone: 'navy',
	},
	{
		id: 'sort-mode',
		title: 'Pick a sort mode.',
		blurb: 'One column at a time, more with a key, or every press adds one.',
		size: 'wide',
		tone: 'sand',
	},
	{
		id: 'sort-own-order',
		title: 'Sort by urgency.',
		blurb: 'The column brings its own order, so Urgent comes before Low.',
		tone: 'paper',
	},
]
