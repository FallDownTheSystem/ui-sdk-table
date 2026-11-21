<script setup lang="ts">
import { ListFilterIcon, XIcon } from '@lucide/vue'
import { Button } from '@ui-sdk/vue/button'
import { Input } from '@ui-sdk/vue/input'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@ui-sdk/vue/popover'
import {
	isEmptyFilter,
	toText,
	type ColumnDef,
	type ColumnFacets,
	type FilterKind,
} from 'ui-sdk-table-vue'
import { computed, reactive } from 'vue'
import { buttonClass, inputClass, popoverContentClass } from './DataTableClasses'
import DataTableSelect from './DataTableSelect.vue'
import {
	isOwnColumn,
	useDataTable,
	type DataTableColumnMeta,
	type DataTableSelectItem,
} from './types'

const { controller, view, messages, label, filterCount: count } = useDataTable()

const filters = computed(() => view.value?.filter.columns ?? {})

/**
 * The columns with a filter control: the columns in view, and after them the
 * hidden columns that filter. A filter that nobody can see would hide rows
 * with no way to find out why, and no way to take it away.
 */
const columns = computed(() => {
	const current = view.value
	if (!current) return []
	const offered = (column: ColumnDef) =>
		!isOwnColumn(column.id) &&
		(column.meta as DataTableColumnMeta | undefined)?.filterable !== false
	const shown = current.visibleColumns.filter(offered)
	const inView = new Set(shown.map((column) => column.id))
	const hidden = current.columns.filter(
		(column) =>
			offered(column) && !inView.has(column.id) && !isEmptyFilter(filters.value[column.id]),
	)
	return [...shown, ...hidden]
})

type Choice = { value: unknown; text: string }
type Field = {
	column: ColumnDef
	name: string
	kind: FilterKind
	facets: ColumnFacets
	/** The entries of the list of a `select` filter. */
	choices: readonly Choice[]
	items: readonly DataTableSelectItem[]
}

// Two values are one choice when a person reads them as the same, as the filter and a group do.
const sameValue = (a: unknown, b: unknown) => toText(a) === toText(b)

/** The values that the filter of a column asks for, as a list. */
function wanted(columnId: string): readonly unknown[] {
	const value = filters.value[columnId]
	return Array.isArray(value) ? value : isEmptyFilter(value) ? [] : [value]
}

const fields = computed<Field[]>(() =>
	columns.value.map((column) => {
		const facets = controller.getFacets(column.id)
		// A chosen value stays a choice when no row holds it now: with a filter
		// on the server, the rows of the table are the rows that pass, and a list
		// without the value would drop it from the filter on the next choice.
		const kept = wanted(column.id).filter(
			(value) => !facets.values.some((facet) => sameValue(facet.value, value)),
		)
		const choices: Choice[] =
			facets.kind === 'select'
				? [...facets.values, ...kept.map((value) => ({ value, text: toText(value) }))]
				: []
		return {
			column,
			name: column.header ?? column.id,
			kind: facets.kind,
			facets,
			choices,
			// A value can be a number, a date or true and false. The list works
			// with texts, so each value goes by its place among the choices.
			items: choices.map((choice, index) => ({ value: String(index), label: choice.text })),
		}
	}),
)

const record = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}

const set = (columnId: string, value: unknown) => controller.setColumnFilter(columnId, value)

const textOf = (columnId: string) => {
	const value = filters.value[columnId]
	return typeof value === 'string' ? value : ''
}

function chosen(field: Field): string[] {
	const values = wanted(field.column.id)
	return field.choices.flatMap((choice, index) =>
		values.some((value) => sameValue(value, choice.value)) ? [String(index)] : [],
	)
}

function choose(field: Field, picked: string | string[] | null) {
	// In the order of the list, not of the clicks: one choice gives one state.
	const places = (Array.isArray(picked) ? picked : []).map(Number).sort((a, b) => a - b)
	set(
		field.column.id,
		places.flatMap((place) => {
			const choice = field.choices[place]
			return choice ? [choice.value] : []
		}),
	)
}

/**
 * The lowest or the highest number of a column as a hint in its field: the
 * number as a person writes it into the field, because the filter compares
 * the values of the column and not their formatted texts. A sum of floats
 * such as 0.30000000000000004 reads as 0.3; any other number is rounded
 * away from the range, so the two hints hold every row.
 */
function hint(value: number, up: boolean): string {
	const near = Number(value.toFixed(6))
	const noise = Math.abs(value) * 1e-12
	const outside = up ? near < value - noise : near > value + noise
	return String(outside ? Number((near + (up ? 1e-6 : -1e-6)).toFixed(6)) : near)
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
		<PopoverTrigger
			:aria-label="messages.filtersLabel({ count, table: label })"
			:class="buttonClass('outline')"
		>
			<ListFilterIcon aria-hidden="true" />
			{{ messages.filters({ count }) }}
		</PopoverTrigger>
		<PopoverContent align="start" :side-offset="4" :class="popoverContentClass">
			<div class="flex items-center justify-between gap-2">
				<!-- The name of the popover has the name of the table in it; the text that shows is the short one. -->
				<PopoverTitle class="text-sm font-semibold">
					<span aria-hidden="true">{{ messages.filtersTitle() }}</span>
					<span class="sr-only">{{ messages.filtersTitleLabel({ table: label }) }}</span>
				</PopoverTitle>
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
							:items="field.items"
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
								:placeholder="
									field.facets.range ? hint(field.facets.range.min, false) : messages.min()
								"
								:aria-label="messages.filterMin({ column: field.name })"
								:class="inputClass"
								@value-change="(text: string) => setNumber(field.column.id, 'min', text)"
							/>
							<Input
								type="number"
								inputmode="decimal"
								:value="numberText(field.column.id, 'max')"
								:placeholder="
									field.facets.range ? hint(field.facets.range.max, true) : messages.max()
								"
								:aria-label="messages.filterMax({ column: field.name })"
								:class="inputClass"
								@value-change="(text: string) => setNumber(field.column.id, 'max', text)"
							/>
						</template>
						<template v-else-if="field.kind === 'dateRange'">
							<Input
								type="date"
								:value="dateText(field.column.id, 'from')"
								:min="field.facets.days?.from"
								:max="field.facets.days?.to"
								:aria-label="messages.filterFrom({ column: field.name })"
								:class="inputClass"
								@value-change="(text: string) => setDate(field.column.id, 'from', text)"
							/>
							<Input
								type="date"
								:value="dateText(field.column.id, 'to')"
								:min="field.facets.days?.from"
								:max="field.facets.days?.to"
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
