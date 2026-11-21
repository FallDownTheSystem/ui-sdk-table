import {
	cellValue,
	toText,
	totalRows,
	type AggregatePick,
	type ColumnDef,
	type DataRow,
	type GroupRow,
	type TableRow,
} from '../rows'
import type { CellFormat } from '../sheet/formats'

export type ExportOptions = {
	/**
	 * Which rows to take. `'filtered'` (the default) is every row that passes
	 * the filters, on all pages, in the order of the screen. `'page'` is the
	 * rows of the page in view. `'all'` is every row of the data, in the order
	 * of the data. `'selected'` is the selected rows, in sort order. A table
	 * with `manualPage` has one page of a server, so each set is of that page.
	 */
	rows?: 'filtered' | 'page' | 'all' | 'selected'
	/**
	 * Which columns to take. `'visible'` (the default) is the columns on the
	 * screen in their order. `'all'` adds the hidden columns after them. A list
	 * of ids gives those columns in that order. A column with `exportable:
	 * false` is in none of them.
	 */
	columns?: 'visible' | 'all' | readonly string[]
	/** Whether the child rows of a tree row come with it, open or not. Defaults to true. */
	children?: boolean
	/**
	 * Whether each group gets a row of its own before its rows, for `'filtered'`
	 * and `'page'`. Defaults to false. `'all'` and `'selected'` have no groups.
	 */
	groups?: boolean
	/**
	 * Whether a last row holds totals. Defaults to false. For `'filtered'` and
	 * `'page'` they are the totals of the footer on the screen. For `'all'` and
	 * `'selected'` they are the totals of the rows in the file.
	 */
	totals?: boolean
}

export type ExportColumn<Row = unknown> = {
	id: string
	/** The header text of the column. */
	header: string
	column: ColumnDef<Row>
}

export type ExportCell = {
	/** The value of the cell, as the row has it. */
	value: unknown
	/** The text of the cell, as a person sees it on the screen. */
	text: string
	/** The format that the cell has of its own, from the `cellFormats` of the table. */
	format?: CellFormat
	/** With formulas: the formula of the cell, or of its column, in the stored form. */
	formula?: string
}

export type ExportRow<Row = unknown> = {
	kind: 'row' | 'group' | 'total'
	/** The row of the data, for a row of kind `'row'`. */
	row?: Row
	/** Tree and group levels above this row, from 0. */
	level: number
	/**
	 * The name of a group, for a row of kind `'group'`. It is also in a cell:
	 * the first one without a total, or the first one before its total when
	 * every column has a total.
	 */
	label?: string
	/** One cell for each column of the export. */
	cells: ExportCell[]
	/** With formulas: the id of a row of kind `'row'`, for the formulas that name it. */
	id?: string
}

/** The cells of a table as plain data, for a file writer. */
export type ExportData<Row = unknown> = {
	columns: ExportColumn<Row>[]
	rows: ExportRow<Row>[]
	locale: string | undefined
	/** With formulas: the id of every row in the order of the document, for the ranges of the formulas. */
	document?: readonly string[]
}

/** What the collector reads from a table. */
export type ExportSource<Row> = {
	/** Every row of the data, in the order of the data. */
	all: () => readonly DataRow<Row>[]
	/** Every row, in sort order. */
	sorted: () => readonly DataRow<Row>[]
	/** The rows that pass the filters, pinned or not, without groups. */
	filtered: () => readonly DataRow<Row>[]
	/** The rows and groups that pass the filters, on all pages. */
	listed: () => readonly TableRow<Row>[]
	/** The rows and groups of the page in view. */
	page: () => readonly TableRow<Row>[]
	pinned: () => { top: readonly DataRow<Row>[]; bottom: readonly DataRow<Row>[] }
	selected: () => ReadonlySet<string>
	visibleColumns: () => readonly ColumnDef<Row>[]
	allColumns: () => readonly ColumnDef<Row>[]
	label: (column: ColumnDef<Row>) => string
	/** The text of a cell. With the id of its row, the format of the cell decides. */
	text: (row: Row, column: ColumnDef<Row>, rowId?: string) => string
	/** The format that a cell has of its own, when the table has formats. */
	formatOf?: (rowId: string, column: ColumnDef<Row>) => CellFormat | undefined
	groupText: (group: GroupRow<Row>) => string
	/** The totals of a group, or of every row that passes the filters, as the footer and the group rows show them. */
	totals: (group?: GroupRow<Row>) => Record<string, unknown>
	totalText: (column: ColumnDef<Row>, value: unknown) => string
	/** The function of the total of a column, when it can be another than the `aggregate` of the column. */
	aggregateOf?: AggregatePick<Row>
	locale: () => string | undefined
	/** With formulas: the formula of a cell or of its column, in the stored form. */
	formulaOf?: (rowId: string, columnId: string) => string | undefined
	/** With formulas: the id of every row in the order of the document. */
	documentRows?: () => readonly string[]
}

const ROW_SETS = ['filtered', 'page', 'all', 'selected'] as const
const OPTIONS = ['rows', 'columns', 'children', 'groups', 'totals']

function exportColumns<Row>(
	source: ExportSource<Row>,
	choice: ExportOptions['columns'],
): ColumnDef<Row>[] {
	const visible = source.visibleColumns()
	if (choice === undefined || choice === 'visible') return [...visible]
	const shown = new Set(visible.map((column) => column.id))
	const all = [...visible, ...source.allColumns().filter((column) => !shown.has(column.id))]
	if (choice === 'all') return all
	if (!Array.isArray(choice)) {
		throw new Error('`columns` of an export is "visible", "all" or a list of column ids.')
	}
	const byId = new Map(all.map((column) => [column.id, column]))
	return choice.map((id: string) => {
		const column = byId.get(id)
		if (!column) {
			throw new Error(
				`No column "${id}" to export. Columns: ${[...byId.keys()].join(', ') || 'none'}.`,
			)
		}
		return column
	})
}

/**
 * Collects the cells of a table for a file. The text of a cell is the text
 * on the screen, with the format of its column, so a file agrees with what
 * the person saw. A column with `exportValue` gives that value in place of
 * the cell value, and its text.
 */
export function collectExport<Row>(
	source: ExportSource<Row>,
	options: ExportOptions = {},
): ExportData<Row> {
	if (typeof options !== 'object' || options === null || Array.isArray(options)) {
		throw new Error(`\`exportData\` takes an object with the options ${OPTIONS.join(', ')}.`)
	}
	const unknown = Object.keys(options).find((key) => !OPTIONS.includes(key))
	if (unknown !== undefined) {
		throw new Error(`An export has no option "${unknown}". Its options: ${OPTIONS.join(', ')}.`)
	}
	const set = options.rows ?? 'filtered'
	if (!ROW_SETS.includes(set)) {
		throw new Error(`\`rows\` of an export is one of: ${ROW_SETS.join(', ')}.`)
	}
	const columns = exportColumns(source, options.columns).filter(
		// The numbers of the rows are places on the screen, and a file has its own.
		(column) => column.exportable ?? !column.rowHeader,
	)
	const withChildren = options.children !== false
	const rows: ExportRow<Row>[] = []

	const cell = (row: Row, column: ColumnDef<Row>, rowId: string): ExportCell => {
		if (column.exportValue) {
			const value = column.exportValue(row)
			return { value, text: toText(value) }
		}
		const format = source.formatOf?.(rowId, column)
		const text = source.text(row, column, rowId)
		const found: ExportCell = format
			? { value: cellValue(row, column), text, format }
			: { value: cellValue(row, column), text }
		const formula = source.formulaOf?.(rowId, column.id)
		if (formula !== undefined) found.formula = formula
		return found
	}

	// A total is of the values that the file holds, so a column with
	// `exportValue` gives those values to its total too.
	const valued = columns.map((column) =>
		column.exportValue ? { ...column, value: column.exportValue } : column,
	)
	const exported = valued.filter((column) => column.exportValue)
	/**
	 * The cells of a row of totals. `shown` is the totals that the table shows
	 * for these rows, in its footer or in a group row; a file with those rows
	 * says the same. Without it, the rows of the file are counted here, in the
	 * same way.
	 */
	const totalCells = (
		list: readonly DataRow<Row>[],
		shown?: Record<string, unknown>,
		label?: string,
	): ExportCell[] => {
		const totals = shown
			? exported.length
				? { ...shown, ...totalRows(list, exported, source.aggregateOf) }
				: shown
			: totalRows(list, valued, source.aggregateOf)
		const cells = columns.map((column): ExportCell => {
			const aggregate = source.aggregateOf ? source.aggregateOf(column) : column.aggregate
			if (aggregate === undefined) return { value: undefined, text: '' }
			const value = totals[column.id]
			return { value, text: column.exportValue ? toText(value) : source.totalText(column, value) }
		})
		if (label === undefined) return cells
		// The name of the group goes where no total is. A file in which every
		// column has a total still names its groups.
		const free = cells.findIndex((cell) => !cell.text)
		const first = cells[0]
		if (free >= 0) cells[free] = { value: label, text: label }
		else if (first) cells[0] = { value: label, text: `${label}: ${first.text}` }
		return cells
	}

	// The rows of the data that the file holds, for totals of them.
	const taken: DataRow<Row>[] = []
	const add = (node: TableRow<Row>, level: number, only?: ReadonlySet<string>): void => {
		if (node.kind === 'group') {
			if (options.groups) {
				const label = source.groupText(node)
				rows.push({
					kind: 'group',
					level,
					label,
					cells: totalCells(node.leaves, source.totals(node), label),
				})
			}
			for (const child of node.children) add(child, options.groups ? level + 1 : level, only)
			return
		}
		const here = !only || only.has(node.id)
		if (here) {
			taken.push({ ...node, children: undefined })
			rows.push({
				kind: 'row',
				row: node.row,
				level,
				cells: columns.map((column) => cell(node.row, column, node.id)),
				...(source.formulaOf ? { id: node.id } : {}),
			})
		}
		// Each selected row is a row of its own, so its child rows come only when they are selected too.
		if (withChildren || only) {
			for (const child of node.children ?? []) add(child, here ? level + 1 : level, only)
		}
	}

	if (set === 'all') {
		for (const node of source.all()) add(node, 0)
	} else if (set === 'selected') {
		const selected = source.selected()
		for (const node of source.sorted()) add(node, 0, selected)
	} else {
		const pinned = source.pinned()
		for (const node of pinned.top) add(node, 0)
		for (const node of set === 'page' ? source.page() : source.listed()) add(node, 0)
		for (const node of pinned.bottom) add(node, 0)
	}

	if (options.totals) {
		const own = set === 'all' || set === 'selected'
		const cells = own ? totalCells(taken) : totalCells(source.filtered(), source.totals())
		rows.push({ kind: 'total', level: 0, cells })
	}

	return {
		columns: columns.map((column) => ({ id: column.id, header: source.label(column), column })),
		rows,
		locale: source.locale(),
		...(source.documentRows ? { document: source.documentRows() } : {}),
	}
}
