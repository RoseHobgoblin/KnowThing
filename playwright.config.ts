import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	// Chromium's software/GPU contexts become unreliable when every 3D fixture starts at once.
	workers: 4,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	expect: {
		toHaveScreenshot: { maxDiffPixels: 20 },
	},
	use: {
		baseURL: 'http://127.0.0.1:4174',
		trace: 'retain-on-failure',
		colorScheme: 'dark',
		reducedMotion: 'reduce',
	},
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1 --port 4174',
		url: 'http://127.0.0.1:4174/test/celestial-map',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
})
