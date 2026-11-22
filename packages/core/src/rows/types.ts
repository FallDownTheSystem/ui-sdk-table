import type { StandardSchemaV1 } from '../edit/schema'
import type { FormatName, FormatOptions } from '../format'

export type FilterKind = 'text' | 'select' | 'range' | 'dateRange'

export type FilterMatcher<Row> = (value: unknown, filter: unknown, row: Row) => boolean

export type AggregateName = 'sum' | 'mean' | 'min' | 'max' | 'count' | 'uniqueCount' | 'first'

export type AggregateFn<Row> = (values: readonly unknown[], rows: readonly Row[]) => unknown

export type ColumnDef<Row = unknown> = {
	/** The id of the column: a key of the state (sort, filter, widths) and of the slots `col-{id}`. Give each column an id of its own. */
	id: string
	/** The text of the header. Defaults to the id. */
	header?: string
	/** The property that holds the cell value. Defaults to `id`. */
	key?: string
	/** Computes the cell value. Wins over `key`. */
	value?: (row: Row) => unknown
	/** Child columns. A column with children is a header group and holds no cells. */
	columns?: readonly ColumnDef<Row>[]
	/** Whether a press on the header sorts by the column: the header renders a button and gets `aria-sort`. Code can sort by any column with `sortBy`. */
	sortable?: boolean
	/** Compares two values for the sort, ascending: a negative number puts `a` first. An empty value goes last in both directions and never reaches it. Without it, numbers, dates and texts of the locale. */
	compare?: (a: unknown, b: unknown, rowA: Row, rowB: Row) => number
	/** How a column filter matches. Without it, the shape of the filter value decides. */
	filter?: FilterKind | FilterMatcher<Row>
	/** Whether the search reads this column. Defaults to true. */
	searchable?: boolean
	/** A mark for the controls of the app: whether a person may group by the column. The table groups by any column that `groupBy` names. */
	groupable?: boolean
	/** The total of the column in the footer and in the group rows: a built-in name, or a function of the values and the rows. */
	aggregate?: AggregateName | AggregateFn<Row>
	/** How the cell value becomes text. Without it, the value is shown as it is. */
	format?: FormatName
	/** The options of the `format`, such as the decimals, the currency or the time zone. */
	formatOptions?: FormatOptions
	/** The width in pixels that the column asks for. A resize by a person wins over it. */
	width?: number
	/** The smallest width in pixels that a resize gives. Without it, the `columnMinWidth` option of the table. */
	minWidth?: number
	/** The largest width in pixels that a resize gives. Without it, the `columnMaxWidth` option of the table. */
	maxWidth?: number
	/** Whether a person can resize the column. Without it, the `resizable` option of the table decides. */
	resizable?: boolean
	/** Whether a person can move the column. Without it, the `reorderable` option of the table decides. */
	reorderable?: boolean
	/**
	 * The column leads the table: it stays before every other column, whatever
	 * the column order says, and it sticks to the start as soon as another
	 * column is pinned there. A column order and the pins do not hold it. For
	 * a top-level column that holds a control of its row, such as a checkbox.
	 */
	lead?: boolean
	/**
	 * The column holds the number of each row, and its cells are the row
	 * headers of the table: a screen reader says the number with each cell
	 * of the row. Such a column leads the table, as with `lead`, and it is
	 * outside every range of cells: a number is never copied, emptied or
	 * filled. A press on a number selects the cells of its row. See
	 * `rowNumberColumn`.
	 */
	rowHeader?: boolean
	/** Whether the column can be hidden. Defaults to true. */
	hideable?: boolean
	/**
	 * Whether a person can edit the cells of the column, or which rows have a
	 * cell that can be edited. Without it, the `editable` option of the table decides.
	 */
	editable?: boolean | ((row: Row) => boolean)
	/**
	 * Whether the editor of a cell asks a phone for its number keyboard
	 * (`inputmode="decimal"`): the cells of the column hold numbers. Off by
	 * default. The table holds it back where the field can hold a formula, and
	 * for a cell whose format is no number format.
	 */
	numberKeyboard?: boolean
	/**
	 * With formulas: whether a cell of the column takes a text that starts
	 * with `=` as a formula. True by default for a cell that can be edited;
	 * a column that must keep such a text as its value sets false.
	 */
	allowFormula?: boolean
	/**
	 * Checks a new value before the table reports the edit. Any Standard Schema
	 * works: Zod, Valibot, ArkType. A value that the schema refuses keeps the
	 * editor open, with the message of the schema.
	 */
	schema?: StandardSchemaV1
	/** Makes the value of a cell from the text of the editor or of a paste. Without it, see `parseText`. */
	parse?: (text: string, row: Row) => unknown
	/** Whether an export holds the column. Defaults to true. */
	exportable?: boolean
	/**
	 * The value of a cell in an export, in place of the cell value and its
	 * format: for a column whose cell is a slot, or whose file value differs
	 * from the screen.
	 */
	exportValue?: (row: Row) => unknown
	/** Data of the app for the column. The table does not read it. */
	meta?: unknown
}

/**
 * A caller's row with its identity. `row` is the caller's own object: the
 * table never copies or changes it. A stage that must change `children`
 * returns a new node around the same `row` and `id`.
 */
export type DataRow<Row> = {
	/** Always `'row'`: a row of the data. */
	kind: 'row'
	/** The id of the row, from `getRowId`. */
	id: string
	/** The row object of the data, as the owner passed it. */
	row: Row
	/** Position among its siblings in the source data. */
	index: number
	/** Tree depth in the source data, 0 for a top-level row. */
	depth: number
	/** The id of the tree row above this row, or `null`. */
	parentId: string | null
	/** The child rows, for a tree row. */
	children?: readonly DataRow<Row>[]
}

export type GroupRow<Row> = {
	/** Always `'group'`: a group of rows. */
	kind: 'group'
	/** The id of the group, such as `group/team=Design`. `expanded` holds it. */
	id: string
	/** The id of the column that makes the group. */
	columnId: string
	/** The value of that column that the rows of the group share. */
	value: unknown
	/** Grouping level, 0 for the first `groupBy` column. */
	depth: number
	/** The id of the group above this one, or `null`. */
	parentId: string | null
	/** The group that holds this group, or `null` for a group of the first `groupBy` column. */
	parent: GroupRow<Row> | null
	/** The groups or the rows right under this group. */
	children: readonly TableRow<Row>[]
	/** Every data row under the group, in order, without their tree children. */
	leaves: readonly DataRow<Row>[]
}

export type TableRow<Row> = DataRow<Row> | GroupRow<Row>

export type SortRule = {
	/** The id of the column. */
	id: string
	/** Whether the column sorts descending. Without it, ascending. */
	desc?: boolean
}

export type FilterState = {
	/** The search text, which every column with `searchable` reads. */
	search?: string
	/** The filter of each column, by column id. The shape of a value, or `filter` of the column, decides how it matches. */
	columns?: Readonly<Record<string, unknown>>
}

export type PageState = {
	/** The page in view, from 1. */
	page: number
	/** How many rows a page holds. */
	pageSize: number
}
