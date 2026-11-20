import { describe, expect, test } from 'vite-plus/test'
import type { ColumnDef } from '../rows'
import { fullColumnOrder, layoutColumns, type HeaderCell } from './layout'

const columns: ColumnDef[] = [
	{ id: 'name' },
	{
		id: 'work',
		columns: [{ id: 'team' }, { id: 'role' }],
	},
	{
		id: 'numbers',
		columns: [{ id: 'score' }, { id: 'rank', columns: [{ id: 'now' }, { id: 'before' }] }],
	},
]

const ids = (list: readonly ColumnDef[]) => list.map((column) => column.id)
const cells = (rows: HeaderCell[][]) =>
	rows.map((row) =>
		row.map((cell) => `${cell.column.id}:${cell.col}+${cell.colSpan}x${cell.rowSpan}`),
	)

describe('column layout', () => {
	test('header rows cover the columns, and a column with fewer groups reaches down', () => {
		const layout = layoutColumns(columns)
		expect(ids(layout.leaves)).toEqual(['name', 'team', 'role', 'score', 'now', 'before'])
		expect(cells(layout.headerRows)).toEqual([
			['name:0+1x3', 'work:1+2x1', 'numbers:3+3x1'],
			['team:1+1x2', 'role:2+1x2', 'score:3+1x2', 'rank:4+2x1'],
			['now:4+1x1', 'before:5+1x1'],
		])
		expect(layout.index.get('now')).toBe(4)
	})

	test('a hidden column leaves, and a hidden group takes its columns with it', () => {
		const layout = layoutColumns(columns, { visibility: { role: false, rank: false } })
		expect(ids(layout.leaves)).toEqual(['name', 'team', 'score'])
		expect(ids(layout.all)).toHaveLength(6)
		expect(cells(layout.headerRows)).toEqual([
			['name:0+1x2', 'work:1+1x1', 'numbers:2+1x1'],
			['team:1+1x1', 'score:2+1x1'],
		])
	})

	test('an order moves columns, and a group that it splits shows once for each part', () => {
		const layout = layoutColumns(columns, { order: ['team', 'name', 'role'] })
		expect(ids(layout.leaves)).toEqual(['team', 'name', 'role', 'score', 'now', 'before'])
		expect(layout.headerRows[0]?.map((cell) => cell.key)).toEqual([
			'work@0',
			'name',
			'work@2',
			'numbers@3',
		])
	})

	test('pinned columns go to their edge, in the order of the pins', () => {
		const layout = layoutColumns(columns, {
			order: ['score', 'name'],
			pinning: { start: ['role', 'name'], end: ['team'] },
		})
		expect(ids(layout.leaves)).toEqual(['role', 'name', 'score', 'now', 'before', 'team'])
		expect(layout.pins.get('team')).toBe('end')
		// `role` and `team` are in one group, but a pin on each side keeps them apart.
		expect(layout.headerRows[0]?.map((cell) => `${cell.key}:${cell.pin ?? '-'}`)).toEqual([
			'work@0:start',
			'name:start',
			'numbers@2:-',
			'work@5:end',
		])
	})

	test('a flat list has one header row', () => {
		const layout = layoutColumns([{ id: 'a' }, { id: 'b' }])
		expect(cells(layout.headerRows)).toEqual([['a:0+1x1', 'b:1+1x1']])
	})

	test('a full order lists every column once and ignores unknown ids', () => {
		expect(fullColumnOrder(columns, ['now', 'nope', 'name', 'now'])).toEqual([
			'now',
			'name',
			'team',
			'role',
			'score',
			'before',
		])
	})
})
