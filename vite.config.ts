import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
	server: {
		fs: {
			// The `tungolcraft` workspace package is consumed as raw TS (its exports
			// point at ./src/index.ts), so the dev server must be allowed to serve
			// files from packages/ — outside SvelteKit's default src/-only allowlist.
			allow: [fileURLToPath(new URL('./packages', import.meta.url))],
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
