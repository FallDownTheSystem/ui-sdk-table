import { mount } from '@vue/test-utils'
import { afterEach, expect, test } from 'vite-plus/test'
import { h, nextTick, shallowRef, watch } from 'vue'
import {
	applyEdits,
	createTableController,
	Table,
	type CellEdit,
	type ColumnDef,
	type TableEditDetails,
} from '../index'

// P1 of the formula work: after the owner passes new rows, the table checks
// the formula cells that read them and reports the differences from a
// microtask. The check is not in the table yet. Here it is a function beside
// the table that does what the plan says: it runs in a microtask after new
// rows, computes `total = price * qty`, reports a cell whose row holds
// another value, and never reports the same value for the same cell twice in
// a row. What is real is the report from a microtask, while the table still
// has the rows of its last render, and what a Vue owner does with it.

type Line = { id: string; price: number; qty: number; total: number }

const columns: ColumnDef<Line>[] = [
	{ id: 'price', header: 'Price' },
	{ id: 'qty', header: 'Quantity' },
	{ id: 'total', header: 'Total' },
]

const wrappers: { unmount: () => void }[] = []
afterEach(() => {
	for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

type Owner = 'takes' | 'rounds' | 'refuses'

function setup(owner: Owner) {
	const rows = shallowRef<Line[]>([
		{ id: 'a', price: 2, qty: 3, total: 6 },
		{ id: 'b', price: 1.25, qty: 2, total: 2.5 },
	])
	const controller = createTableController()
	const reports: (readonly CellEdit<Line>[])[] = []
	const counts = { renders: 0, checks: 0 }
	const last = new Map<string, unknown>()
	const refused: string[] = []
	const check = () => {
		counts.checks++
		for (const row of rows.value) {
			const value = row.price * row.qty
			if (row.total === value || last.get(row.id) === value) continue
			last.set(row.id, value)
			try {
				void controller.editCell(row.id, 'total', value)
			} catch (error) {
				// The table throws for a value that a listener refused; the check goes on with the next cell.
				refused.push(String(error))
			}
		}
	}
	// The table will see new rows as a new option; a microtask after it, the check runs.
	watch(rows, () => queueMicrotask(check), { flush: 'sync' })
	const wrapper = mount(
		() => {
			counts.renders++
			return h(Table<Line>, {
				rows: rows.value,
				columns,
				controller,
				editable: true,
				'aria-label': 'Lines',
				onCellEdit: (edits: readonly CellEdit<Line>[], details: TableEditDetails) => {
					reports.push(edits)
					if (owner === 'refuses') return details.cancel()
					const taken =
						owner === 'rounds'
							? edits.map((edit) => ({ ...edit, value: Math.round(Number(edit.value)) }))
							: edits
					rows.value = applyEdits(rows.value, taken)
				},
			})
		},
		{ attachTo: document.body },
	)
	wrappers.push(wrapper)
	const cell = (rowId: string) =>
		wrapper.get(`tbody tr:nth-child(${rowId === 'a' ? 1 : 2}) td[data-column="total"]`)
	return { rows, reports, counts, cell, refused }
}

/** Waits until no microtask and no render is left. */
async function rest() {
	for (let round = 0; round < 5; round++) {
		await nextTick()
		await Promise.resolve()
	}
}

test('P1: an owner that takes the result gets one report, and one render follows it', async () => {
	const { rows, reports, counts, cell } = setup('takes')
	await rest()
	const renders = counts.renders
	rows.value = rows.value.map((row) => (row.id === 'b' ? { ...row, price: 1.5 } : row))
	await rest()
	expect(
		reports.map((edits) => edits.map((edit) => [edit.rowId, edit.previous, edit.value])),
	).toEqual([[['b', 2.5, 3]]])
	// The report comes before the render of the new rows, so the owner takes
	// the result in the same flush: one render for the load and the result.
	expect(counts.renders - renders).toBe(1)
	expect(counts.checks).toBe(2)
	expect(cell('b').text()).toBe('3')
})

test('P1: an owner that rounds the result gets one report, and no loop', async () => {
	const { rows, reports, counts, cell } = setup('rounds')
	await rest()
	const renders = counts.renders
	rows.value = rows.value.map((row) => (row.id === 'b' ? { ...row, price: 1.75 } : row))
	await rest()
	expect(reports).toHaveLength(1)
	expect(reports[0]?.[0]).toMatchObject({ rowId: 'b', value: 3.5 })
	// The owner kept 4. The check sees it, and the value 3.5 was reported last: no second report.
	expect(cell('b').text()).toBe('4')
	expect(counts.renders - renders).toBe(1)
	expect(counts.checks).toBe(2)
})

test('P1: an owner that refuses the result gets one report, and its rows stay', async () => {
	const { rows, reports, counts, cell, refused } = setup('refuses')
	await rest()
	const renders = counts.renders
	rows.value = rows.value.map((row) => (row.id === 'a' ? { ...row, qty: 4 } : row))
	await rest()
	expect(reports).toHaveLength(1)
	expect(cell('a').text()).toBe('6')
	expect(refused).toEqual([
		'Error: Column "total" refuses 8 for row "a": The change was not saved.',
	])
	expect(counts.renders - renders).toBe(1)
	expect(counts.checks).toBe(1)
})

test('P1: two loads in one turn give one report with the value of the last load', async () => {
	const { rows, reports, cell } = setup('takes')
	await rest()
	rows.value = rows.value.map((row) => (row.id === 'b' ? { ...row, price: 2 } : row))
	rows.value = rows.value.map((row) => (row.id === 'b' ? { ...row, price: 3 } : row))
	await rest()
	// Both checks ran after the second load, and the second check found the row taken.
	expect(reports.map((edits) => edits.map((edit) => edit.value))).toEqual([[6]])
	expect(cell('b').text()).toBe('6')
})
