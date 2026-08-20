import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts', 'packages/**/*.test.ts', 'scripts/**/*.test.ts'],
		server: {
			// Vitest's native externalization loses Zod's named export when the
			// worker itself runs on Bun. Let Vite transform Zod with the sources.
			deps: { inline: [/\/zod\//] },
		},
	},
	server: {
		fs: {
			// The `tungolcraft` workspace package is consumed as raw TS (its exports
			// point at ./src/index.ts), so the dev server must be allowed to serve
			// files from packages/ — outside SvelteKit's default src/-only allowlist.
			allow: [fileURLToPath(new URL('packages', import.meta.url))],
		},
	},
	plugins: [
		tailwindcss(),
		// Compiles messages/{locale}.json into typed message functions under
		// src/lib/paraglide. Locale get/set are overridden at runtime by
		// `$lib/i18n.svelte.ts` (a `runed` PersistedState in localStorage), so
		// this strategy is only the compile-time default; `localStorage` keeps it
		// coherent and `baseLocale` (en) is the SSR/first-paint fallback.
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['localStorage', 'baseLocale'],
		}),
		sveltekit(),
	],
})
