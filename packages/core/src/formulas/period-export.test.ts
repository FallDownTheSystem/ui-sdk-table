import { mount } from '@ui-sdk/core/testing'
import { expect, test } from 'vite-plus/test'
import { toCsv, toXlsx } from '../export'
import type { ColumnDef } from '../rows'
import { table, type TableOptions } from '../table'
import { formulaColumn } from './index'

// The files of a table grouped by a column of periods hold the texts of the
// screen: the label of each group and the text of each cell.

type Order = { id: string; created: Date; amount: number }

const orders: Order[] = [
	{ id: 'a', created: new Date('2026-11-17T09:00:00Z'), amount: 40 },
	{ id: 'b', created: new Date('2026-11-02T12:00:00Z'), amount: 10 },
	{ id: 'c', created: new Date('2026-11-22T22:30:00Z'), amount: 25 },
]

const base: ColumnDef<Order>[] = [
	{
		id: 'created',
		header: 'Created',
		format: 'datetime',
		formatOptions: { timeZone: 'Europe/Helsinki' },
	},
	{ id: 'amount', header: 'Amount', aggregate: 'sum' },
]
const week = formulaColumn({ id: 'week', header: 'Week', formula: '=WEEKOF([created], 2)' }, base)

function setup() {
	return mount(
		table,
		{
			rows: orders,
			columns: [week, ...base],
			defaultGroupBy: ['week'],
			defaultSort: [{ id: 'week' }],
			locale: 'en-US',
		} as TableOptions,
		'<root aria-label="Orders"></root>',
	)
}

const spaces = (text: string) => text.replace(/[\u2009\u202f\u00a0]/g, ' ')

test('the groups of a week column are in time order, and their labels are the text of the week', () => {
	const view = setup()
	try {
		const groups = view.api.rows().filter((flat) => flat.node.kind === 'group')
		expect(groups.map((flat) => flat.node.kind === 'group' && flat.node.value)).toEqual([
			'2026-11-02',
			'2026-11-16',
			'2026-11-23',
		])
		// 22:30 UTC on Sunday the 22nd is 00:30 on Monday in Helsinki, the zone of the column:
		// the row is in the week of the 23rd, not in the week of the 16th as in UTC.
		const paths = groups.map((flat) =>
			flat.node.kind === 'group' ? spaces(view.api.groupPath(flat.node)[0]?.text ?? '') : '',
		)
		expect(paths).toEqual(['Nov 2 – 8, 2026', 'Nov 16 – 22, 2026', 'Nov 23 – 29, 2026'])
	} finally {
		view.unmount()
	}
})

test('a CSV and an Excel file hold the labels of the groups and the texts of the weeks', async () => {
	const view = setup()
	try {
		const data = view.api.exportData()
		const csv = spaces(toCsv(data))
		expect(csv).toContain('Nov 16 – 22, 2026')
		expect(csv).toContain('Nov 2 – 8, 2026')
		const file = new TextDecoder().decode(await toXlsx(data))
		// jsdom has no compression, so the archive holds its files as they are.
		expect(spaces(file)).toContain('Nov 16 – 22, 2026')
	} finally {
		view.unmount()
	}
})
