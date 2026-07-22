import { PersistedState } from 'runed'
import {
	assertIsLocale,
	baseLocale,
	locales,
	overwriteGetLocale,
	overwriteSetLocale,
} from '$lib/paraglide/runtime.js'

export type Locale = (typeof locales)[number]

/**
 * Reactive, cross-tab, localStorage-backed locale — the single source of truth
 * for the active UI language.
 *
 * We deliberately avoid URL prefixes and cookies: locale is a pure client
 * preference here (SEO is a non-goal; tenanting will drive context later).
 * `PersistedState` reads localStorage synchronously in its constructor on the
 * client and falls back to `baseLocale` on the server, and it mirrors changes
 * to every open tab via storage events.
 */
const stored = new PersistedState<Locale>('knowthing-locale', baseLocale)

/**
 * Hydration gate. localStorage is client-only, so the server and the *first*
 * client render must both use `baseLocale` or the hydrated HTML won't match.
 * `applyStoredLocale()` (called from a post-mount effect in the root layout)
 * flips this; because `getLocale()` reads it reactively, every `m.*()` call in
 * the tree then re-renders into the stored locale.
 */
let applied = $state(false)

// Route Paraglide's locale get/set through the reactive store. Reading
// `applied`/`stored.current` inside `getLocale()` is what makes messages
// reactive — no page reload needed to switch languages.
overwriteGetLocale(() => (applied ? stored.current : baseLocale))
overwriteSetLocale((locale) => {
	stored.current = assertIsLocale(locale)
})

/** Call once from the root layout, client-side, after mount. */
export function applyStoredLocale() {
	applied = true
}

export { stored as localeState }
