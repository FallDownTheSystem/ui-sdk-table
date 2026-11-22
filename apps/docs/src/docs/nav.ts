/**
 * The groups of the docs and the pages in them, in the order of the
 * sidebar, of Previous and Next and of the generated files. A page `id` is
 * the file `pages/<id>.md`. The pages of a group with `inline` stand whole
 * in `llms.txt`; every other page has one line there.
 */
export const groups: readonly { title: string; inline?: boolean; pages: readonly string[] }[] = [
	{ title: 'Get started', inline: true, pages: ['introduction', 'installation', 'first-table'] },
	{
		title: 'Using the table',
		pages: [
			'column-definitions',
			'cells-and-slots',
			'state-and-events',
			'styling',
			'controller-and-view',
			'sort-filter-and-search',
			'groups-and-totals',
			'pages-and-server-mode',
			'rows',
			'selection-and-keyboard',
			'cell-editing',
			'export',
			'agents',
		],
	},
	{
		title: 'Data sheet',
		pages: [
			'sheet-options',
			'range-copy-and-paste',
			'fill',
			'history',
			'formats',
			'row-numbers-and-letters',
			'sheet-formulas',
			'excel-formulas',
		],
	},
]
