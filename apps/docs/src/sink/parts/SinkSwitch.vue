<script setup lang="ts">
import { Switch, SwitchThumb } from '@ui-sdk/vue/switch'

const checked = defineModel<boolean>({ required: true })
</script>

<template>
	<label class="sink-switch">
		<Switch v-model:checked="checked"><SwitchThumb /></Switch>
		<span><slot /></span>
	</label>
</template>
