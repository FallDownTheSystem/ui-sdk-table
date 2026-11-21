import type { ChangeSource } from '@ui-sdk/core'

/** One cell of a step: the value that it held before the step and after it. */
export type CellChange = { rowId: string; columnId: string; before: unknown; after: unknown }

/**
 * One step of the history of a table: the cells that one report gave new
 * values. A step holds ids and values, and never a row object. A value can
 * be an object of the owner, such as a date; the step keeps the reference
 * and never changes it.
 */
export type TableStep<Reason extends string = string> = {
	id: number
	/** What made the step: the reason of its edit. */
	reason: Reason
	/** Who made it: a person with a key or a pointer, code, or an agent. */
	source: ChangeSource
	cells: readonly CellChange[]
}

/** A step as `getHistory` shows it: what made it and how many cells it holds, without the values. */
export type HistoryEntry<Reason extends string = string> = {
	id: number
	reason: Reason
	source: ChangeSource
	cells: number
}

/** What a step weighs against the `maxCells` of the history. A step is never free, so the list has an end. */
export function stepSize(step: TableStep): number {
	return Math.max(1, step.cells.length)
}
