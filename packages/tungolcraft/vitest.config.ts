import { defineConfig } from 'vitest/config'

// Keep the framework-agnostic package isolated from the parent SvelteKit,
// Tailwind and Paraglide Vite plugins. Scientific-core tests should neither
// require an app shell nor emit unrelated application configuration errors.
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
	},
})
