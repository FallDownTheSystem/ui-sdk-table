<script setup lang="ts">
import { shallowRef, watchEffect } from 'vue'
import { isStress } from '../page'
import DemoSwitch from '../styled/DemoSwitch.vue'
import StyledBasics from '../styled/StyledBasics.vue'
import StyledCustomers from '../styled/StyledCustomers.vue'
import StyledCustomisation from '../styled/StyledCustomisation.vue'
import StyledGrid from '../styled/StyledGrid.vue'
import StyledHeadless from '../styled/StyledHeadless.vue'
import StyledInteraction from '../styled/StyledInteraction.vue'
import StyledStructure from '../styled/StyledStructure.vue'

// The theme is the `dark` class on a parent of the table, as in the consumer app.
const dark = shallowRef(new URLSearchParams(location.search).get('theme') === 'dark')
watchEffect(() => document.documentElement.classList.toggle('dark', dark.value))
</script>

<template>
	<div class="flex flex-col gap-12">
		<header class="flex flex-wrap items-center justify-between gap-4">
			<h1 class="text-3xl font-semibold tracking-tight">Data table examples</h1>
			<DemoSwitch v-model="dark">Dark theme</DemoSwitch>
		</header>
		<StyledBasics />
		<StyledStructure />
		<StyledInteraction />
		<StyledGrid />
		<StyledCustomisation />
		<StyledHeadless />
		<StyledCustomers />
		<StyledCustomers v-if="isStress" stress />
	</div>
</template>
