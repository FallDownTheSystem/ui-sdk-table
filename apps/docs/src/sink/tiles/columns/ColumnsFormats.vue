<script setup lang="ts">
import { linkOf, Table, type ColumnDef } from 'ui-sdk-table-vue'
import { computed, shallowRef } from 'vue'
import SinkSwitch from '../../parts/SinkSwitch.vue'

type Plan = {
	id: string
	name: string
	price: number
	share: number
	since: string
	site: string
	active: boolean
}

const plans: Plan[] = [
	{
		id: 'a',
		name: 'Starter',
		price: 9,
		share: 0.52,
		since: '2023-02-01',
		site: 'https://example.com/starter',
		active: true,
	},
	{
		id: 'b',
		name: 'Team',
		price: 29,
		share: 0.31,
		since: '2023-09-15',
		site: 'https://example.com/team',
		active: true,
	},
	{
		id: 'c',
		name: 'Business',
		price: 99,
		share: 0.12,
		since: '2024-04-20',
		site: 'https://example.com/business',
		active: true,
	},
	{
		id: 'e',
		name: 'Enterprise',
		price: 499,
		share: 0.025,
		since: '2025-06-30',
		site: 'https://example.com/enterprise',
		active: true,
	},
	{
		id: 'd',
		name: 'Legacy',
		price: 15,
		share: 0.025,
		since: '2019-11-05',
		site: 'https://example.com/legacy',
		active: false,
	},
]
const columns: ColumnDef<Plan>[] = [
	{ id: 'name', header: 'Plan' },
	{
		id: 'price',
		header: 'Price',
		format: 'currency',
		formatOptions: { showUnit: true, currency: 'USD' },
	},
	{
		id: 'share',
		header: 'Share',
		format: 'percentage',
		formatOptions: { showUnit: true, maximumFractionDigits: 1 },
	},
	{
		id: 'since',
		header: 'Since',
		format: 'date',
		formatOptions: { dateStyle: 'medium', timeZone: 'UTC' },
	},
	{ id: 'site', header: 'Page', format: 'url' },
	{ id: 'active', header: 'Sold', format: 'boolean' },
]

// Off, every column shows the value as the data holds it, so the work of a format shows.
const formatted = shallowRef(true)
const shown = computed(() =>
	formatted.value
		? columns
		: columns.map((column) => ({ ...column, format: undefined, formatOptions: undefined })),
)
</script>

<template>
	<div class="demo">
		<div class="demo-bar">
			<SinkSwitch v-model="formatted">Formatted</SinkSwitch>
		</div>
		<div class="sink-frame">
			<Table
				:rows="plans"
				:columns="shown"
				locale="en-US"
				aria-label="Plans, each value in its format"
			>
				<!-- The table gives a link as text. The link itself is the work of this slot, for every cell. -->
				<template #cell="{ column, value, text }">
					<a v-if="column.format === 'url'" class="cell-link" :href="linkOf(value, 'url')?.href">{{
						text
					}}</a>
					<template v-else>{{ text }}</template>
				</template>
			</Table>
		</div>
	</div>
</template>
