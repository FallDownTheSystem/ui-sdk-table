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
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'pnpm dev',
		port: 5180,
		reuseExistingServer: !process.env.CI,
	},
})
