<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'
import { euro, orders, type Order } from '../../data'
import SinkIcon from '../../parts/SinkIcon.vue'

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer' },
	{ id: 'status', header: 'Status' },
	{ id: 'total', header: 'Total', format: 'currency', formatOptions: euro },
]
// A paid order has nothing more to say.
const hasDetail = (order: Order) => order.status !== 'Paid'
const open = shallowRef<readonly string[]>(['o2'])
</script>

<template>
	<div class="demo">
		<div class="sink-frame">
			<Table
				v-model:expanded="open"
				:rows="orders"
				:columns="columns"
				:has-detail="hasDetail"
				sticky-header
				aria-label="Orders, with details for the open and the late ones"
			>
				<template #col-customer="{ text, expandable, expanded, toggleExpanded }">
					<span class="cell-name">
						<Button
							v-if="expandable"
							class="twist"
							:aria-expanded="expanded"
							:aria-label="`Details of ${text}`"
							@click="toggleExpanded"
						>
							<SinkIcon name="chevron" />
						</Button>
						<span v-else class="twist-gap" />
						{{ text }}
					</span>
				</template>
				<template #detail="{ row }">
					<dl class="detail-list">
						<dt>Order</dt>
						<dd>{{ row.id }}, {{ row.items }} items, placed {{ row.placed }}</dd>
						<dt>Ships to</dt>
						<dd>{{ row.city }}</dd>
						<dt>Next step</dt>
						<dd>
							{{ row.status === 'Late' ? 'Send a reminder today.' : 'Wait for the payment.' }}
						</dd>
					</dl>
				</template>
			</Table>
		</div>
		<p class="demo-note" role="status">
			{{ open.length ? `Open: ${open.join(', ')}` : 'No order is open' }}
		</p>
	</div>
</template>
