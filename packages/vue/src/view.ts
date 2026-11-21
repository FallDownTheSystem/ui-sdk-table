import type { TableController, TableView } from 'ui-sdk-table-core'
import { getCurrentScope, onScopeDispose, shallowReadonly, shallowRef, type ShallowRef } from 'vue'

/**
 * What a table shows now, as a ref, for the controls beside it: the pages,
 * the rows found, a list of columns, the selection. Pass the controller that
 * the table has as its `controller` prop. The ref holds `undefined` until
 * the table exists, and a new view after each change of the table.
 *
 * A read that depends on the table, such as `controller.getFacets(id)`, goes
 * in a `computed` that reads this ref first, and is then asked again after
 * each change.
 *
 * ```vue
 * <p>{{ view?.dataRowCount }} rows, page {{ view?.page }} of {{ view?.pageCount }}</p>
 * ```
 */
export function useTableView(
	controller: TableController,
): Readonly<ShallowRef<TableView | undefined>> {
	const view = shallowRef<TableView>()
	const read = () => {
		// Before the table exists, a controller answers `undefined`.
		const next: TableView | undefined = controller.getView()
		if (next) view.value = next
	}
	// A plain controller of UI SDK answers with nothing before its table exists.
	const stop: (() => void) | undefined = controller.subscribe(read)
	read()
	if (stop && getCurrentScope()) onScopeDispose(stop)
	return shallowReadonly(view)
}
