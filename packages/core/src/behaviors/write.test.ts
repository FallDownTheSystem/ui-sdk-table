import { describe, expect, test } from 'vite-plus/test'
import { checkValue, parseText, type CellEdit, type Checked, type StandardSchemaV1 } from '../edit'
import { cellValue, type ColumnDef, type DataRow } from '../rows'
import { createCellWrites, type WriteDetails, type WriteTarget } from './write'

type Item = { id: string; name: string; stock: number }

const texts = {
	notNumber: (text: string) => `"${text}" is not a number.`,
	notDate: (text: string) => `"${text}" is not a date.`,
	notBoolean: () => 'Not a boolean.',
}

const positive = (later = false): StandardSchemaV1 => ({
	'~standard': {
		version: 1,
		vendor: 'test',
		validate: (value) => {
			const result =
				typeof value === 'number' && value >= 0
					? { value }
					: { issues: [{ message: 'Stock must be 0 or more.' }] }
			return later ? Promise.resolve(result) : result
		},
	},
})

function setup(schema?: StandardSchemaV1) {
	const name: ColumnDef = { id: 'name', header: 'Name' }
	const stock: ColumnDef = { id: 'stock', header: 'Stock', schema }
	const world = {
		rows: [
			{ id: 'a', name: 'Bolt', stock: 4 },
			{ id: 'b', name: 'Nut', stock: 9 },
		] as Item[],
		reports: [] as { edits: CellEdit[]; details: WriteDetails<string> }[],
		refuse: false,
	}
	const destroy: (() => void)[] = []
	const writes = createCellWrites<string>(
		{ onDestroy: (run) => void destroy.push(run) },
		{
			rowById: (id): DataRow<unknown> | undefined => {
				const index = world.rows.findIndex((row) => row.id === id)
				const row = world.rows[index]
				return row && { kind: 'row', id, row, index, depth: 0, parentId: null }
			},
			check: (input, row, column): Checked | Promise<Checked> => {
				const parsed = 'text' in input ? parseText(input.text, row, column, texts) : input
				return 'issues' in parsed ? parsed : checkValue(column.schema, parsed.value)
			},
			valueOf: (node, column) => cellValue(node.row, column),
			report: (edits, details) => {
				world.reports.push({ edits, details })
				return world.refuse
			},
			refusal: {
				value: ({ reason, column, text, message }) =>
					`${reason}: ${column.header} refuses "${text}": ${message}`,
				invalid: () => 'Not valid.',
				rowGone: () => 'The row is gone.',
				refused: () => 'Refused.',
				tableGone: () => 'The table is gone.',
			},
		},
	)
	const target = (rowId: string, column: ColumnDef, text: string): WriteTarget => ({
		rowId,
		column,
		input: { text },
	})
	return { world, writes, name, stock, target, destroy: () => destroy.forEach((run) => run()) }
}

describe('one write for many cells', () => {
	test('every target that passes is in one report, with the row of now and the value before', () => {
		const { world, writes, name, stock, target } = setup(positive())
		const details = { reason: 'paste' }
		const count = writes.write(
			[target('a', name, 'Screw'), target('a', stock, '5'), target('b', stock, '12')],
			details,
		)
		expect(count).toBe(3)
		expect(world.reports).toHaveLength(1)
		expect(world.reports[0]?.details).toBe(details)
		expect(
			world.reports[0]?.edits.map((edit) => [edit.rowId, edit.columnId, edit.previous, edit.value]),
		).toEqual([
			['a', 'name', 'Bolt', 'Screw'],
			['a', 'stock', 4, 5],
			['b', 'stock', 9, 12],
		])
		expect(world.reports[0]?.edits[0]?.row).toBe(world.rows[0])
		expect(writes.pending()).toBe(false)
	})

	test('one refusal stops the write before anything is reported', () => {
		const { world, writes, name, stock, target } = setup(positive())
		expect(() =>
			writes.write([target('a', name, 'Screw'), target('b', stock, '-1')], { reason: 'paste' }),
		).toThrow('paste: Stock refuses "-1": Stock must be 0 or more.')
		// A text that is no number is refused by the parse, with the same words around it.
		expect(() => writes.write([target('b', stock, 'many')], { reason: 'fill' })).toThrow(
			'fill: Stock refuses "many": "many" is not a number.',
		)
		// A value that is not a text shows as its text in the refusal.
		expect(() =>
			writes.write([{ rowId: 'b', column: stock, input: { value: -3 } }], { reason: 'clear' }),
		).toThrow('clear: Stock refuses "-3": Stock must be 0 or more.')
		expect(world.reports).toEqual([])
	})

	test('a cell that would get the value it holds is left out, and nothing at all is no report', () => {
		const { world, writes, name, stock, target } = setup()
		expect(
			writes.write([target('a', name, 'Bolt'), target('a', stock, '5')], { reason: 'paste' }),
		).toBe(1)
		expect(world.reports[0]?.edits.map((edit) => edit.columnId)).toEqual(['stock'])
		expect(writes.write([target('a', name, 'Bolt')], { reason: 'paste' })).toBe(0)
		expect(world.reports).toHaveLength(1)
	})

	test('a listener that refuses the report makes the write throw', () => {
		const { world, writes, name, target } = setup()
		world.refuse = true
		expect(() => writes.write([target('a', name, 'Screw')], { reason: 'paste' })).toThrow(
			'Refused.',
		)
		expect(world.reports).toHaveLength(1)
	})

	test('a row that is not in the table refuses the write at once', () => {
		const { world, writes, name, target } = setup()
		expect(() => writes.write([target('x', name, 'Screw')], { reason: 'paste' })).toThrow(
			'The row is gone.',
		)
		expect(world.reports).toEqual([])
	})

	test('a check that answers later: the write waits, and reports on the rows of then', async () => {
		const { world, writes, stock, target } = setup(positive(true))
		const result = writes.write([target('a', stock, '5'), target('b', stock, '6')], {
			reason: 'paste',
		})
		expect(result).toBeInstanceOf(Promise)
		expect(writes.pending()).toBe(true)
		expect(world.reports).toEqual([])
		// The owner replaces a row while the check runs.
		const now = { id: 'a', name: 'Bolt', stock: 5 }
		world.rows = [now, world.rows[1] as Item]
		await expect(result).resolves.toBe(1)
		expect(writes.pending()).toBe(false)
		// Row a holds 5 already, so only row b changed, and its row is the object of now.
		expect(world.reports[0]?.edits.map((edit) => [edit.rowId, edit.previous, edit.value])).toEqual([
			['b', 9, 6],
		])
	})

	test('a row that left while the check ran refuses the whole write', async () => {
		const { world, writes, stock, target } = setup(positive(true))
		const result = writes.write([target('a', stock, '5'), target('b', stock, '6')], {
			reason: 'paste',
		})
		world.rows = world.rows.slice(0, 1)
		await expect(result).rejects.toThrow('The row is gone.')
		expect(world.reports).toEqual([])
		expect(writes.pending()).toBe(false)
	})

	test('a table that is gone at the answer reports nothing', async () => {
		const { world, writes, stock, target, destroy } = setup(positive(true))
		const result = writes.write([target('a', stock, '5')], { reason: 'paste' })
		destroy()
		await expect(result).rejects.toThrow('The table is gone.')
		expect(world.reports).toEqual([])
	})
})
