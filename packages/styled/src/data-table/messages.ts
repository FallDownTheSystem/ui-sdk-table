import { defaultMessages, type PageUnit, type TableMessages } from 'ui-sdk-table-vue'

export type DataTableExportFormat = 'csv' | 'xlsx'

/**
 * How many entries the pages hold and what they are. `unit` says what `total`
 * counts: rows, groups, rows with child rows (`parents`) or groups and rows
 * together (`mixed`). `rows` is how many data rows pass the filters.
 */
export type DataTableCount = { total: number; unit: PageUnit; rows: number }

/**
 * Every text that the controls of the styled table write. Each entry is a
 * function, so a translation can put the parts in the order of its language.
 * `table` is the name of the table (its `label`), or an empty text. A control
 * that a page can hold twice, once for each table, has the name of its table
 * in its own name: assistive technology and an agent tell the two apart by it.
 */
export type DataTableControlMessages = {
	/** The placeholder of the search field. */
	search: () => string
	/** The name of the search field. */
	searchLabel: (details: { table: string }) => string
	clearSearch: () => string
	/** The text of the button that opens the column filters. `count` is how many filters are set. */
	filters: (details: { count: number }) => string
	/** The name of that button. */
	filtersLabel: (details: { count: number; table: string }) => string
	/** The title of the popover with the column filters, as a person sees it. */
	filtersTitle: () => string
	/** The name of that popover. */
	filtersTitleLabel: (details: { table: string }) => string
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
	/** The text of the button that opens the list of columns. */
	columns: () => string
	/** The name of that button. */
	columnsLabel: (details: { table: string }) => string
	showAllColumns: () => string
	/** The text of the button that opens the export menu. */
	exportData: () => string
	/** The name of that button. */
	exportLabel: (details: { table: string }) => string
	exportCsv: () => string
	exportXlsx: () => string
	/** What the table says and shows when an export gave no file. */
	exportFailed: (details: { format: DataTableExportFormat }) => string
	/** The name of the button that takes a message away. */
	dismiss: () => string
	/** The name of the list of page sizes. */
	pageSizeLabel: (details: { table: string }) => string
	/** One entry of the list of page sizes. */
	pageSize: (details: { size: number }) => string
	/** The name of the page navigation. */
	pagination: (details: { table: string }) => string
	pageOf: (details: { page: number; pageCount: number }) => string
	/** The text for pages without a known end. */
	pageNumber: (details: { page: number }) => string
	/** The name of the link to one page. */
	pageLink: (details: { page: number; table: string }) => string
	/**
	 * Which part of the table the page shows. `from` and `to` count what
	 * `unit` names, so a table with groups says groups. `total` is 0 for a
	 * table without rows.
	 */
	showingRows: (details: DataTableCount & { from: number; to: number }) => string
	selectedRows: (details: { count: number }) => string
	firstPage: (details: { table: string }) => string
	previousPage: (details: { table: string }) => string
	nextPage: (details: { table: string }) => string
	lastPage: (details: { table: string }) => string
	/**
	 * The name of the checkbox in the header. It selects every row that
	 * passes the filters, on every page, child rows too: `count` is how many.
	 */
	selectAllRows: (details: { count: number; table: string }) => string
	/** The name of the checkbox of one row. `row` is the text of its first cell. */
	selectRow: (details: { row: string }) => string
	selectGroup: (details: { group: string }) => string
	expandAllRows: (details: { table: string }) => string
	collapseAllRows: (details: { table: string }) => string
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
	/** What a screen reader hears after a search, a filter or a new grouping. */
	rowsFound: (details: DataTableCount) => string
	/** What a screen reader hears after a new sort. `sort` is empty for a table that is not sorted. */
	sortedBy: (details: { sort: readonly { column: string; desc: boolean }[] }) => string
}

export type DataTableMessages = TableMessages & DataTableControlMessages

const named = (text: string, table: string) => (table ? `${text}, ${table}` : text)
const count = (number: number, one: string, many = `${one}s`) =>
	`${number} ${number === 1 ? one : many}`

/**
 * The name of a control that shows a text: that text and the name of the
 * table. A caller who translates the text alone gets the name with it, and
 * a caller who gives the name too gets that name.
 */
type NameKey =
	| 'searchLabel'
	| 'filtersLabel'
	| 'filtersTitleLabel'
	| 'columnsLabel'
	| 'exportLabel'
	| 'pageLink'

function namesOf(
	texts: Pick<
		DataTableControlMessages,
		'search' | 'filters' | 'filtersTitle' | 'columns' | 'exportData' | 'pageNumber'
	>,
): Pick<DataTableControlMessages, NameKey> {
	return {
		searchLabel: ({ table }) => named(texts.search(), table),
		filtersLabel: ({ count: set, table }) => named(texts.filters({ count: set }), table),
		filtersTitleLabel: ({ table }) => named(texts.filtersTitle(), table),
		columnsLabel: ({ table }) => named(texts.columns(), table),
		exportLabel: ({ table }) => named(texts.exportData(), table),
		pageLink: ({ page, table }) => named(texts.pageNumber({ page }), table),
	}
}

const controlTexts: Omit<DataTableControlMessages, NameKey> = {
	search: () => 'Search',
	clearSearch: () => 'Clear search',
	filters: ({ count: set }) =>
		set === 0 ? 'Filters' : set === 1 ? '1 filter applied' : `${set} filters applied`,
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
	exportFailed: () => 'The export failed. Try again.',
	dismiss: () => 'Dismiss',
	pageSizeLabel: ({ table }) => named('Rows per page', table),
	pageSize: ({ size }) => `${size} per page`,
	pagination: ({ table }) => named('Pages', table),
	pageOf: ({ page, pageCount }) => `Page ${page} of ${pageCount}`,
	pageNumber: ({ page }) => `Page ${page}`,
	showingRows: ({ from, to, total, unit, rows }) => {
		if (total === 0) return 'No rows'
		const one = from === to
		if (unit === 'groups') {
			return one
				? `Showing group ${from} of ${count(total, 'group')} (${count(rows, 'row')})`
				: `Showing groups ${from} to ${to} of ${total} (${count(rows, 'row')})`
		}
		if (unit === 'parents') {
			return one
				? `Showing top-level row ${from} of ${total} (${rows} rows with child rows)`
				: `Showing top-level rows ${from} to ${to} of ${total} (${rows} rows with child rows)`
		}
		if (unit === 'mixed') {
			return `Showing ${from} to ${to} of ${total} groups and rows (${count(rows, 'row')})`
		}
		return `Showing ${from} to ${to} of ${count(total, 'row')}`
	},
	selectedRows: ({ count: selected }) => `${count(selected, 'row')} selected`,
	firstPage: ({ table }) => named('First page', table),
	previousPage: ({ table }) => named('Previous page', table),
	nextPage: ({ table }) => named('Next page', table),
	lastPage: ({ table }) => named('Last page', table),
	selectAllRows: ({ count: rows, table }) => named(`Select all ${count(rows, 'row')}`, table),
	selectRow: ({ row }) => `Select row ${row}`,
	selectGroup: ({ group }) => `Select group ${group}`,
	expandAllRows: ({ table }) => named('Expand all rows', table),
	collapseAllRows: ({ table }) => named('Collapse all rows', table),
	expandRowOf: ({ row }) => `Expand row ${row}`,
	collapseRowOf: ({ row }) => `Collapse row ${row}`,
	selectionColumn: () => 'Selection',
	expandColumn: () => 'Details',
	noRowsForSearch: ({ search }) => `No rows match “${search}”.`,
	noRowsForFilters: () => 'No rows match the current filters.',
	rowsFound: ({ total, unit, rows }) => {
		if (rows === 0) return 'No rows found.'
		if (unit === 'groups') return `${count(total, 'group')} with ${count(rows, 'row')} found.`
		if (unit === 'parents') return `${count(rows, 'row')} found, ${total} at the top level.`
		return `${count(rows, 'row')} found.`
	},
	sortedBy: ({ sort }) =>
		sort.length
			? `Sorted by ${sort.map((rule) => `${rule.column}, ${rule.desc ? 'descending' : 'ascending'}`).join(', then by ')}.`
			: 'Not sorted.',
}

export const defaultControlMessages: DataTableControlMessages = {
	...controlTexts,
	...namesOf(controlTexts),
}

/** The English texts of the styled table and of the headless table under it. */
export const defaultDataTableMessages: DataTableMessages = {
	...defaultMessages,
	noRows: () => 'No rows yet.',
	...defaultControlMessages,
}

/** The texts of a table: the defaults, with the texts of the caller over them. */
export function resolveMessages(messages?: Partial<DataTableMessages>): DataTableMessages {
	if (!messages) return defaultDataTableMessages
	const texts = { ...defaultDataTableMessages, ...messages }
	return { ...texts, ...namesOf(texts), ...messages }
}
