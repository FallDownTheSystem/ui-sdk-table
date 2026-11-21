<script setup lang="ts">
import { applyEdits, Table, type CellEdit, type ColumnDef } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { check } from '../../data'

type Account = { id: string; handle: string; owner: string }

const rows = shallowRef<Account[]>([
	{ id: 'a1', handle: 'aino', owner: 'Aino Aalto' },
	{ id: 'a2', handle: 'eero', owner: 'Eero Niemi' },
	{ id: 'a3', handle: 'helmi', owner: 'Helmi Virta' },
	{ id: 'a4', handle: 'onni', owner: 'Onni Laine' },
])

// Only a server knows which names are taken. The editor waits for its answer.
const free = check(
	(value) =>
		new Promise((resolve) =>
			setTimeout(() => {
				const handle = String(value).trim().toLowerCase()
				const taken = rows.value.some((row) => row.handle === handle)
				resolve(
					taken
						? `"${handle}" is taken.`
						: handle.length < 3
							? 'Three letters or more.'
							: undefined,
				)
			}, 700),
		),
)
const columns: ColumnDef<Account>[] = [
	{ id: 'handle', header: 'Handle', schema: free, parse: (text) => text.trim().toLowerCase() },
	{ id: 'owner', header: 'Owner', editable: false },
]
</script>

<template>
	<div class="demo">
		<p class="demo-note">Rename "eero" to "aino", then to "eemeli".</p>
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				editable
				aria-label="Accounts with handles that a server checks"
				@cell-edit="(edits: readonly CellEdit<Account>[]) => (rows = applyEdits(rows, edits))"
			/>
		</div>
	</div>
</template>
