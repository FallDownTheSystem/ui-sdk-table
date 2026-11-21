import { defaultMessages, type TableMessages } from 'ui-sdk-table-vue'

/**
 * Every text that the controls of the styled table write. Each entry is a
 * function, so a translation can put the parts in the order of its language.
 * `table` is the name of the table (its `label`), or an empty text.
 */
export type DataTableControlMessages = {
	/** The placeholder of the search field. */
	search: () => string
	/** The name of the search field. */
	searchLabel: (details: { table: string }) => string
	clearSearch: () => string
	/** The button that opens the column filters. `count` is how many filters are set. */
	filters: (details: { count: number }) => string
	/** The title of the popover with the column filters. */
	filtersTitle: () => string
	clearFilters: () => string
	/** The name of the button that takes the filter of one column away. */
	resetFilter: (details: { column: string }) => string
	/** The name of the text field that filters one column. */
	filterText: (details: { column: string }) => string
	/** What the list of values shows while no value is chosen. */
	filterAny: () => string
	/** The name of the list of values that filters one column. */
	filterValues: (details: { column: string }) => string
	filterMin: (details: { column: string }) => string
	filterMax: (details: { column: string }) => string
	filterFrom: (details: { column: string }) => string
	filterTo: (details: { column: string }) => string
	/** The placeholder of the two number fields. */
	min: () => string
	max: () => string
	/** The button that opens the list of columns. */
	columns: () => string
	showAllColumns: () => string
	/** The button that opens the export menu. */
	exportData: () => string
	exportCsv: () => string
	exportXlsx: () => string
	/** The name of the list of page sizes. */
	pageSizeLabel: (details: { table: string }) => string
	/** One entry of the list of page sizes. */
	pageSize: (details: { size: number }) => string
	/** The name of the page navigation. */
	pagination: (details: { table: string }) => string
	pageOf: (details: { page: number; pageCount: number }) => string
	/** The name of the link to one page, and the text for pages without a known end. */
	pageNumber: (details: { page: number }) => string
	/** Which rows the page shows. `to` is 0 for a table without rows. */
	showingRows: (details: { from: number; to: number; total: number }) => string
	selectedRows: (details: { count: number }) => string
	firstPage: () => string
	previousPage: () => string
	nextPage: () => string
	lastPage: () => string
	selectAllRows: () => string
	/** The name of the checkbox of one row. `row` is the text of its first cell. */
	selectRow: (details: { row: string }) => string
	selectGroup: (details: { group: string }) => string
	expandAllRows: () => string
	collapseAllRows: () => string
	/** The name of the button that opens one row. `row` is the text of its first cell. */
	expandRowOf: (details: { row: string }) => string
	collapseRowOf: (details: { row: string }) => string
	/** The name of the column of checkboxes, where its header holds no checkbox. */
	selectionColumn: () => string
	/** The name of the column of buttons that open rows, where its header holds no button. */
	expandColumn: () => string
	/** What the body says when no row passes the search. */
	noRowsForSearch: (details: { search: string }) => string
	/** What the body says when no row passes the column filters. */
	noRowsForFilters: () => string
}

export type DataTableMessages = TableMessages & DataTableControlMessages

const named = (text: string, table: string) => (table ? `${text}, ${table}` : text)

export const defaultControlMessages: DataTableControlMessages = {
	search: () => 'Search',
	searchLabel: ({ table }) => named('Search', table),
	clearSearch: () => 'Clear search',
	filters: ({ count }) =>
		count === 0 ? 'Filters' : count === 1 ? '1 filter applied' : `${count} filters applied`,
	filtersTitle: () => 'Column filters',
	clearFilters: () => 'Clear all filters',
	resetFilter: ({ column }) => `Reset filter of ${column}`,
	filterText: ({ column }) => `Filter ${column}`,
	filterAny: () => 'Any value',
	filterValues: ({ column }) => `Values of ${column}`,
	filterMin: ({ column }) => `Lowest ${column}`,
	filterMax: ({ column }) => `Highest ${column}`,
	filterFrom: ({ column }) => `${column} from`,
	filterTo: ({ column }) => `${column} to`,
	min: () => 'Min',
	max: () => 'Max',
	columns: () => 'Columns',
	showAllColumns: () => 'Show all',
	exportData: () => 'Export',
	exportCsv: () => 'Export CSV',
	exportXlsx: () => 'Export Excel',
	pageSizeLabel: ({ table }) => named('Rows per page', table),
	pageSize: ({ size }) => `${size} per page`,
	pagination: ({ table }) => named('Pages', table),
	pageOf: ({ page, pageCount }) => `Page ${page} of ${pageCount}`,
	pageNumber: ({ page }) => `Page ${page}`,
	showingRows: ({ from, to, total }) =>
		total === 0
			? 'No rows'
			: `Showing ${from} to ${to} of ${total} ${total === 1 ? 'row' : 'rows'}`,
	selectedRows: ({ count }) => (count === 1 ? '1 row selected' : `${count} rows selected`),
	firstPage: () => 'First page',
	previousPage: () => 'Previous page',
	nextPage: () => 'Next page',
	lastPage: () => 'Last page',
	selectAllRows: () => 'Select all rows',
	selectRow: ({ row }) => `Select row ${row}`,
	selectGroup: ({ group }) => `Select group ${group}`,
	expandAllRows: () => 'Expand all rows',
	collapseAllRows: () => 'Collapse all rows',
	expandRowOf: ({ row }) => `Expand row ${row}`,
	collapseRowOf: ({ row }) => `Collapse row ${row}`,
	selectionColumn: () => 'Selection',
	expandColumn: () => 'Details',
	noRowsForSearch: ({ search }) => `No rows match “${search}”.`,
	noRowsForFilters: () => 'No rows match the current filters.',
}

/** The English texts of the styled table and of the headless table under it. */
export const defaultDataTableMessages: DataTableMessages = {
	...defaultMessages,
	noRows: () => 'No rows yet.',
	...defaultControlMessages,
}

/** The texts of a table: the defaults, with the texts of the caller over them. */
export function resolveMessages(messages?: Partial<DataTableMessages>): DataTableMessages {
	return messages ? { ...defaultDataTableMessages, ...messages } : defaultDataTableMessages
}
