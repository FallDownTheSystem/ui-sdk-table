<script setup lang="ts">
import { ListFilterIcon, XIcon } from '@lucide/vue'
import { Button } from '@ui-sdk/vue/button'
import { Input } from '@ui-sdk/vue/input'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@ui-sdk/vue/popover'
import { isEmptyFilter, type ColumnDef, type ColumnFacets, type FilterKind } from 'ui-sdk-table-vue'
import { computed, reactive } from 'vue'
import { buttonClass, inputClass, popoverContentClass } from './DataTableClasses'
import DataTableSelect from './DataTableSelect.vue'
import { isOwnColumn, useDataTable, type DataTableColumnMeta } from './types'

const { controller, view, messages } = useDataTable()

const filters = computed(() => view.value?.filter.columns ?? {})
const count = computed(
	() => Object.values(filters.value).filter((value) => !isEmptyFilter(value)).length,
)

/** The columns in view that have a filter control. */
const columns = computed(() =>
	(view.value?.visibleColumns ?? []).filter(
		(column) =>
			!isOwnColumn(column.id) &&
			(column.meta as DataTableColumnMeta | undefined)?.filterable !== false,
	),
)

type Field = { column: ColumnDef; name: string; kind: FilterKind; facets: ColumnFacets }

const fields = computed<Field[]>(() =>
	columns.value.map((column) => {
		const facets = controller.getFacets(column.id)
		return { column, name: column.header ?? column.id, kind: facets.kind, facets }
	}),
)

const record = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}

const set = (columnId: string, value: unknown) =>
	controller.setColumnFilter(columnId, isEmptyFilter(value) ? undefined : value)

const textOf = (columnId: string) => {
	const value = filters.value[columnId]
	return typeof value === 'string' ? value : ''
}

// A value of a column can be a number, a date or true and false. The list
// works with texts, so each value goes by its place among the values.
const sameValue = (a: unknown, b: unknown) =>
	a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b

function chosen(field: Field): string[] {
	const value = filters.value[field.column.id]
	const wanted = Array.isArray(value) ? value : isEmptyFilter(value) ? [] : [value]
	return field.facets.values.flatMap((facet, index) =>
		wanted.some((item) => sameValue(item, facet.value)) ? [String(index)] : [],
	)
}

function choose(field: Field, picked: string | string[] | null) {
	const places = Array.isArray(picked) ? picked : []
	set(
		field.column.id,
		places.flatMap((place) => {
			const facet = field.facets.values[Number(place)]
			return facet ? [facet.value] : []
		}),
	)
}

// The text of a number field as the person wrote it. The state holds the
// number, and "1." and "1" are one number: without the text, the point would
// go away while the person is still writing.
const drafts = reactive<Record<string, string>>({})

function numberText(columnId: string, bound: 'min' | 'max'): string {
	const value = record(filters.value[columnId])[bound]
	const draft = drafts[`${columnId}|${bound}`]
	const number = typeof value === 'number' ? value : undefined
	if (draft !== undefined && toNumber(draft) === number) return draft
	return number === undefined ? '' : String(number)
}

function toNumber(text: string): number | undefined {
	const number = text.trim() === '' ? Number.NaN : Number(text)
	return Number.isFinite(number) ? number : undefined
}

function setNumber(columnId: string, bound: 'min' | 'max', text: string) {
	drafts[`${columnId}|${bound}`] = text
	set(columnId, { ...record(filters.value[columnId]), [bound]: toNumber(text) ?? null })
}

function dateText(columnId: string, bound: 'from' | 'to'): string {
	const value = record(filters.value[columnId])[bound]
	return typeof value === 'string' ? value : ''
}

function setDate(columnId: string, bound: 'from' | 'to', text: string) {
	set(columnId, { ...record(filters.value[columnId]), [bound]: text || null })
}

/** A date as the date field of the browser writes it, in local time. */
function day(date: Date | undefined): string | undefined {
	if (!date) return undefined
	const pad = (part: number) => String(part).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function reset(columnId: string) {
	for (const key of Object.keys(drafts)) {
		if (key.startsWith(`${columnId}|`)) delete drafts[key]
	}
	controller.setColumnFilter(columnId, undefined)
}

function clear() {
	for (const key of Object.keys(drafts)) delete drafts[key]
	controller.clearColumnFilters()
}
</script>

<template>
	<Popover>
		<PopoverTrigger :class="buttonClass('outline')" :data-active="count > 0 ? '' : undefined">
			<ListFilterIcon aria-hidden="true" />
			{{ messages.filters({ count }) }}
		</PopoverTrigger>
		<PopoverContent align="start" :side-offset="4" :class="popoverContentClass">
			<div class="flex items-center justify-between gap-2">
				<PopoverTitle class="text-sm font-semibold">{{ messages.filtersTitle() }}</PopoverTitle>
				<Button :disabled="count === 0" :class="buttonClass('ghost', 'sm')" @click="clear">
					{{ messages.clearFilters() }}
				</Button>
			</div>
			<div class="flex flex-col gap-3">
				<div
					v-for="field in fields"
					:key="field.column.id"
					data-slot="data-table-filter"
					:data-kind="field.kind"
					class="flex items-center gap-2"
				>
					<span class="w-28 shrink-0 truncate font-medium">{{ field.name }}</span>
					<!-- Two date fields with their pickers do not fit beside each other, so they stack. -->
					<div
						class="flex min-w-0 flex-1 items-center gap-2 in-data-[kind=dateRange]:flex-col in-data-[kind=dateRange]:items-stretch"
					>
						<DataTableSelect
							v-if="field.kind === 'select'"
							multiple
							class="w-full"
							:items="
								field.facets.values.map((facet, index) => ({
									value: String(index),
									label: facet.text,
								}))
							"
							:value="chosen(field)"
							:label="messages.filterValues({ column: field.name })"
							:placeholder="messages.filterAny()"
							@change="(picked) => choose(field, picked)"
						/>
						<template v-else-if="field.kind === 'range'">
							<Input
								type="number"
								inputmode="decimal"
								:value="numberText(field.column.id, 'min')"
								:placeholder="field.facets.range ? String(field.facets.range.min) : messages.min()"
								:aria-label="messages.filterMin({ column: field.name })"
								:class="inputClass"
								@value-change="(text: string) => setNumber(field.column.id, 'min', text)"
							/>
							<Input
								type="number"
								inputmode="decimal"
								:value="numberText(field.column.id, 'max')"
								:placeholder="field.facets.range ? String(field.facets.range.max) : messages.max()"
								:aria-label="messages.filterMax({ column: field.name })"
								:class="inputClass"
								@value-change="(text: string) => setNumber(field.column.id, 'max', text)"
							/>
						</template>
						<template v-else-if="field.kind === 'dateRange'">
							<Input
								type="date"
								:value="dateText(field.column.id, 'from')"
								:min="day(field.facets.dates?.from)"
								:max="day(field.facets.dates?.to)"
								:aria-label="messages.filterFrom({ column: field.name })"
								:class="inputClass"
								@value-change="(text: string) => setDate(field.column.id, 'from', text)"
							/>
							<Input
								type="date"
								:value="dateText(field.column.id, 'to')"
								:min="day(field.facets.dates?.from)"
								:max="day(field.facets.dates?.to)"
								:aria-label="messages.filterTo({ column: field.name })"
								:class="inputClass"
								@value-change="(text: string) => setDate(field.column.id, 'to', text)"
							/>
						</template>
						<Input
							v-else
							type="text"
							autocomplete="off"
							:value="textOf(field.column.id)"
							:placeholder="messages.search()"
							:aria-label="messages.filterText({ column: field.name })"
							:class="inputClass"
							@value-change="(text: string) => set(field.column.id, text)"
						/>
					</div>
					<Button
						:disabled="isEmptyFilter(filters[field.column.id])"
						:aria-label="messages.resetFilter({ column: field.name })"
						:class="buttonClass('ghost', 'icon-sm')"
						@click="reset(field.column.id)"
					>
						<XIcon aria-hidden="true" />
					</Button>
				</div>
			</div>
		</PopoverContent>
	</Popover>
</template>
