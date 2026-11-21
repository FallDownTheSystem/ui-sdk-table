import type { TileCopy } from '../types'

export const tiles: TileCopy[] = [
	{
		id: 'columns-pin',
		title: 'Pin the name.',
		blurb: 'It stays at the start while the other columns scroll sideways.',
		tone: 'moss',
	},
	{
		id: 'columns-drag',
		title: 'Drag a header.',
		blurb: 'Or pick it up with Space and move it with the arrow keys.',
		size: 'wide',
		tone: 'clay',
	},
	{
		id: 'columns-resize',
		title: 'Resize a column.',
		blurb: 'Drag the bar at the end of a header, or hold Alt and press an arrow.',
		size: 'wide',
		tone: 'mist',
	},
	{
		id: 'columns-hide',
		title: 'Hide all, then reset.',
		blurb: 'The name cannot be hidden, and the reset knows where the table started.',
		tone: 'ink',
	},
	{
		id: 'columns-groups',
		title: 'Headers over headers.',
		blurb: 'A header group stands over its columns and moves with them.',
		size: 'wide',
		tone: 'paper',
	},
	{
		id: 'columns-formats',
		title: 'Format every value.',
		blurb: 'Money, a share, a day, a link and a yes or no, each from one word.',
		size: 'wide',
		tone: 'sun',
	},
]
