<script setup lang="ts">
import { columns, makeRows } from "../data"
import { RangeCell, RangeGrid, RangeHeaderCell, RangeRow } from "./grid-range"

const rows = makeRows(200)
</script>

<template>
  <section data-proof="range">
    <h2>d. Cell range selection (createCellRange)</h2>
    <div class="scroll">
      <RangeGrid
        v-slot="{ state }"
        aria-label="Range proof"
        :rows="rows.length + 1"
        :cols="columns.length"
        :aria-rowcount="rows.length + 1"
        :aria-colcount="columns.length"
        data-testid="range-grid"
      >
        <caption>
          <output data-testid="range-bounds">{{ JSON.stringify(state.bounds) }}</output>
        </caption>
        <thead>
          <RangeRow id="h" :index="0">
            <RangeHeaderCell v-for="(c, ci) in columns" :id="`0:${ci}`" :key="c.id" :row="0" :col="ci" header>
              {{ c.label }}
            </RangeHeaderCell>
          </RangeRow>
        </thead>
        <tbody>
          <RangeRow v-for="(r, ri) in rows" :id="`r${r.id}`" :key="r.id" :index="ri + 1">
            <RangeCell v-for="(c, ci) in columns" :id="`${ri + 1}:${ci}`" :key="c.id" :row="ri + 1" :col="ci">
              {{ r[c.id] }}
            </RangeCell>
          </RangeRow>
        </tbody>
      </RangeGrid>
    </div>
  </section>
</template>
