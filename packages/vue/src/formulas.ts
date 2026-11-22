// The formula engine, an entry of its own, as in `ui-sdk-table-core/formulas`.
export * from 'ui-sdk-table-core/formulas'
import type { FormulaView, TableController } from 'ui-sdk-table-core'
import { computed, getCurrentScope, onScopeDispose, shallowRef, type ComputedRef } from 'vue'

export type FormulaBar = {
	/** The address of the cell, such as `D7`, or `''` without an active cell. */
	address: ComputedRef<string>
	/** The text of the field: the draft while a person types, else the formula or the value of the cell. */
	text: ComputedRef<string>
	/** Why the last commit was refused, in the words for a person, or `''`. */
	error: ComputedRef<string>
	/** Whether the text is a draft that is not saved. */
	dirty: ComputedRef<boolean>
	/** Whether a cell is active, so the field can be used. */
	ready: ComputedRef<boolean>
	/** The new text of the field. */
	input: (text: string) => void
	/** Saves the draft into its cell, as the editor of the cell does. Returns whether it was saved. */
	commit: () => boolean
	/** Drops the draft and the error. */
	cancel: () => void
}

/**
 * The data of a formula bar: a text field above the table for the active
 * cell. Pass the controller that the table has as its `controller` prop.
 * A draft stays with the cell where it started, also when the active cell
 * moves, and `commit` saves it there: a text with `=` is a formula, any
 * other text a value that takes a formula away. A refusal keeps the draft
 * with its words in `error`.
 */
export function useFormulaBar(controller: TableController): FormulaBar {
	const view = shallowRef<FormulaView | null>(null)
	const draft = shallowRef<{ at: FormulaView; text: string } | null>(null)
	const error = shallowRef('')
	// A refusal carries the words for a person as its `cause`; its message is for a developer.
	const refusal = (reason: unknown) =>
		reason instanceof Error
			? typeof reason.cause === 'string'
				? reason.cause
				: reason.message
			: String(reason)
	const read = () => {
		const next: ReturnType<TableController['getView']> | undefined = controller.getView()
		view.value = next?.formula ?? null
	}
	const stop: (() => void) | undefined = controller.subscribe(read)
	read()
	if (getCurrentScope()) onScopeDispose(() => stop?.())

	const shown = computed(() => draft.value?.at ?? view.value)
	return {
		address: computed(() => shown.value?.address ?? ''),
		text: computed(() => draft.value?.text ?? view.value?.text ?? ''),
		error: computed(() => error.value),
		dirty: computed(() => draft.value !== null),
		ready: computed(() => shown.value !== null),
		input(text) {
			const at = draft.value?.at ?? view.value
			if (!at) return
			draft.value = { at, text }
			error.value = ''
		},
		commit() {
			const waiting = draft.value
			if (!waiting) return true
			try {
				const saved = controller.editCell(waiting.at.rowId, waiting.at.columnId, waiting.text)
				// A check of the column that takes time answers later.
				if (saved) {
					void saved.then(
						() => {
							draft.value = null
						},
						(reason: unknown) => {
							error.value = refusal(reason)
						},
					)
					return false
				}
			} catch (reason) {
				error.value = refusal(reason)
				return false
			}
			draft.value = null
			error.value = ''
			return true
		},
		cancel() {
			draft.value = null
			error.value = ''
		},
	}
}
