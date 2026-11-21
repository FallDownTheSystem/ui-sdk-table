<script setup lang="ts">
import { Switch, SwitchThumb } from '@ui-sdk/vue/switch'
import {
	applyEdits,
	createTableController,
	Table,
	type CellEdit,
	type ColumnDef,
} from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Rule = { id: string; rule: string; on: boolean }

const rows = shallowRef<Rule[]>([
	{ id: 'r1', rule: 'Mail me new orders', on: true },
	{ id: 'r2', rule: 'Mail me late payments', on: true },
	{ id: 'r3', rule: 'Weekly summary', on: false },
	{ id: 'r4', rule: 'Stock below ten', on: false },
])
const columns: ColumnDef<Rule>[] = [
	{ id: 'rule', header: 'Rule', editable: false },
	{ id: 'on', header: 'On', format: 'boolean' },
]
const controller = createTableController()
const count = shallowRef(0)

function onCellEdit(edits: readonly CellEdit<Rule>[]) {
	rows.value = applyEdits(rows.value, edits)
	count.value += edits.length
}
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				:rows="rows"
				:columns="columns"
				:controller="controller"
				editable
				aria-label="Rules that switch on and off"
				@cell-edit="onCellEdit"
			>
				<template #col-on="{ row }">
					<Switch
						:checked="row.on"
						:aria-label="row.rule"
						@checked-change="(on) => controller.editCell(row.id, 'on', on)"
					>
						<SwitchThumb />
					</Switch>
				</template>
			</Table>
		</div>
		<p class="demo-note" role="status">{{ count }} edits reported</p>
	</div>
</template>
