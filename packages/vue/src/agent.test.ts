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
