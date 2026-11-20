import { createParts } from '@ui-sdk/vue/primitive'
import { table } from 'ui-sdk-table-core'

/**
 * The parts of the table, one for each element. Use them when the `Table`
 * component does not give the markup you need. A part must be inside a
 * `TableRoot` or a `Table`.
 */
export const {
	Root: TableRoot,
	Head: TableHead,
	Body: TableBody,
	Foot: TableFoot,
	Col: TableCol,
	HeaderRow: TableHeaderRow,
	PlainRow: TablePlainRow,
	Row: TableRow,
	Cell: TableCell,
	Resizer: TableResizer,
} = createParts(table, {
	root: 'table',
	head: 'thead',
	body: 'tbody',
	foot: 'tfoot',
	col: 'col',
	headerRow: 'tr',
	plainRow: 'tr',
	row: 'tr',
	cell: 'td',
	resizer: 'span',
})

// A slot has one element. A header cell is the same slot as a body cell, so a
// second set of parts gives it the `th` element.
export const { Cell: TableHeaderCell } = createParts(table, { cell: 'th' })
