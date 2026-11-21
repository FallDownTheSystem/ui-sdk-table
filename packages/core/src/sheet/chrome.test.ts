import { expect, test } from 'vite-plus/test'
import { columnLetter, rowNumberColumn } from './chrome'

test('columnLetter counts as a spreadsheet does', () => {
	expect([0, 25, 26, 27, 51, 52, 701, 702, 18277].map(columnLetter)).toEqual([
		'A',
		'Z',
		'AA',
		'AB',
		'AZ',
		'BA',
		'ZZ',
		'AAA',
		'ZZZ',
	])
	expect(() => columnLetter(-1)).toThrow('counted from 0')
	expect(() => columnLetter(1.5)).toThrow('counted from 0')
})

test('rowNumberColumn is a column that leads the table and holds row headers, whatever the caller passes', () => {
	expect(rowNumberColumn()).toMatchObject({
		id: '#',
		lead: true,
		rowHeader: true,
		editable: false,
		hideable: false,
		resizable: false,
		searchable: false,
		width: 48,
	})
	const own = rowNumberColumn({ id: 'n', width: 64, lead: false, rowHeader: false })
	expect(own).toMatchObject({ id: 'n', width: 64, lead: true, rowHeader: true })
})
