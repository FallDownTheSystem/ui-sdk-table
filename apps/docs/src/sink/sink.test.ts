import * as library from 'ui-sdk-table-vue'
import * as writers from 'ui-sdk-table-vue/export'
import * as formulas from 'ui-sdk-table-vue/formulas'
import { uses } from 'virtual:sink-uses'
import { describe, expect, it } from 'vite-plus/test'
import columnSource from '../../../../packages/core/src/rows/types.ts?raw'
import coreSource from '../../../../packages/core/src/table.ts?raw'
import vueSource from '../../../../packages/vue/src/table.ts?raw'
import { pack, SPANS, type Placed } from './pack'
import { demoFiles, fileOf, groups, tiles } from './registry'

/** A type of the library as it is written: from its first line to the `}` that closes it. */
function typeBlock(source: string, start: string): string {
	const from = source.indexOf(start)
	const to = source.indexOf('\n}\n', from)
	if (from === -1 || to === -1) throw new Error(`The source has no "${start}".`)
	return source.slice(from + start.length, to)
}

// The members of a type stand one tab in; what they hold stands deeper.
const members = (block: string) =>
	[...block.matchAll(/^\t'?([\w-]+)'?\??[:(<]/gm)].map(([, name = '']) => name)

const component = library.Table as unknown as { props: Record<string, unknown> }
const options = Object.keys(component.props)
const methods = members(typeBlock(coreSource, 'export type TableController = {'))
const columnKeys = members(typeBlock(columnSource, 'export type ColumnDef<Row = unknown> = {'))
const slotBlock = typeBlock(vueSource, 'export type TableSlots<Row> = {')
const slots = [
	// `foot-${string}` is the slot of one column; a tile names it by `foot`, as the slot for every column.
	...[...slotBlock.matchAll(/\[name: `([\w-]+)-\$\{string\}`\]/g)].map(([, name = '']) => name),
	...members(slotBlock),
]
const events = [...typeBlock(vueSource, 'export type TableEmits = {').matchAll(/^\t(\w+):/gm)].map(
	([, name = '']) => `on${name.charAt(0).toUpperCase()}${name.slice(1)}`,
)
const exported = [...Object.keys(library), ...Object.keys(writers), ...Object.keys(formulas)]

/** Every name that a tile can show, in the form of a tag. */
const real = new Set([
	...options,
	...methods,
	...events,
	...exported,
	...columnKeys.map((key) => `column.${key}`),
	...slots.map((slot) => `slot.${slot}`),
])

const used = new Set(Object.values(uses).flat())

/**
 * The names that no tile shows, each with its reason. A new option, method,
 * slot or column key of the library must get a tile or a line here.
 */
const NOT_SHOWN: Record<string, string> = {
	getRowId: 'Every tile has rows with an `id`, which is the default.',
	sortChildren: 'A sorted tree; the tree tile is not sorted.',
	canGroup: 'The group tiles say it by `column.groupable`.',
	columnMaxWidth: 'The resize tile sets the bounds by column.',
	defaultGroupBy: 'The group tiles pass `groupBy` itself.',
	defaultPage: 'The page tiles pass `page` or use the controller.',
	defaultSelected: 'The select tiles start with no row picked.',
	defaultColumnOrder: 'The drag tile starts in the order of the definitions.',
	defaultColumnWidths: 'The resize tile starts with the widths of the columns.',
	defaultRowPinning: 'The pin tile pins through the controller.',
	defaultCellRange: 'The range tile starts with no range.',
	inputSearch: '`useTableSearch` calls it for the field of the search tile.',
	flushSearch: '`useTableSearch` calls it for the field of the search tile.',
	nextPage: 'The page tiles go to a page by its number, with `setPage`.',
	previousPage: 'As `nextPage`.',
	firstPage: 'As `nextPage`.',
	lastPage: 'As `nextPage`.',
	expand:
		'The tiles open a row with `toggleExpanded` of the cell slot, or all rows with `expandAll`.',
	collapse: 'As `expand`.',
	toggleExpanded: 'As `expand`.',
	select: 'The tiles pick a row with `toggleSelected` of the cell slot, or many with `selectRows`.',
	toggleSelected: 'As `select`.',
	toggleColumnVisibility: 'The hide tile names the state it wants, with `setColumnVisibility`.',
	setColumnOrder: 'The drag tile moves one column, with `moveColumn`.',
	setColumnWidth: 'The resize tile leaves the widths to the pointer and the keys.',
	startEdit:
		'The edit tiles open a cell with Enter or two clicks; `editCell` edits without an editor.',
	cancelEdit: 'As `startEdit`; Escape does it.',
	'slot.editor':
		'The editor of every column; the tile brings one for one column, with `#edit-{id}`.',
	defaultColumnAggregates: 'The totals tile passes `columnAggregates` itself.',
	getSelectionSummary: '`useSelectionSummary` calls it for the bar of the sum tile.',
}

describe('the tiles of the sink page', () => {
	const copies = Object.entries(groups).flatMap(([group, list]) =>
		list.map((copy) => ({ ...copy, group })),
	)

	it('gives every tile an id of its own that starts with its group', () => {
		const ids = copies.map((copy) => copy.id)
		expect(ids.filter((id) => !/^[a-z]+(?:-[a-z0-9]+)+$/.test(id))).toEqual([])
		expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([])
		expect(copies.filter((copy) => !copy.id.startsWith(`${copy.group}-`))).toEqual([])
		expect(tiles.map((tile) => tile.id).toSorted()).toEqual(ids.toSorted())
	})

	it('writes a title of one to four words that ends with a period', () => {
		const wrong = copies
			.filter(({ title }) => !/^\S+(?: \S+){0,3}$/.test(title) || !/[^.]\.$/.test(title))
			.map(({ id, title }) => `${id}: ${title}`)
		expect(wrong).toEqual([])
	})

	it('writes a blurb of one sentence', () => {
		const wrong = copies
			.filter(({ blurb }) => !/^[A-Z"].*[^.]\.$/.test(blurb) || /[.!?] [A-Z"]/.test(blurb))
			.map(({ id, blurb }) => `${id}: ${blurb}`)
		expect(wrong).toEqual([])
	})

	it('has one file for each tile and one tile for each file', () => {
		const wanted = copies.map((copy) => fileOf(copy.group, copy.id))
		expect(wanted.toSorted()).toEqual(demoFiles.toSorted())
		expect(Object.keys(uses).toSorted()).toEqual(copies.map((copy) => copy.id).toSorted())
	})

	it('reads names from the library, so the lists below are not empty by a mistake', () => {
		expect(options).toContain('multiSort')
		expect(methods).toContain('resetColumnVisibility')
		expect(columnKeys).toContain('aggregate')
		expect(slots).toEqual(expect.arrayContaining(['group-total', 'col', 'empty']))
		expect(events).toContain('onCellEdit')
		expect(exported).toEqual(expect.arrayContaining(['useTableSearch', 'toCsv']))
	})

	it('tags a tile only with names that the library has', () => {
		const wrong = Object.entries(uses).flatMap(([id, names]) =>
			names.filter((name) => !real.has(name)).map((name) => `${id}: ${name}`),
		)
		expect(wrong).toEqual([])
		// A tile without a name of the library shows no table of the library.
		expect(Object.entries(uses).filter(([, names]) => names.length < 2)).toEqual([])
	})

	it('shows every option, method, slot and column key, but for a list with reasons', () => {
		const shown = (name: string) => used.has(name) || name in NOT_SHOWN
		const missing = [
			...options,
			...methods,
			...columnKeys.map((key) => `column.${key}`),
			...slots.map((slot) => `slot.${slot}`),
		].filter((name) => !shown(name))
		expect(missing).toEqual([])
		// A name that a tile shows now leaves the list.
		expect(Object.keys(NOT_SHOWN).filter((name) => used.has(name) || !real.has(name))).toEqual([])
	})

	it('gives every tile a tag that filters, the rarest first', () => {
		const wrong = tiles
			.filter((tile) => !tile.uses.length || new Set(tile.uses).size !== tile.uses.length)
			.map((tile) => tile.id)
		expect(wrong).toEqual([])
	})
})

describe('pack', () => {
	const span = (size: keyof typeof SPANS) => SPANS[size]
	const cells = (placed: readonly Placed<unknown>[]) =>
		placed.flatMap((entry) =>
			Array.from({ length: entry.rows * entry.columns }, (_, index) => {
				const row = entry.row + Math.floor(index / entry.columns)
				return `${row}:${entry.column + (index % entry.columns)}`
			}),
		)

	it('puts a small item into the gap that a large one left', () => {
		const placed = pack(['large', 'wide', 's', 's'] as const, span, 3)
		expect(placed.map((entry) => [entry.item, entry.row, entry.column])).toEqual([
			['large', 1, 1],
			['s', 1, 3],
			['s', 2, 3],
			['wide', 3, 1],
		])
	})

	it('answers in reading order, so the document reads as the screen does', () => {
		const placed = pack(['tall', 'wide', 's', 'large', 's', 's'] as const, span, 4)
		const order = placed.map((entry) => entry.row * 100 + entry.column)
		expect(order).toEqual(order.toSorted((a, b) => a - b))
	})

	it('makes an item no wider than the grid', () => {
		const placed = pack(['large', 'wide', 's'] as const, span, 1)
		expect(placed.map((entry) => entry.columns)).toEqual([1, 1, 1])
		expect(placed.map((entry) => entry.row)).toEqual([1, 3, 4])
	})

	it('lets a neighbour grow over a cell that no item took', () => {
		// Two columns: the tall item leaves the cell under the small one free, and a line follows.
		const placed = pack(['tall', 's', 'wide'] as const, span, 2)
		expect(placed.find((entry) => entry.item === 's')).toMatchObject({ row: 1, column: 2, rows: 2 })
	})

	it('leaves the end of the last line open, also before an item as wide as the grid', () => {
		const last = pack(['wide', 's'] as const, span, 2)
		expect(last.at(-1)).toMatchObject({ row: 2, column: 1, columns: 1 })
		const closed = pack(['wide', 's', 'full'] as const, span, 3)
		expect(closed.map((entry) => [entry.item, entry.row, entry.columns])).toEqual([
			['wide', 1, 2],
			['s', 1, 1],
			['full', 2, 3],
		])
		// A hole above the last line is filled.
		const open = pack(['wide', 'wide', 'full'] as const, span, 3)
		expect(open.map((entry) => [entry.item, entry.row, entry.columns])).toEqual([
			['wide', 1, 3],
			['wide', 2, 2],
			['full', 3, 3],
		])
	})

	it('leaves no hole and no overlap for the tiles of the page at any width', () => {
		const wrong: string[] = []
		for (const columns of [1, 2, 3, 4, 5, 6]) {
			const placed = pack(tiles, (tile) => SPANS[tile.size], columns)
			const taken = cells(placed)
			// Only the last line of tiles, before the tile that closes the page, may end early.
			const lastLine = Math.max(
				...placed.filter((entry) => entry.item.size !== 'full').map((entry) => entry.row),
			)
			const inside = taken.filter((cell) => Number(cell.split(':')[0]) < lastLine)
			if (new Set(taken).size !== taken.length) wrong.push(`${columns} columns overlap`)
			if (inside.length !== (lastLine - 1) * columns) wrong.push(`${columns} columns have a hole`)
		}
		expect(wrong).toEqual([])
	})
})
