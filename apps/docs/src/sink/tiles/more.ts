import type { TileCopy } from '../types'

export const tiles: TileCopy[] = [
	{
		id: 'more-agent',
		title: 'Let an agent sort.',
		blurb:
			'It finds the table by its name; a wrong column gets an error that lists the right ones.',
		size: 'wide',
		tone: 'plum',
	},
	{
		id: 'more-export',
		title: 'Export a file.',
		blurb: 'The rows as you see them, as CSV or Excel, with writers that load on the first press.',
		tone: 'pine',
		size: 'wide',
	},
	{
		id: 'more-rtl',
		title: 'Right to left.',
		blurb: 'The start is on the right, and a pinned column sticks there.',
		tone: 'sand',
	},
	{
		id: 'more-messages',
		title: 'Switch the language.',
		blurb:
			'Headers, statuses, the words of the table, dates and money all follow the choice while it runs.',
		tone: 'clay',
		size: 'tall',
	},
	{
		id: 'more-marks',
		title: 'Mark the late rows.',
		blurb: 'A row and a cell take a class of yours, by what they hold.',
		tone: 'paper',
	},
	{
		id: 'more-zones',
		title: 'One moment, two zones.',
		blurb: 'A departure reads in the time of Helsinki and of New York.',
		tone: 'sand',
		// Wide, so the raw timestamps fit too.
		size: 'wide',
	},
	{
		id: 'more-listen',
		title: 'Hear every change.',
		blurb: 'A status line beside the table follows its sort, its search and its pick.',
		tone: 'sand',
	},
	{
		id: 'more-app',
		title: 'Run a real table.',
		blurb:
			'A pipeline of sales with all of it at once: search, stages, sort, pages, columns to hide, a pinned name, picks, cells of its own, sums and the money of three languages.',
		tone: 'paper',
		size: 'full',
	},
]
