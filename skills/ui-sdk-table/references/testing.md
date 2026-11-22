# Test a table

Set up the tests as the `testing.md` of the `ui-sdk` skill says, with `@vue/test-utils` or `@testing-library/vue`. Test what you built, not what the library already tests: that your columns, slots, options and controls are wired, and that your looks hold.

## What jsdom cannot see

A keyboard or focus rule is not done until a browser test covers it, for example with Playwright. jsdom has passed a tab order, a page reset and Enter on a group row that were all wrong in a browser. Test these in a browser:

- **Tab** goes into the table once, to one cell, and out again. Inside the table the arrows move. With an editor open, Tab saves and moves.
- **Focus comes back.** After a menu, a dialog, a toolbar button or a formula bar commit, focus is on the active cell (`[data-active]`) or on the control that opened it.
- **A press on each control** you placed: every sort header, every box of a column menu, every page button. Check the rows or the state after it, not only that nothing threw.
- **An open editor** keeps the width of its column and the height of its row. Measure the column before and while the editor is open.
- **Sticky parts** stay inside their frame, and nothing of the table lies over a sticky bar of the page.

## Colour

Check colour in a real browser, in each state that has its own fill: a hover, a selected row, the active cell, a range, a pinned column, a sticky header over scrolled rows, an error of a formula. Text needs 4.5:1 against what is behind it. The edge of a control, a focus ring and a mark such as a checked box or the current page need 3:1. A sticky cell is opaque, so measure against its own background.

## The agent test

Write this test for every table: the table has a name, and an agent can act on it as a person does.

```ts
import { createAgent } from '@ui-sdk/vue/agent'
import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import ShipList from './ShipList.vue'

test('an agent can find and sort the ships', async () => {
	const agent = createAgent()
	const wrapper = mount(ShipList, { attachTo: document.body })

	const entry = agent.snapshot().find((item) => item.label === 'Ships in port')
	expect(entry, 'the table has no name').toBeTruthy()

	const result = await agent.act({
		steps: [{ ref: 'Ships in port', action: 'sortBy', args: ['tons', 'desc'] }],
	})
	expect(result.ok, result.error?.message).toBe(true)
	expect(wrapper.find('tbody tr').text()).toContain('Blue Heron')

	const wrong = await agent.act({
		steps: [{ ref: 'Ships in port', action: 'sortBy', args: ['weight', 'desc'] }],
	})
	expect(wrong.error?.message).toContain('tons')
	wrapper.unmount()
})
```

- Check the rows after an action, not only `ok`: a listener can refuse a change with `details.cancel()`.
- A wrong argument answers with a message that lists the valid values. Assert a part of it, so a change of the column ids fails the test.
- The actions are the methods of the controller. See `docs/agents.md`.

## Before you call it done

- `vue-tsc` passes, with `ColumnDef<Row>[]` on every list of columns.
- Every key and focus rule above has a browser test.
- The colours hold in every state.
- The agent test passes.
