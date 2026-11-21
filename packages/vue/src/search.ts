import type { TableController } from 'ui-sdk-table-core'
import {
	computed,
	getCurrentScope,
	onScopeDispose,
	shallowReadonly,
	shallowRef,
	type ShallowRef,
	type WritableComputedRef,
} from 'vue'

export type TableSearch = {
	/**
	 * The text of the search field, for `v-model`. A new text shows at once,
	 * and the table filters when the typing pauses (`searchDebounce` of the
	 * table). A search text that the table gets from elsewhere shows here too.
	 */
	text: WritableComputedRef<string>
	/** Whether a text waits for its pause, so the rows do not follow the field yet. */
	pending: Readonly<ShallowRef<boolean>>
	/** Empties the search at once, for a clear button and for Escape. */
	clear: () => void
	/** Filters now by the text that waits, for Enter. */
	flush: () => void
}

/**
 * The search field of a table, in a few lines. Pass the controller that the
 * table has as its `controller` prop. It is safe to call before the table
 * exists: the field is empty until then.
 *
 * ```vue
 * <input v-model="search.text" @keydown.escape="search.clear()" @keydown.enter="search.flush()" />
 * ```
 */
export function useTableSearch(controller: TableController): TableSearch {
	const text = shallowRef('')
	const pending = shallowRef(false)

	const read = () => {
		// Before the table exists, a controller answers `undefined`.
		const view: ReturnType<TableController['getView']> | undefined = controller.getView()
		if (!view) return
		text.value = view.search
		pending.value = view.searchPending
	}
	// A plain controller of UI SDK answers with nothing before its table exists.
	const stop: (() => void) | undefined = controller.subscribe(read)
	read()
	if (stop && getCurrentScope()) onScopeDispose(stop)

	return {
		text: computed({
			get: () => text.value,
			set: (value) => {
				// The field holds the text also when no table hears it yet.
				text.value = value
				controller.inputSearch(value)
			},
		}),
		pending: shallowReadonly(pending),
		clear: () => controller.setSearch(''),
		flush: () => controller.flushSearch(),
	}
}
