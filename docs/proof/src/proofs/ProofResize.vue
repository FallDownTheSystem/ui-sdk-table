<script setup lang="ts">
import { shallowRef } from "vue"
import { columns, makeRows } from "../data"
import { ResizeCol, ResizeHandle, ResizeTable } from "./col-resize"

const rows = makeRows(200)
const initial = Object.fromEntries(columns.map((c) => [c.id, c.width]))
const committed = shallowRef<Record<string, number>>(initial)
</script>

<template>
  <section data-proof="resize">
    <h2>a. Column resize (createResize)</h2>
    <output data-testid="resize-committed">{{ JSON.stringify(committed) }}</output>
    <div class="scroll">
      <ResizeTable class="fixed" :widths="initial" @widths-change="(w: Record<string, number>) => (committed = w)">
        <colgroup>
          <ResizeCol v-for="c in columns" :key="c.id" :value="c.id" :data-col="c.id" />
        </colgroup>
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.id" class="resize-th" :data-col="c.id">
              {{ c.label }}
              <ResizeHandle :id="`h-${c.id}`" :column="c.id" :label="c.label" class="resize-handle" :data-handle="c.id" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td v-for="c in columns" :key="c.id">{{ r[c.id] }}</td>
          </tr>
        </tbody>
      </ResizeTable>
    </div>
  </section>
</template>
