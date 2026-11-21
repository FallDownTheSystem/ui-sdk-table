<script setup lang="ts">
import { Table, type ColumnDef, type TableMessages } from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import { createOrders, euro, type Order } from '../../data'
import SinkSegment from '../../parts/SinkSegment.vue'

const LANGUAGES = [
	{ value: 'en', label: 'English' },
	{ value: 'fi', label: 'Suomi' },
] as const

const orders = createOrders(9)
const language = shallowRef<'en' | 'fi'>('fi')

// The words that the table says itself. A word that is not given stays English.
const FINNISH: Partial<TableMessages> = {
	groupRow: ({ text, count }) => `${text}, ${count} tilausta`,
	expandSign: () => '▸',
	collapseSign: () => '▾',
	noRows: () => 'Ei rivejä.',
}
const HEADERS = {
	en: { customer: 'Customer', status: 'Status', total: 'Total' },
	fi: { customer: 'Asiakas', status: 'Tila', total: 'Summa' },
}
const columns = computed<ColumnDef<Order>[]>(() => [
	{ id: 'customer', header: HEADERS[language.value].customer },
	{ id: 'status', header: HEADERS[language.value].status },
	{
		id: 'total',
		header: HEADERS[language.value].total,
		format: 'currency',
		formatOptions: euro,
		aggregate: 'sum',
	},
])
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<SinkSegment v-model="language" label="Language of the table" :items="LANGUAGES" />
		</div>
		<div class="sink-frame" :lang="language">
			<Table
				:rows="orders"
				:columns="columns"
				:messages="language === 'fi' ? FINNISH : undefined"
				:locale="language === 'fi' ? 'fi-FI' : 'en-GB'"
				:group-by="['status']"
				:default-expanded="['group/status=Late']"
				aria-label="Orders by status, in the chosen language"
			/>
		</div>
	</div>
</template>
