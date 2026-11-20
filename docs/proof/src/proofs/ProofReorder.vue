<script setup lang="ts">
import { shallowRef } from "vue"
import { columns, makeRows } from "../data"
import { ReorderHeader, ReorderTable } from "./col-reorder"

const rows = makeRows(200)
const labels = Object.fromEntries(columns.map((c) => [c.id, c.label]))
const committed = shallowRef(columns.map((c) => c.id))
</script>

<template>
  <section data-proof="reorder">
    <h2>c. Column reorder (createReorder)</h2>
    <p id="reorder-help">Press Space or Enter to pick up a column, arrows to move it, Space to drop, Escape to cancel.</p>
    <output data-testid="reorder-committed">{{ committed.join(",") }}</output>
    <div class="scroll">
      <ReorderTable
        v-slot="{ state }"
        :default-value="columns.map((c) => c.id)"
        @value-change="(v: string[]) => (committed = v)"
      >
        <thead>
          <tr>
            <ReorderHeader v-for="id in state.order" :key="id" :value="id" :data-col="id">{{ labels[id] }}</ReorderHeader>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td v-for="id in state.order" :key="id" :data-col="id">{{ r[id] }}</td>
          </tr>
        </tbody>
      </ReorderTable>
    </div>
  </section>
</template>
