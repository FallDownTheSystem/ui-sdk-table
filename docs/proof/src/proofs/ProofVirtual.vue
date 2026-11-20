<script setup lang="ts">
import type { VirtualItem } from "@ui-sdk/core"
import { shallowRef } from "vue"
import { columns, makeRows } from "../data"
import { VirtualCell, VirtualHeaderCell, VirtualRow, VirtualScroller, VirtualTable } from "./virtual-grid"

const rows = makeRows(10_000)
const variable = shallowRef(false)
const keepFocused = shallowRef(true)

// Bridge: spacer rows stand in for the rows that aren't rendered, since a <tr>
// can't be absolutely positioned inside a <tbody>. keep() makes the window
// non-contiguous (the focused row plus the visible ones), so every gap gets one.
type Entry = { kind: "row"; item: VirtualItem } | { kind: "gap"; key: string; height: number }

// Gap keys are positional, not per row: a new key mid-patch lets the table
// collapse while createVirtualizer measures a row, and it then writes a
// clamped scrollTop (seen as a jump back to the top).
function layout(window: VirtualItem[], size: number): Entry[] {
  const entries: Entry[] = [{ kind: "gap", key: "gap-start", height: window[0]?.start ?? 0 }]
  let end = window[0]?.start ?? 0
  let gaps = 0
  for (const item of window) {
    if (item.start > end) entries.push({ kind: "gap", key: `gap-${++gaps}`, height: item.start - end })
    entries.push({ kind: "row", item })
    end = item.start + item.size
  }
  entries.push({ kind: "gap", key: "gap-end", height: Math.max(0, size - end) })
  return entries
}
</script>

<template>
  <section data-proof="virtual">
    <h2>e. Row virtualization (createVirtualizer) + grid focus</h2>
    <label><input v-model="variable" type="checkbox" data-testid="variable" /> variable row height</label>
    <label><input v-model="keepFocused" type="checkbox" data-testid="keep" /> keep focused row rendered</label>
    <VirtualScroller
      :key="`${variable}-${keepFocused}`"
      v-slot="{ state }"
      class="scroll virtual"
      :class="{ variable }"
      :count="rows.length"
      :cols="columns.length"
      :variable="variable"
      :keep-focused="keepFocused"
      data-testid="virtual-scroller"
    >
      <output
        data-testid="virtual-debug"
        :data-first="state.window[0]?.index"
        :data-first-start="state.window[0]?.start"
        :data-count="state.window.length"
        :data-size="state.size"
        hidden
      />
      <VirtualTable
        class="fixed"
        aria-label="Virtual proof"
        :aria-rowcount="rows.length + 1"
        :aria-colcount="columns.length"
        data-testid="virtual-grid"
      >
        <colgroup>
          <col v-for="c in columns" :key="c.id" :width="c.width" />
        </colgroup>
        <thead>
          <VirtualRow id="h" :index="0" class="vrow-head">
            <VirtualHeaderCell v-for="(c, ci) in columns" :id="`0:${ci}`" :key="c.id" :row="0" :col="ci" header>
              {{ c.label }}
            </VirtualHeaderCell>
          </VirtualRow>
        </thead>
        <tbody>
          <template v-for="entry in layout(state.window, state.size)" :key="entry.kind === 'row' ? entry.item.key : entry.key">
            <tr
              v-if="entry.kind === 'gap'"
              aria-hidden="true"
              class="spacer"
              :data-testid="entry.key === 'gap-end' ? 'spacer-bottom' : undefined"
              :style="{ height: `${entry.height}px` }"
            />
            <VirtualRow
              v-else-if="rows[entry.item.index]"
              :id="entry.item.key"
              :index="entry.item.index + 1"
              :measure="variable"
              class="vrow"
            >
              <VirtualCell
                v-for="(c, ci) in columns"
                :id="`${entry.item.index + 1}:${ci}`"
                :key="c.id"
                :row="entry.item.index + 1"
                :col="ci"
              >
                {{ rows[entry.item.index]?.[c.id] }}
              </VirtualCell>
            </VirtualRow>
          </template>
        </tbody>
      </VirtualTable>
    </VirtualScroller>
  </section>
</template>
