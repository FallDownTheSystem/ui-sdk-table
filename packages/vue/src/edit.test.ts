import { createAgent } from '@ui-sdk/vue/agent'
import { Switch, SwitchThumb } from '@ui-sdk/vue/switch'
import { mount } from '@vue/test-utils'
import { afterEach, expect, test } from 'vite-plus/test'
import { defineComponent, h, nextTick, onUpdated, shallowRef } from 'vue'
import {
	applyEdits,
	createTableController,
	Table,
	type CellEdit,
	type CellRange,
	type CellSlotProps,
	type ColumnDef,
	type EditorSlotProps,
	type StandardSchemaV1,
	type TableEditDetails,
} from './index'

type Person = { id: string; name: string; team: string; score: number; active: boolean }

const people = (): Person[] => [
	{ id: 'a', name: 'Alice', team: 'Design', score: 70, active: true },
	{ id: 'b', name: 'Edward', team: 'Platform', score: 20, active: false },
	{ id: 'c', name: 'Hannah', team: 'Design', score: 45, active: true },
]

const TEAMS = ['Design', 'Platform', 'Sales']

const schema = (check: (value: unknown) => string | undefined): StandardSchemaV1 => ({
	'~standard': {
		version: 1,
		vendor: 'test',
		validate: (value) => {
			const message = check(value)
			return message === undefined ? { value } : { issues: [{ message }] }
		},
	},
})

const columns: ColumnDef<Person>[] = [
	{ id: 'name', header: 'Name' },
	{
		id: 'team',
		header: 'Team',
		schema: schema((value) =>
			TEAMS.includes(String(value)) ? undefined : `The team must be one of: ${TEAMS.join(', ')}.`,
		),
	},
	{
		id: 'score',
		header: 'Score',
		format: 'integer',
		schema: schema((value) =>
			typeof value === 'number' && value >= 0 && value <= 100
				? undefined
				: 'The score must be from 0 to 100.',
		),
	},
	{ id: 'active', header: 'Active', editable: false },
]

const wrappers: { unmount: () => void }[] = []
afterEach(() => {
	for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

/** A table whose owner puts each edit into its rows, as an app does. */
function setup(extra: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
	const rows = shallowRef(people())
	const edits: { edits: readonly CellEdit<Person>[]; details: TableEditDetails }[] = []
	const wrapper = mount(
		() =>
			h(
				Table<Person>,
				{
					rows: rows.value,
					columns,
					editable: true,
					'aria-label': 'People',
					onCellEdit: (list: readonly CellEdit<Person>[], details: TableEditDetails) => {
						edits.push({ edits: list, details })
						rows.value = applyEdits(rows.value, list)
					},
					...extra,
				},
				slots as never,
			),
		{ attachTo: document.body },
	)
	wrappers.push(wrapper)
	const cell = (row: number, col: number) =>
		wrapper.get(`tbody tr:nth-child(${row}) td:nth-child(${col})`)
	return { wrapper, rows, edits, cell }
}

test('a cell shows a text field while it is edited, and the owner of the rows gets the new value', async () => {
	const { wrapper, rows, edits, cell } = setup()
	const before = rows.value
	const name = cell(1, 1)
	;(name.element as HTMLElement).focus()
	await name.trigger('keydown', { key: 'Enter' })
	await nextTick()

	const input = name.get('input')
	expect(input.attributes('data-slot')).toBe('table-editor')
	expect(input.attributes('aria-label')).toBe('Edit Name')
	expect((input.element as HTMLInputElement).value).toBe('Alice')
	expect(document.activeElement).toBe(input.element)
	expect(name.attributes('data-editing')).toBe('')
	// One text field in the table: the other cells show their values.
	expect(wrapper.findAll('input')).toHaveLength(1)

	await input.setValue('Anna')
	await input.trigger('keydown', { key: 'Enter' })
	await nextTick()
	expect(edits).toHaveLength(1)
	expect(edits[0]?.edits[0]).toMatchObject({ rowId: 'a', columnId: 'name', value: 'Anna' })
	expect(rows.value[0]?.name).toBe('Anna')
	// The rows of the owner before the edit are as they were.
	expect(before[0]?.name).toBe('Alice')
	expect(wrapper.find('input').exists()).toBe(false)
	expect(cell(1, 1).text()).toBe('Anna')
	expect(document.activeElement).toBe(cell(1, 1).element)
})

test('a refused value keeps the text field open, marked invalid, with its message', async () => {
	const { edits, cell } = setup()
	const score = cell(2, 3)
	;(score.element as HTMLElement).focus()
	await score.trigger('keydown', { key: 'F2' })
	await nextTick()
	const input = score.get('input')
	expect((input.element as HTMLInputElement).value).toBe('20')
	expect(input.attributes('aria-invalid')).toBeUndefined()

	await input.setValue('250')
	await input.trigger('keydown', { key: 'Enter' })
	await nextTick()
	expect(edits).toHaveLength(0)
	expect(score.find('input').exists()).toBe(true)
	expect(score.get('input').attributes('aria-invalid')).toBe('true')
	const message = score.get('[data-slot="table-edit-error"]')
	expect(message.text()).toBe('The score must be from 0 to 100.')
	expect(score.get('input').attributes('aria-errormessage')).toBe(message.attributes('id'))
	expect(document.activeElement).toBe(score.get('input').element)

	// A key in the text field is text. It does not move the active cell.
	await score.get('input').trigger('keydown', { key: 'ArrowDown' })
	expect(document.activeElement).toBe(score.get('input').element)

	await score.get('input').trigger('keydown', { key: 'Escape' })
	await nextTick()
	expect(score.find('input').exists()).toBe(false)
	expect(score.text()).toBe('20')
	expect(document.activeElement).toBe(score.element)
})

test('the `edit-{id}` slot gives a cell its own editor, which saves through the same check', async () => {
	const { rows, edits, cell } = setup(
		{},
		{
			'edit-team': (props: EditorSlotProps<Person>) =>
				h('div', [
					h(
						'select',
						{
							'aria-label': 'Team',
							value: props.value,
							onChange: (event: Event) =>
								props.save((event.target as HTMLSelectElement).value, event),
						},
						[...TEAMS, 'Nowhere'].map((team) => h('option', { value: team }, team)),
					),
					h('button', { type: 'button', onClick: props.cancel }, 'Cancel'),
					props.error ? h('em', props.error) : null,
				]),
		},
	)
	const team = cell(1, 2)
	;(team.element as HTMLElement).focus()
	await team.trigger('keydown', { key: 'Enter' })
	await nextTick()
	expect(team.find('input').exists()).toBe(false)
	const select = team.get('select')

	await select.setValue('Nowhere')
	await nextTick()
	expect(edits).toHaveLength(0)
	expect(team.get('em').text()).toBe('The team must be one of: Design, Platform, Sales.')

	await team.get('select').setValue('Sales')
	await nextTick()
	expect(rows.value[0]?.team).toBe('Sales')
	expect(cell(1, 2).find('select').exists()).toBe(false)
	expect(cell(1, 2).text()).toBe('Sales')
	expect(document.activeElement).toBe(cell(1, 2).element)

	await cell(2, 2).trigger('dblclick')
	await nextTick()
	await cell(2, 2).get('button').trigger('click')
	await nextTick()
	expect(cell(2, 2).find('select').exists()).toBe(false)
	expect(edits).toHaveLength(1)
})

test('the start and the end of an edit render one cell, not the table', async () => {
	let renders = 0
	const Probe = defineComponent({
		props: { text: { type: String, required: true }, stamp: { type: Number, required: true } },
		setup(props) {
			onUpdated(() => renders++)
			return () => h('span', props.text)
		},
	})
	let stamp = 0
	const { cell } = setup(
		{},
		// A new prop at each render, so each render of a cell is counted.
		{ cell: (props: CellSlotProps<Person>) => h(Probe, { text: props.text, stamp: stamp++ }) },
	)
	;(cell(1, 1).element as HTMLElement).focus()
	await cell(1, 1).trigger('keydown', { key: 'Enter' })
	await nextTick()
	expect(cell(1, 1).find('input').exists()).toBe(true)
	expect(renders).toBe(0)
	await cell(1, 1).get('input').trigger('keydown', { key: 'Escape' })
	await nextTick()
	expect(cell(1, 1).find('input').exists()).toBe(false)
	expect(renders).toBe(0)
})

test('`v-model:cell-range` follows the range, and a copy and a paste of the controller go through it', async () => {
	const range = shallowRef<CellRange | null>(null)
	const api = createTableController()
	const { wrapper, rows, cell } = setup({
		cellSelection: true,
		controller: api,
		get cellRange() {
			return range.value
		},
		'onUpdate:cellRange': (value: CellRange | null) => (range.value = value),
	})
	;(cell(1, 1).element as HTMLElement).focus()
	await cell(1, 1).trigger('keydown', { key: 'ArrowDown', shiftKey: true })
	await cell(1, 1).trigger('keydown', { key: 'ArrowRight', shiftKey: true })
	await nextTick()
	expect(range.value).toEqual({ anchor: { row: 1, col: 0 }, end: { row: 2, col: 1 } })
	expect(wrapper.findAll('td[aria-selected="true"]')).toHaveLength(4)
	expect(wrapper.findAll('th[aria-selected]')).toHaveLength(0)

	expect(api.copyCells()).toBe('Alice\tDesign\nEdward\tPlatform')
	void api.pasteCells('Anna\tSales\nEddie\tDesign')
	await nextTick()
	expect(rows.value.slice(0, 2).map((row) => [row.name, row.team])).toEqual([
		['Anna', 'Sales'],
		['Eddie', 'Design'],
	])
	// The rows are new objects with the same ids, so the range stays.
	expect(range.value).toEqual({ anchor: { row: 1, col: 0 }, end: { row: 2, col: 1 } })

	range.value = null
	await nextTick()
	expect(wrapper.findAll('td[aria-selected="true"]')).toHaveLength(0)
})

test('a UI SDK control in a cell: Enter goes into it, its keys are its own, and Escape comes back', async () => {
	const { rows, cell } = setup(
		{ selection: 'multiple' },
		{
			'col-active': (props: CellSlotProps<Person>) =>
				h(
					Switch,
					{
						checked: props.row.active,
						'aria-label': `${props.row.name} is active`,
						onCheckedChange: (checked: boolean) =>
							(rows.value = rows.value.map((row) =>
								row.id === props.row.id ? { ...row, active: checked } : row,
							)),
					},
					() => h(SwitchThumb),
				),
		},
	)
	const active = cell(2, 4)
	const control = active.get('[role="switch"]')
	expect(control.attributes('aria-checked')).toBe('false')
	;(active.element as HTMLElement).focus()
	await active.trigger('keydown', { key: 'Enter' })
	expect(document.activeElement).toBe(control.element)

	// Space on the switch is for the switch. It does not select the row.
	await control.trigger('keydown', { key: ' ' })
	await control.trigger('click')
	await nextTick()
	expect(rows.value[1]?.active).toBe(true)
	expect(cell(2, 4).get('[role="switch"]').attributes('aria-checked')).toBe('true')
	expect(cell(2, 4).element.closest('tr')?.getAttribute('aria-selected')).toBe('false')
	// An arrow key on the switch does not move the active cell.
	await cell(2, 4).get('[role="switch"]').trigger('keydown', { key: 'ArrowDown' })
	expect(document.activeElement).toBe(cell(2, 4).get('[role="switch"]').element)

	await cell(2, 4).get('[role="switch"]').trigger('keydown', { key: 'Escape' })
	expect(document.activeElement).toBe(cell(2, 4).element)
	// A character on the cell does not open an editor: the column is not editable.
	await cell(2, 4).trigger('keydown', { key: 'x' })
	await nextTick()
	expect(cell(2, 4).find('[data-slot="table-editor"]').exists()).toBe(false)
})

test('an agent edits a cell with `editCell`, and reads why a value is refused', async () => {
	const { rows, edits } = setup()
	const agent = createAgent()
	const seen = agent.snapshot().find((component) => component.label === 'People')
	expect(seen?.actions).toEqual(
		expect.arrayContaining(['editCell', 'selectCells', 'copyCells', 'pasteCells']),
	)

	const done = await agent.act({
		steps: [{ ref: 'People', action: 'editCell', args: ['b', 'score', 64] }],
	})
	await nextTick()
	expect(done.ok).toBe(true)
	expect(edits[0]?.details).toMatchObject({ reason: 'imperative', source: 'agent' })
	expect(rows.value[1]?.score).toBe(64)

	const refused = await agent.act({
		steps: [{ ref: 'People', action: 'editCell', args: ['b', 'score', 640] }],
	})
	expect(refused.ok).toBe(false)
	expect(refused.error?.message).toContain(
		'Column "score" refuses 640 for row "b": The score must be from 0 to 100.',
	)
	const locked = await agent.act({
		steps: [{ ref: 'People', action: 'editCell', args: ['b', 'active', true] }],
	})
	expect(locked.error?.message).toContain(
		'cannot be edited. Columns with cells that can be edited: name, team, score.',
	)
	expect(rows.value[1]?.score).toBe(64)
	expect(edits).toHaveLength(1)
})

test('rows that the owner replaces while a value is checked get the edit, on the rows of now', async () => {
	let answer: () => void = () => {}
	const slow: StandardSchemaV1 = {
		'~standard': {
			version: 1,
			vendor: 'test',
			validate: (value) => new Promise((resolve) => (answer = () => resolve({ value }))),
		},
	}
	const { rows, edits, cell } = setup({
		columns: [{ id: 'name', header: 'Name', schema: slow }, ...columns.slice(1)],
	})
	;(cell(1, 1).element as HTMLElement).focus()
	await cell(1, 1).trigger('keydown', { key: 'Enter' })
	await nextTick()
	await cell(1, 1).get('input').setValue('Anna')
	await cell(1, 1).get('input').trigger('keydown', { key: 'Enter' })
	await nextTick()
	expect(cell(1, 1).get('input').attributes('aria-busy')).toBe('true')
	expect(cell(1, 1).get('input').attributes('readonly')).toBe('')

	// A refresh from a server: the same ids, other objects, and a new score.
	rows.value = people().map((row) => (row.id === 'a' ? { ...row, score: 71 } : row))
	await nextTick()
	answer()
	await new Promise((resolve) => setTimeout(resolve))
	await nextTick()

	expect(edits).toHaveLength(1)
	// The edit names the row object of now, so `applyEdits` finds it.
	expect(edits[0]?.edits[0]?.row).toMatchObject({ id: 'a', score: 71 })
	expect(edits[0]?.edits[0]?.previous).toBe('Alice')
	expect(rows.value[0]).toMatchObject({ name: 'Anna', score: 71 })
	expect(cell(1, 1).find('input').exists()).toBe(false)
	expect(cell(1, 1).text()).toBe('Anna')
})

test('an editor from a slot knows that its value is checked, and closes when the person presses another cell', async () => {
	let answer: () => void = () => {}
	const slow: StandardSchemaV1 = {
		'~standard': {
			version: 1,
			vendor: 'test',
			validate: (value) => new Promise((resolve) => (answer = () => resolve({ value }))),
		},
	}
	const { edits, cell } = setup(
		{ columns: [columns[0], { id: 'team', header: 'Team', schema: slow }, ...columns.slice(2)] },
		{
			'edit-team': (props: EditorSlotProps<Person>) =>
				h(
					'select',
					{
						'aria-label': 'Team',
						value: props.value,
						disabled: props.checking,
						onChange: (event: Event) =>
							props.save((event.target as HTMLSelectElement).value, event),
					},
					TEAMS.map((team) => h('option', { value: team }, team)),
				),
		},
	)
	;(cell(1, 2).element as HTMLElement).focus()
	await cell(1, 2).trigger('keydown', { key: 'Enter' })
	await nextTick()
	expect(cell(1, 2).get('select').attributes('disabled')).toBeUndefined()

	// A press on another cell: the pointer goes down, and focus comes to the cell.
	await cell(2, 1).trigger('pointerdown', { button: 0 })
	;(cell(2, 1).element as HTMLElement).focus()
	await nextTick()
	expect(cell(1, 2).find('select').exists()).toBe(false)
	expect(edits).toHaveLength(0)
	expect(document.activeElement).toBe(cell(2, 1).element)
	// The keys of the table work again.
	await cell(2, 1).trigger('keydown', { key: 'Enter' })
	await nextTick()
	expect(cell(2, 1).find('input').exists()).toBe(true)
	await cell(2, 1).get('input').trigger('keydown', { key: 'Escape' })
	await nextTick()

	;(cell(3, 2).element as HTMLElement).focus()
	await cell(3, 2).trigger('keydown', { key: 'Enter' })
	await nextTick()
	await cell(3, 2).get('select').setValue('Sales')
	await nextTick()
	expect(cell(3, 2).get('select').attributes('disabled')).toBe('')
	answer()
	await new Promise((resolve) => setTimeout(resolve))
	await nextTick()
	expect(cell(3, 2).find('select').exists()).toBe(false)
	expect(edits.map((edit) => edit.edits[0]?.value)).toEqual(['Sales'])
})

test('an editor of its own gets `inputMode` for a column with `numberKeyboard`, and the field of the table gets `inputmode`', async () => {
	const modes: (string | undefined)[] = []
	const { cell } = setup(
		{
			columns: columns.map((column) =>
				column.id === 'score' || column.id === 'name'
					? { ...column, numberKeyboard: true }
					: column,
			),
		},
		{
			'edit-score': (props: EditorSlotProps<Person>) => {
				modes.push(props.inputMode)
				return h('input', { inputmode: props.inputMode, 'aria-label': 'Score' })
			},
		},
	)
	await cell(1, 3).trigger('dblclick')
	await nextTick()
	expect(modes.at(-1)).toBe('decimal')
	expect(cell(1, 3).get('input').attributes('inputmode')).toBe('decimal')
	// The field of the table for the name, a column without a format.
	await cell(2, 1).trigger('dblclick')
	await nextTick()
	expect(cell(2, 1).get('input').attributes('inputmode')).toBe('decimal')
	// A column without the option.
	await cell(2, 2).trigger('dblclick')
	await nextTick()
	expect(cell(2, 2).get('input').attributes('inputmode')).toBeUndefined()
})
