# Rows

Show rows with child rows, a detail row under a row, rows pinned to an edge, and many thousand rows in a window.

Each row needs a stable id: its `id` property, or what `getRowId(row, index, parent)` returns. The table never copies or changes a row object.

## Tree rows

`getChildren(row)` gives the child rows of a row. With it, the table is a tree. The root then has the role `treegrid`, and each row has `aria-level`, `aria-posinset` and `aria-setsize`.

```vue title="tree.vue"
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Entry = { id: string; name: string; size?: number; children?: Entry[] }

const files: Entry[] = [
	{
		id: 'src',
		name: 'src',
		children: [
			{ id: 'src/main.ts', name: 'main.ts', size: 1.2 },
			{ id: 'src/app.vue', name: 'app.vue', size: 4.8 },
		],
	},
	{
		id: 'docs',
		name: 'docs',
		children: [{ id: 'docs/guide.md', name: 'guide.md', size: 9.5 }],
	},
	{ id: 'package.json', name: 'package.json', size: 0.9 },
]

const columns: ColumnDef<Entry>[] = [
	{ id: 'name', header: 'Name', sortable: true },
	{
		id: 'size',
		header: 'Size',
		sortable: true,
		format: 'decimal',
		formatOptions: { suffix: ' kB' },
	},
]
</script>

<template>
	<Table
		:rows="files"
		:columns="columns"
		:get-children="(entry: Entry) => entry.children"
		:default-expanded="['src']"
		aria-label="Files of a project"
	>
		<template #col-name="{ text, expandable, expanded, toggleExpanded }">
			<button
				v-if="expandable"
				type="button"
				:aria-expanded="expanded"
				:aria-label="`Folder ${text}`"
				@click="toggleExpanded"
			>
				{{ expanded ? '▾' : '▸' }}
			</button>
			{{ text }}
		</template>
	</Table>
</template>
```

Press the arrow before docs to open the folder. Sort by Size: the child rows sort inside their folder.

- `expanded` holds the ids of the open rows. `expand`, `collapse`, `toggleExpanded`, `expandAll` and `collapseAll` change it.
- The `#cell` slot gets `expandable`, `expanded`, `level` and `toggleExpanded`. Put the button that opens a row in a slot of your own.
- A row of a tree has `aria-level`, `aria-posinset` and `aria-setsize`, and `aria-expanded` when it has child rows.
- `sortChildren: false` keeps the child rows in their order.

## Detail rows

`hasDetail(row)` names the rows that have a detail row: one wide row under the row, which opens and closes as a tree row does.

```vue title="detail.vue"
<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Order = { id: string; customer: string; state: string; note: string }

const orders: Order[] = [
	{ id: 'o1', customer: 'Northway', state: 'Paid', note: '' },
	{ id: 'o2', customer: 'Sola', state: 'Late', note: 'Ten days late. Send a reminder today.' },
	{ id: 'o3', customer: 'Arc', state: 'Open', note: 'Waits for the signed contract.' },
]

const columns: ColumnDef<Order>[] = [
	{ id: 'customer', header: 'Customer' },
	{ id: 'state', header: 'State' },
]

// A paid order has nothing more to say. Pass the same function at each render.
const hasDetail = (order: Order) => order.state !== 'Paid'
const open = shallowRef<readonly string[]>([])
</script>

<template>
	<Table
		v-model:expanded="open"
		:rows="orders"
		:columns="columns"
		:has-detail="hasDetail"
		aria-label="Orders with notes"
	>
		<template #col-customer="{ text, expandable, expanded, toggleExpanded }">
			<button
				v-if="expandable"
				type="button"
				:aria-expanded="expanded"
				:aria-label="`Note of ${text}`"
				@click="toggleExpanded"
			>
				{{ expanded ? '▾' : '▸' }}
			</button>
			{{ text }}
		</template>
		<template #detail="{ row }">{{ row.note }}</template>
	</Table>
</template>
```

Press the arrow before Sola to open its note. Northway is paid and has no note, so it has no arrow.

- The `#detail` slot fills the detail row. It gets `row`, `node` and `toggleExpanded`.
- The detail row has `data-kind="detail"`.
- Pass the same function while its answers are the same: a new function makes the table list its rows again.

## Pinned rows

`rowPinning` holds the ids of the rows that stay at the top or the bottom edge: `{ top?: ids, bottom?: ids }`.

```vue title="pinned.vue"
<script setup lang="ts">
import { createTableController, Table, type ColumnDef, type RowPinning } from 'ui-sdk-table-vue'
import { shallowRef } from 'vue'

type Product = { id: string; name: string; stock: number }

const products: Product[] = [
	{ id: 'p1', name: 'Oat milk', stock: 42 },
	{ id: 'p2', name: 'Rye bread', stock: 8 },
	{ id: 'p3', name: 'Green tea', stock: 120 },
	{ id: 'p4', name: 'Dark coffee', stock: 3 },
	{ id: 'p5', name: 'Honey', stock: 27 },
	{ id: 'p6', name: 'Rice', stock: 64 },
	{ id: 'p7', name: 'Lentils', stock: 15 },
	{ id: 'p8', name: 'Olive oil', stock: 22 },
	{ id: 'p9', name: 'Sea salt', stock: 90 },
	{ id: 'p10', name: 'Oats', stock: 37 },
]

const columns: ColumnDef<Product>[] = [
	{ id: 'name', header: 'Product', sortable: true },
	{ id: 'stock', header: 'In stock', sortable: true, format: 'integer' },
]

const controller = createTableController()
const pinning = shallowRef<RowPinning>({ top: ['p4'] })
</script>

<template>
	<!-- The frame scrolls. The header and the pinned rows stay at its top. -->
	<div class="frame">
		<Table
			v-model:row-pinning="pinning"
			:rows="products"
			:columns="columns"
			:controller="controller"
			sticky-header
			aria-label="Products, the pinned ones on top"
		>
			<template #col-name="{ row, text, pinned }">
				<button
					type="button"
					:aria-pressed="!!pinned"
					:aria-label="`Pin ${text} to the top`"
					@click="controller.pinRow(row.id, pinned ? null : 'top')"
				>
					{{ pinned ? '★' : '☆' }}
				</button>
				{{ text }}
			</template>
		</Table>
	</div>
</template>

<style scoped>
.frame {
	max-block-size: 230px;
	overflow: auto;
	border: 1px solid #e4e4e7;
}

/* What sticks needs a background of its own, so the rows that scroll under it do not show through. */
.frame :deep(tr[data-sticky] > *) {
	background: #fff;
}
</style>
```

Press the star before Honey to pin it. It moves to the top with Dark coffee, and a sort leaves both there.

- A filter or a page does not hide a pinned row. The totals are of the rows that pass the filter, so a pinned row that the filter refuses is in view and not in a total.
- A row with child rows cannot be pinned.
- `controller.pinRow(rowId, 'top' | 'bottom' | null)` pins and frees a row. The `#cell` slot gets `pinned`.
- A pinned row has `data-pinned` and `data-sticky` with its edge. Style it as a sticky row: see [Styling](./styling.md).

## The row window

`rowWindow` renders only the rows near the scroll frame, with a spacer row for the rest.

```vue title="window.vue"
<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { createTableController, Table, type ColumnDef } from 'ui-sdk-table-vue'

type Reading = { id: string; number: number; sensor: string; value: number }

const SENSORS = ['North', 'East', 'South', 'West']
const readings: Reading[] = Array.from({ length: 10_000 }, (_, index) => ({
	id: `r${index + 1}`,
	number: index + 1,
	sensor: SENSORS[index % SENSORS.length] ?? '',
	value: (index * 7919) % 1000,
}))

const columns: ColumnDef<Reading>[] = [
	{ id: 'number', header: 'Row', format: 'integer' },
	{ id: 'sensor', header: 'Sensor' },
	{ id: 'value', header: 'Value', format: 'integer' },
]

const controller = createTableController()
</script>

<template>
	<div>
		<Button @click="controller.scrollToRow('r5000', 'center')">Row 5,000</Button>
		<Button @click="controller.scrollToRow('r1', 'start')">First row</Button>
	</div>
	<!-- The frame scrolls. The table renders the rows near it, and a spacer for the rest. -->
	<div class="frame">
		<Table
			:rows="readings"
			:columns="columns"
			:controller="controller"
			:row-height="35"
			row-window
			sticky-header
			aria-label="Ten thousand readings"
		/>
	</div>
</template>

<style scoped>
.frame {
	block-size: 280px;
	overflow: auto;
	border: 1px solid #e4e4e7;
}

.frame :deep(tr[data-sticky] > *) {
	background: #fff;
}

.frame :deep([data-slot='table-row']) {
	block-size: var(--table-row-height);
}
</style>
```

Scroll the frame, or press Row 5,000. The table renders a few dozen rows at a time, and a jump takes one step.

- The frame is the nearest parent whose content is higher than itself, or the page.
- `rowHeight` gives every row one height in pixels. Without it, the window measures each row, and `estimatedRowHeight` (36 by default) is the height of a row that it did not measure yet. With `hasDetail` it measures too.
- `overscan` is how many rows more than the frame shows it renders on each side, 8 by default.
- `controller.scrollToRow(rowId, align)` scrolls a row into view in one step, also when the row is not rendered yet. `align` is `start`, `center`, `end` or `nearest` (the default).
- The table has `data-row-window` and the CSS variable `--table-row-height`. A spacer row is `[data-slot='table-spacer']` and needs `block-size: var(--table-spacer-size)`.
- `aria-rowcount` and `aria-rowindex` count every row, so a screen reader says the place of a row among all of them.

## Sticky header and footer

`stickyHeader` and `stickyFooter` keep the header rows and the footer row in view while the rows scroll. The rows get `data-sticky`; the style makes them stick.

## Names

- **Options:** `getRowId`, `getChildren`, `sortChildren`, `hasDetail`, `expanded`, `defaultExpanded`, `rowPinning`, `defaultRowPinning`, `rowWindow`, `rowHeight`, `estimatedRowHeight`, `overscan`, `stickyHeader`, `stickyFooter`.
- **Events:** `expanded-change`, `row-pinning-change`.
- **Controller:** `expand`, `collapse`, `toggleExpanded`, `expandAll`, `collapseAll`, `pinRow`, `scrollToRow`.
- **Slots:** `#detail`.
- **Types:** `DataRow`, `TableRow`, `RowPin`, `RowPinning`, `DetailSlotProps`.

See the [Rows tiles of the sink](https://falldownthesystem.github.io/ui-sdk-table/?page=sink&only=rows).
