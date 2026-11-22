# Agents

Let an agent find a table on the page, read it and act on it, with the same actions that a person has.

The table is a UI SDK primitive with an agent part. The agent of UI SDK (`createAgent` of `@ui-sdk/vue/agent`) sees every component of the page that has an accessible name, with its state and its actions. A table is found by its `aria-label`.

<Example name="agents/agent" caption="Press Heaviest first: the agent sorts by tons. Press Sort by weight: no column has that id, and the table refuses with a message that lists the columns." />

## What an agent sees

- `agent.snapshot()` lists the table with its name, its state and its actions.
- The snapshot holds the controlled state of the table, such as `sort`, `filter` and `selected`. It holds no cell format and no formula: an agent reads those with `getCellFormat` and `getFormulaSummary`, so a snapshot of 50,000 rows stays small.
- `agent.act({ steps: [{ ref: 'Ships in port', action: 'sortBy', args: ['tons', 'desc'] }] })` calls an action. Its answer has `ok`, and `error.message` when the table refused.

## The actions

The actions are the methods of the controller: sort, search and filter, groups and pages, rows, selection, columns, cells, the sheet, formulas, `exportData`, and the reads `getFacets`, `getTotals` and `getSelectionSummary`.

An action checks its arguments. A wrong one throws a message that lists the valid values, such as `No column "weight" to sort by. Columns: name, port, tons.` The agent reads it and tries again.

## A change from an agent

A change that an agent made reaches the events as any change does, with `details.source` set to `agent`. Listen to it for analytics; never give an agent other rules than a person.

## Keep going

- The UI SDK docs for agents are at `node_modules/@ui-sdk/vue/docs/agents.md`: the bridge, the WebMCP tools and the rules of what an agent may do.
- [Controller and view](./controller-and-view.md) lists every method.

See the [More tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=more).
