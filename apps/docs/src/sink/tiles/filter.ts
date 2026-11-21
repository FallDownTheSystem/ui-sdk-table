import type { TileCopy } from '../types'

export const tiles: TileCopy[] = [
	{
		id: 'filter-search',
		title: 'Search with a pause.',
		blurb: 'The field shows each letter at once, and the table filters when you stop.',
		size: 'tall',
		tone: 'moss',
	},
	{
		id: 'filter-facet',
		title: 'Filter by a facet.',
		blurb: 'The counts of one list follow the choice in the other.',
		size: 'tall',
		tone: 'sand',
	},
	{
		id: 'filter-range',
		title: 'Slide a price range.',
		blurb: 'The ends and the step of the slider come from the column.',
		tone: 'paper',
	},
	{
		id: 'filter-days',
		title: 'Between two days.',
		blurb: 'The first and the last day of the column bound both fields.',
		tone: 'paper',
	},
	{
		id: 'filter-typos',
		title: 'Typos still match.',
		blurb: 'A fuzzy search finds Stockholm for "stokholm".',
		tone: 'paper',
	},
]
