import type { ChangeSource } from '@ui-sdk/core'
import type { CellFormulas } from '../formula/types'
import type { CellFormats } from './formats'

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
	/** The cells that got a new value. Empty for a step of formats. */
	cells: readonly CellChange[]
	/**
	 * The formats before and after, for a step of formats, and how many cells
	 * the change was for. Two references to values that share their parts, so
	 * a step for 50,000 cells holds two pointers.
	 */
	formats?: { before: CellFormats; after: CellFormats; cells: number }
	/** The formulas before and after, for a step that changed formulas, as `formats`. */
	formulas?: { before: CellFormulas; after: CellFormulas; cells: number }
}

/** A step as `getHistory` shows it: what made it and how many cells it holds, without the values. */
export type HistoryEntry<Reason extends string = string> = {
	/** The number of the step: the steps of a table count up from 1. */
	id: number
	/** What made the step: the reason of its edit, `shortcut` or `formula`. */
	reason: Reason
	/** Who made it: a person with a key or a pointer, code, or an agent. */
	source: ChangeSource
	/** How many cells got a new value. 0 for a step of formats. */
	cells: number
	/** Whether the step changed formats and no value. */
	formats: boolean
	/** Whether the step changed formulas. */
	formulas: boolean
}

/** What a step weighs against the `maxCells` of the history. A step is never free, so the list has an end. */
export function stepSize(step: TableStep): number {
	return Math.max(1, step.cells.length)
}
