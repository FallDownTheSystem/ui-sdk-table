<script setup lang="ts">
import ProofGridNav from "./proofs/ProofGridNav.vue"
import ProofRange from "./proofs/ProofRange.vue"
import ProofReorder from "./proofs/ProofReorder.vue"
import ProofResize from "./proofs/ProofResize.vue"
import ProofVirtual from "./proofs/ProofVirtual.vue"
import ProofVirtualDivs from "./proofs/ProofVirtualDivs.vue"
</script>

<template>
  <main>
    <h1>UI SDK data table proof</h1>
    <ProofResize />
    <ProofGridNav />
    <ProofReorder />
    <ProofRange />
    <ProofVirtual />
    <ProofVirtualDivs />
  </main>
</template>
