import type { TileCopy } from '../types'

export const tiles: TileCopy[] = [
	{
		id: 'server-pages',
		title: 'Pages from a server.',
		blurb: 'The table holds one page of ten thousand people and asks for the next.',
		size: 'wide',
		tone: 'paper',
	},
	{
		id: 'server-loading',
		title: 'Loading rows.',
		blurb: 'Before the first answer, the table shows what you give it for the wait.',
		tone: 'paper',
	},
	{
		id: 'server-totals',
		title: 'Totals from the server.',
		blurb: 'The page has three rows, and the footer still sums up all four hundred.',
		tone: 'moss',
	},
	{
		id: 'server-facets',
		title: 'Choices from the server.',
		blurb: 'The table holds the filtered rows, and the list still offers every team.',
		tone: 'sand',
	},
]
