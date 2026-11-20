<script setup lang="ts">
import { createVirtualizer, type VirtualItem } from "@ui-sdk/core"
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from "vue"
import { makeRows } from "../data"

// Control case: the documented setup (absolutely positioned divs), no table, no primitive.
const rows = makeRows(10_000)
const virtual = createVirtualizer({ count: () => rows.length, estimate: () => 40, key: (i) => `row-${i}`, overscan: 4 })
const items = shallowRef<VirtualItem[]>([])
const size = shallowRef(0)
const scroller = useTemplateRef<HTMLElement>("scroller")
let cleanup: (() => void) | undefined

onMounted(() => {
  const el = scroller.value
  if (!el) return
  const off = virtual.connect(el)
  const un = virtual.subscribe(() => {
    items.value = virtual.items()
    size.value = virtual.size()
  })
  items.value = virtual.items()
  size.value = virtual.size()
  cleanup = () => {
    off()
    un()
  }
})
onBeforeUnmount(() => cleanup?.())

function measure(index: number, el: unknown) {
  if (el instanceof HTMLElement) virtual.measure(index, el)
}
</script>

<template>
  <section data-proof="virtual-divs">
    <h2>e2. Control: createVirtualizer with absolutely positioned divs (documented setup)</h2>
    <div ref="scroller" class="scroll" data-testid="divs-scroller">
      <div class="divs-box" :style="{ height: `${size}px` }">
        <div
          v-for="item in items"
          :key="item.key"
          :ref="(el) => measure(item.index, el)"
          class="divs-row"
          :data-index="item.index"
          :style="{ transform: `translateY(${item.start}px)` }"
        >
          {{ rows[item.index]?.id }} · {{ rows[item.index]?.note }}
        </div>
      </div>
    </div>
  </section>
</template>
