import type { StandardSchemaV1 } from '../edit/schema'
import type { FormatName, FormatOptions } from '../format'

export type FilterKind = 'text' | 'select' | 'range' | 'dateRange'

export type FilterMatcher<Row> = (value: unknown, filter: unknown, row: Row) => boolean

export type AggregateName = 'sum' | 'mean' | 'min' | 'max' | 'count' | 'uniqueCount' | 'first'

export type AggregateFn<Row> = (values: readonly unknown[], rows: readonly Row[]) => unknown

export type ColumnDef<Row = unknown> = {
	id: string
	header?: string
	/** The property that holds the cell value. Defaults to `id`. */
	key?: string
	/** Computes the cell value. Wins over `key`. */
	value?: (row: Row) => unknown
	/** Child columns. A column with children is a header group and holds no cells. */
	columns?: readonly ColumnDef<Row>[]
	sortable?: boolean
	compare?: (a: unknown, b: unknown, rowA: Row, rowB: Row) => number
	/** How a column filter matches. Without it, the shape of the filter value decides. */
	filter?: FilterKind | FilterMatcher<Row>
	/** Whether the search reads this column. Defaults to true. */
	searchable?: boolean
	groupable?: boolean
	aggregate?: AggregateName | AggregateFn<Row>
	/** How the cell value becomes text. Without it, the value is shown as it is. */
	format?: FormatName
	formatOptions?: FormatOptions
	/** The width in pixels that the column asks for. A resize by a person wins over it. */
	width?: number
	minWidth?: number
	maxWidth?: number
	/** Whether a person can resize the column. Without it, the `resizable` option of the table decides. */
	resizable?: boolean
	/** Whether a person can move the column. Without it, the `reorderable` option of the table decides. */
	reorderable?: boolean
	/** Whether the column can be hidden. Defaults to true. */
	hideable?: boolean
	/**
	 * Whether a person can edit the cells of the column, or which rows have a
	 * cell that can be edited. Without it, the `editable` option of the table decides.
	 */
	editable?: boolean | ((row: Row) => boolean)
	/**
	 * Checks a new value before the table reports the edit. Any Standard Schema
	 * works: Zod, Valibot, ArkType. A value that the schema refuses keeps the
	 * editor open, with the message of the schema.
	 */
	schema?: StandardSchemaV1
	/** Makes the value of a cell from the text of the editor or of a paste. Without it, see `parseText`. */
	parse?: (text: string, row: Row) => unknown
	meta?: unknown
}

/**
 * A caller's row with its identity. `row` is the caller's own object: the
 * table never copies or changes it. A stage that must change `children`
 * returns a new node around the same `row` and `id`.
 */
export type DataRow<Row> = {
	kind: 'row'
	id: string
	row: Row
	/** Position among its siblings in the source data. */
	index: number
	/** Tree depth in the source data, 0 for a top-level row. */
	depth: number
	parentId: string | null
	children?: readonly DataRow<Row>[]
}

export type GroupRow<Row> = {
	kind: 'group'
	id: string
	columnId: string
	value: unknown
	/** Grouping level, 0 for the first `groupBy` column. */
	depth: number
	parentId: string | null
	children: readonly TableRow<Row>[]
	/** Every data row under the group, in order, without their tree children. */
	leaves: readonly DataRow<Row>[]
}

export type TableRow<Row> = DataRow<Row> | GroupRow<Row>

export type SortRule = { id: string; desc?: boolean }

export type FilterState = {
	search?: string
	columns?: Readonly<Record<string, unknown>>
}

export type PageState = { page: number; pageSize: number }
