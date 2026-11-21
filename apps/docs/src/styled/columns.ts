import type { DataTableColumn } from 'ui-sdk-table-styled'
import type { Person, Task } from './data'

export const basicColumns: DataTableColumn<Person>[] = [
	{ id: 'name', header: 'Name' },
	{ id: 'role', header: 'Role' },
	{ id: 'age', header: 'Age', format: 'integer' },
]

export const sortableColumns: DataTableColumn<Person>[] = basicColumns.map((column) => ({
	...column,
	sortable: true,
}))

export const taskColumns: DataTableColumn<Task>[] = [
	{ id: 'title', header: 'Title', sortable: true },
	{ id: 'priority', header: 'Priority', groupable: true },
	{ id: 'status', header: 'Status', groupable: true },
]
