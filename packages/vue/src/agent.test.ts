import { createAgent } from '@ui-sdk/vue/agent'
import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { h, nextTick } from 'vue'
import { Table, type ColumnDef, type TableChangeDetails } from './index'

type Person = { id: string; name: string; score: number }

const people: Person[] = [
	{ id: 'a', name: 'Aino', score: 70 },
	{ id: 'b', name: 'Eero', score: 20 },
]
const columns: ColumnDef<Person>[] = [{ id: 'name' }, { id: 'score', sortable: true }]

test('an agent finds the table by its name, acts on it, and reads a useful error', async () => {
	const sources: string[] = []
	const wrapper = mount(
		() =>
			h(Table<Person>, {
				rows: people,
				columns,
				selection: 'multiple',
				'aria-label': 'People',
				onSortChange: (_value: unknown, details: TableChangeDetails) =>
					sources.push(details.source),
			}),
		{ attachTo: document.body },
	)
	const agent = createAgent()

	const seen = agent.snapshot().find((component) => component.label === 'People')
	expect(seen?.actions).toEqual(expect.arrayContaining(['sortBy', 'setSearch', 'select']))

	const sorted = await agent.act({
		steps: [
			{ ref: 'People', action: 'sortBy', args: ['score', 'desc'] },
			{ ref: 'People', action: 'select', args: ['a'] },
		],
	})
	await nextTick()
	expect(sorted.ok).toBe(true)
	expect(sources).toEqual(['agent'])
	expect(wrapper.findAll('tbody tr').map((row) => row.find('td').text())).toEqual(['Aino', 'Eero'])
	expect(wrapper.get('tbody tr[aria-selected="true"]').text()).toContain('Aino')

	const failed = await agent.act({ steps: [{ ref: 'People', action: 'sortBy', args: ['age'] }] })
	expect(failed.ok).toBe(false)
	expect(failed.error?.message).toContain('No column "age" to sort by. Columns: name, score.')

	wrapper.unmount()
})

test('an agent hides and resets the columns, and hears why a sort cannot add a column', async () => {
	const wrapper = mount(
		() =>
			h(Table<Person>, {
				rows: people,
				columns: [...columns, { id: 'id', aggregate: 'count' }],
				multiSort: 'none',
				defaultColumnVisibility: { id: false },
				'aria-label': 'Staff',
			}),
		{ attachTo: document.body },
	)
	const agent = createAgent()
	const headers = () => wrapper.findAll('thead th').map((cell) => cell.attributes('data-column'))

	const seen = agent.snapshot().find((component) => component.label === 'Staff')
	expect(seen?.actions).toEqual(
		expect.arrayContaining([
			'hideAllColumns',
			'resetColumnVisibility',
			'resetColumnOrder',
			'resetColumnPinning',
			'getTotals',
			'flushSearch',
		]),
	)

	const hidden = await agent.act({
		steps: [
			{ ref: 'Staff', action: 'setColumnVisibility', args: ['id', true] },
			{ ref: 'Staff', action: 'hideAllColumns', args: [] },
		],
	})
	await nextTick()
	expect(hidden.ok).toBe(true)
	expect(headers()).toEqual(['name'])

	const reset = await agent.act({
		steps: [{ ref: 'Staff', action: 'resetColumnVisibility', args: [] }],
	})
	await nextTick()
	expect(reset.ok).toBe(true)
	expect(headers()).toEqual(['name', 'score'])

	const refused = await agent.act({
		steps: [{ ref: 'Staff', action: 'toggleSort', args: ['score', { append: true }] }],
	})
	expect(refused.ok).toBe(false)
	expect(refused.error?.message).toContain('its `multiSort` option is "none"')

	const unknown = await agent.act({
		steps: [{ ref: 'Staff', action: 'getTotals', args: ['group/team=Design'] }],
	})
	expect(unknown.ok).toBe(false)
	expect(unknown.error?.message).toContain('No group "group/team=Design" to read the totals of.')

	wrapper.unmount()
})
