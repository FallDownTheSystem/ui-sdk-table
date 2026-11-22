<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Reading = {
	id: string
	station: string
	day: string
	low: number
	high: number
	rain: number
	wind: number
}

const STATIONS = ['Bergen', 'Cork', 'Porto', 'Gdansk', 'Tromso', 'Nantes']
const readings: Reading[] = Array.from({ length: 18 }, (_, index) => ({
	id: `r${index}`,
	station: STATIONS[index % STATIONS.length] ?? '',
	day: `2026-11-${String(10 + Math.floor(index / 6)).padStart(2, '0')}`,
	low: 2 + ((index * 3) % 7),
	high: 8 + ((index * 5) % 9),
	rain: (index * 7) % 13,
	wind: 10 + ((index * 11) % 25),
}))

const columns: ColumnDef<Reading>[] = [
	{ id: 'station', header: 'Station', width: 120 },
	{ id: 'day', header: 'Day', width: 120 },
	{ id: 'low', header: 'Low, °C', width: 110, format: 'integer', aggregate: 'min' },
	{ id: 'high', header: 'High, °C', width: 110, format: 'integer', aggregate: 'max' },
	{ id: 'rain', header: 'Rain, mm', width: 110, format: 'integer', aggregate: 'sum' },
	{ id: 'wind', header: 'Wind, km/h', width: 120, format: 'integer', aggregate: 'max' },
]
</script>

<template>
	<!-- The frame scrolls both ways. The header, the footer and the station stay in view. -->
	<div class="frame">
		<Table
			:rows="readings"
			:columns="columns"
			:default-column-pinning="{ start: ['station'] }"
			sticky-header
			sticky-footer
			aria-label="Weather readings"
		/>
	</div>
</template>

<style scoped>
.frame {
	max-inline-size: 460px;
	max-block-size: 260px;
	overflow: auto;
	border: 1px solid #e4e4e7;
}

/* What sticks needs a background of its own, so the rows that scroll under it do not show through. */
.frame :deep(tr[data-sticky] > *),
.frame :deep([data-pinned]) {
	background: #fff;
}

.frame :deep([data-pinned-edge]) {
	box-shadow: inset -1px 0 0 #a1a1aa;
}
</style>
