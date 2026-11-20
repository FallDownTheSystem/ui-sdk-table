<script setup lang="ts">
import { shallowRef } from "vue"
import { columns, makeRows } from "../data"
import { NavCell, NavGrid, NavHeaderCell, NavRow } from "./grid-nav"

const rows = makeRows(200)
const clicks = shallowRef(0)
</script>

<template>
  <section data-proof="grid">
    <h2>b. Grid keyboard navigation (createGridFocus)</h2>
    <button data-testid="before-grid">before grid</button>
    <output data-testid="grid-clicks">{{ clicks }}</output>
    <div class="scroll">
      <NavGrid
        aria-label="Grid navigation proof"
        :rows="rows.length + 1"
        :cols="columns.length"
        :page-size="5"
        :aria-rowcount="rows.length + 1"
        :aria-colcount="columns.length"
        data-testid="grid"
      >
        <thead>
          <NavRow id="h" :index="0">
            <NavHeaderCell v-for="(c, ci) in columns" :id="`0:${ci}`" :key="c.id" :row="0" :col="ci" header>
              {{ c.label }}
            </NavHeaderCell>
          </NavRow>
        </thead>
        <tbody>
          <NavRow v-for="(r, ri) in rows" :id="`r${r.id}`" :key="r.id" :index="ri + 1">
            <NavCell v-for="(c, ci) in columns" :id="`${ri + 1}:${ci}`" :key="c.id" :row="ri + 1" :col="ci">
              <button v-if="ri === 2 && ci === 3" data-testid="cell-button" tabindex="-1" @click="clicks++">
                Act
              </button>
              <template v-else>{{ r[c.id] }}</template>
            </NavCell>
          </NavRow>
        </tbody>
      </NavGrid>
    </div>
    <button data-testid="after-grid">after grid</button>
  </section>
</template>
