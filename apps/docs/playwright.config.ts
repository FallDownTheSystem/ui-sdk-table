import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './e2e',
	timeout: 60_000,
	forbidOnly: !!process.env.CI,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:5180',
		trace: 'on-first-retry',
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		// The proofs of the formulas in two more browsers, on request: they need
		// `playwright install firefox webkit`, which the setup does not run.
		...(process.env.PROOF_BROWSERS
			? [
					{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
					{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
				].map((project) => ({ ...project, testMatch: 'formula-proofs.spec.ts' }))
			: []),
	],
	webServer: {
		command: 'pnpm dev',
		port: 5180,
		reuseExistingServer: !process.env.CI,
	},
})
