import type { PrimitiveContext } from '@ui-sdk/core'
import { isThenable, sameValue, type CellEdit, type Checked } from '../edit'
import { toText, type ColumnDef, type DataRow } from '../rows'

/** A text is parsed as the editor parses it. A value goes to the schema as it is. */
export type WriteInput = { text: string } | { value: unknown }

/** One cell and what to put into it. */
export type WriteTarget = { rowId: string; column: ColumnDef; input: WriteInput }

export type WriteDetails<Reason extends string> = { reason: Reason; event?: Event }

export type CellWrites<Reason extends string> = {
	/**
	 * Checks every target, and then reports all of them as one edit. One
	 * refusal stops the write before any cell changes: half of a paste is
	 * worse than none. Returns how many cells got a new value, and throws
	 * with the reason of a refusal. The answer is a promise only when a check
	 * answers with one.
	 */
	write(targets: readonly WriteTarget[], details: WriteDetails<Reason>): number | Promise<number>
	/** Whether a write waits for a check that takes time. */
	pending(): boolean
}

/**
 * New values for many cells at once: a paste, a clear, a cut, a fill. Each of
 * them makes a list of targets, and this behavior holds the one rule that
 * they share: check all, then report once, and read each row again at the
 * answer, because the owner can replace its rows while a check runs.
 */
export function createCellWrites<Reason extends string>(
	context: Pick<PrimitiveContext<any, any, any>, 'onDestroy'>,
	options: {
		rowById: (id: string) => DataRow<unknown> | undefined
		/** Parses a text and checks the value, as the editor of the column does. */
		check: (
			input: WriteInput,
			row: unknown,
			column: ColumnDef,
			rowId: string,
		) => Checked | Promise<Checked>
		/** The value that a cell holds now. */
		valueOf: (node: DataRow<unknown>, column: ColumnDef) => unknown
		/** Tells the owner. Returns whether a listener refused. A check can give `{ value, formula }` for a formula. */
		report: (edits: CellEdit[], details: WriteDetails<Reason>) => boolean
		/** The words of each refusal. */
		refusal: {
			/** A check refused a value. `message` is the reason of the check. */
			value: (details: {
				reason: Reason
				column: ColumnDef
				text: string
				message: string
			}) => string
			/** What a check says when it gives no reason. */
			invalid: () => string
			/** A row left the table while its value was checked. */
			rowGone: () => string
			/** A listener refused the report. */
			refused: () => string
			/** The table was removed while a value was checked. */
			tableGone: () => string
		}
	},
): CellWrites<Reason> {
	let gone = false
	let waiting = 0
	context.onDestroy(() => {
		gone = true
	})
	const { refusal } = options

	return {
		write(targets, details) {
			const nodes: DataRow<unknown>[] = []
			const checks = targets.map((target) => {
				const node = options.rowById(target.rowId)
				if (!node) throw new Error(refusal.rowGone())
				nodes.push(node)
				return options.check(target.input, node.row, target.column, node.id)
			})
			const finish = (checked: readonly Checked[], late = false): number => {
				// A check that takes time can answer after the table is gone. Nothing is reported then.
				if (gone) throw new Error(refusal.tableGone())
				const edits: CellEdit[] = []
				checked.forEach((result, index) => {
					const target = targets[index]
					if (!target) return
					// The rows can be other objects after a check that took time.
					const node = late ? options.rowById(target.rowId) : nodes[index]
					if (!node) throw new Error(refusal.rowGone())
					if ('issues' in result) {
						const { input } = target
						throw new Error(
							refusal.value({
								reason: details.reason,
								column: target.column,
								text: 'text' in input ? input.text : toText(input.value),
								message: result.issues[0] ?? refusal.invalid(),
							}),
						)
					}
					const previous = options.valueOf(node, target.column)
					// A formula is a change also when the value it gives stays.
					const formula = 'formula' in result ? (result.formula as string) : undefined
					if (formula === undefined && sameValue(previous, result.value)) return
					edits.push({
						rowId: node.id,
						columnId: target.column.id,
						row: node.row,
						column: target.column,
						value: result.value,
						previous,
						...(formula === undefined ? undefined : { formula }),
					})
				})
				if (edits.length && options.report(edits, details)) throw new Error(refusal.refused())
				return edits.length
			}
			const ready = checks.filter((check): check is Checked => !isThenable(check))
			if (ready.length === checks.length) return finish(ready)
			waiting++
			return Promise.all(checks.map((check) => Promise.resolve(check)))
				.finally(() => {
					waiting--
				})
				.then((checked) => finish(checked, true))
		},
		pending: () => waiting > 0,
	}
}
