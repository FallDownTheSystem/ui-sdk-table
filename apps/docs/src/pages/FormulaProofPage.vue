<script setup lang="ts">
// The page of a proof, and no demo: the menu does not list it. It shows what
// a browser gives for the facts that the date functions of the formulas
// build on (`e2e/formula-proofs.spec.ts`): the text of a range of days.

const range = (locale: string, from: string, to: string) =>
	new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).formatRange(
		new Date(`${from}T00:00:00Z`),
		new Date(`${to}T00:00:00Z`),
	)

const facts = {
	week: {
		'en-US': range('en-US', '2026-11-16', '2026-11-22'),
		'fi-FI': range('fi-FI', '2026-11-16', '2026-11-22'),
		'en-US across a year': range('en-US', '2025-12-29', '2026-01-04'),
		'fi-FI across a year': range('fi-FI', '2025-12-29', '2026-01-04'),
	},
}
</script>

<template>
	<h1>Facts of the browser for the formulas</h1>
	<pre data-testid="facts">{{ JSON.stringify(facts) }}</pre>
</template>
