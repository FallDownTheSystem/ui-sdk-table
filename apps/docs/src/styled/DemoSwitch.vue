<script setup lang="ts">
import { Switch, SwitchThumb } from '@ui-sdk/vue/switch'

const checked = defineModel<boolean>({ required: true })
</script>

<template>
	<label class="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
		<Switch
			:checked="checked"
			class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-foreground/50 p-0.5 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring data-checked:bg-primary"
			@checked-change="(next: boolean) => (checked = next)"
		>
			<SwitchThumb
				class="size-4 rounded-full bg-background shadow-xs transition-transform data-checked:translate-x-4 rtl:data-checked:-translate-x-4"
			/>
		</Switch>
		<slot />
	</label>
</template>
