import { createDebounce, type RangeSummary, type TableController } from 'ui-sdk-table-core'
import { getCurrentScope, onScopeDispose, shallowReadonly, shallowRef, type ShallowRef } from 'vue'

export type SelectionSummaryOptions = {
	/**
	 * Milliseconds that the selection must rest before its cells are counted,
	 * so a drag over many rows counts once at its end. Defaults to 100. One
	 * selected cell is counted at once.
	 */
	debounce?: number
}

/**
 * What the selected cells of a table add up to, as a ref, for a status bar:
 * the sum, the mean, the smallest and the largest number, and how many cells
 * hold a value. Pass the controller that the table has as its `controller`
 * prop. The ref holds `null` while no cell of a data row is selected, and
 * before the table exists.
 *
 * ```vue
 * <p v-if="summary">Sum {{ summary.texts.sum }}, average {{ summary.texts.mean }}</p>
 * ```
 *
 * Show it in a plain region and not in a live region: a sum after each step
 * of a selection is noise for a person who listens.
 */
export function useSelectionSummary(
	controller: TableController,
	options: SelectionSummaryOptions = {},
): Readonly<ShallowRef<RangeSummary | null>> {
	const summary = shallowRef<RangeSummary | null>(null)
	const count = () => {
		// Before the table exists, a controller answers `undefined`.
		const next: RangeSummary | null | undefined = controller.getSelectionSummary()
		summary.value = next ?? null
	}
	const later = createDebounce(count, { debounce: options.debounce ?? 100 })
	const read = () => {
		const view: ReturnType<TableController['getView']> | undefined = controller.getView()
		if (!view) return
		const cells = view.cellSelection
		// One cell costs nothing to count, and a person who moves with the arrows reads it at once.
		if (!cells || cells.rows * cells.columns <= 1) {
			later.cancel()
			count()
		} else later.call()
	}
	// A plain controller of UI SDK answers with nothing before its table exists.
	const stop: (() => void) | undefined = controller.subscribe(read)
	read()
	if (getCurrentScope()) {
		onScopeDispose(() => {
			later.cancel()
			stop?.()
		})
	}
	return shallowReadonly(summary)
}
