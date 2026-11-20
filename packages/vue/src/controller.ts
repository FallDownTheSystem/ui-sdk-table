import { createController } from '@ui-sdk/core'
import type { TableController } from 'ui-sdk-table-core'

/**
 * A handle to a table for code outside it. Pass it as the `controller` prop;
 * then call `sortBy`, `setSearch`, `select` and the other methods on it.
 * Before the table exists, a call does nothing.
 */
export function createTableController(): TableController {
	return createController<TableController>()
}
