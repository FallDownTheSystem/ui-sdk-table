import { mount } from '@ui-sdk/core/testing'
import { expect, test } from 'vite-plus/test'
import { applyEdits, type CellEdit } from '../edit'
import type { ColumnDef } from '../rows'
import { table, type TableOptions } from '../table'

// P1 of the sheet work: two reports in one turn.
//
// The table never writes a row. It reports an edit, the owner makes new rows
// and passes them at its next render. Until then the table reads the rows of
// the last render. So a second report in the same turn is made from rows that
// are one report old: its `row` is an object that the owner replaced a moment
// ago, and the value that it reads as the value of now is the value before
// the first report. `mount` never passes new rows, so here every report after
// the first is such a report.
//
// What was wrong before these tests passed: `applyEdits` looked for the row
// object of an edit and dropped an edit whose object was not among the rows,
// without a word; and the table held a second value for a cell against the
// rows of the last render, so a value that was the same as the old one was
// not reported at all.

type Person = { id: string; name: string; score: number }

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'score', header: 'Score' },
]

function setup() {
	const owner = {
		rows: [
			{ id: 'a', name: 'Alice', score: 70 },
			{ id: 'b', name: 'Edward', score: 20 },
		] as Person[],
		reports: [] as CellEdit<Person>[],
	}
	const view = mount(
		table,
		{
			rows: owner.rows,
			columns,
			editable: true,
			onCellEdit: (edits: readonly CellEdit<Person>[]) => {
				owner.reports.push(...edits)
				owner.rows = applyEdits(owner.rows, edits)
			},
		} as TableOptions,
		'<root aria-label="People"></root>',
	)
	return { view, owner }
}

test('two edits of one row in one turn both reach the rows of an owner with `applyEdits`', () => {
	const { view, owner } = setup()
	const other = owner.rows[1]
	try {
		void view.api.editCell('a', 'name', 'Aina')
		void view.api.editCell('a', 'score', 71)
		expect(owner.reports).toHaveLength(2)
		// The second report still holds the row object of the last render.
		expect(owner.reports[1]?.row).toBe(owner.reports[0]?.row)
		expect(owner.rows[0]).toEqual({ id: 'a', name: 'Aina', score: 71 })
		// The row that no edit named is the same object as before.
		expect(owner.rows[1]).toBe(other)
	} finally {
		view.unmount()
	}
})

test('a second edit of one cell in one turn is held against the value of the first', () => {
	const { view, owner } = setup()
	try {
		void view.api.editCell('a', 'name', 'Aina')
		// Back to the value that the rows of the last render still show.
		void view.api.editCell('a', 'name', 'Alice')
		expect(owner.reports.map((edit) => [edit.previous, edit.value])).toEqual([
			['Alice', 'Aina'],
			['Aina', 'Alice'],
		])
		expect(owner.rows[0]?.name).toBe('Alice')
		// The same value twice is one report.
		void view.api.editCell('b', 'score', 5)
		void view.api.editCell('b', 'score', 5)
		expect(owner.reports).toHaveLength(3)
	} finally {
		view.unmount()
	}
})

test('after the turn, the table reads the rows again: an owner that kept its rows is asked again', async () => {
	const { view, owner } = setup()
	try {
		void view.api.editCell('a', 'name', 'Aina')
		await view.settle()
		// The table still has the rows of the mount, where the name is Alice. An
		// owner that took the first edit at once but shows it later gets the
		// truth of its rows: the table does not hold on to what it reported.
		void view.api.editCell('a', 'name', 'Aina')
		expect(owner.reports.map((edit) => [edit.previous, edit.value])).toEqual([
			['Alice', 'Aina'],
			['Alice', 'Aina'],
		])
	} finally {
		view.unmount()
	}
})
