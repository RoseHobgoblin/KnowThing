import { untrack } from 'svelte'

/** Tracks whether a form draft has diverged from its last-saved baseline.
 * `snapshot` must return the JSON-serializable draft state; reactive values
 * read inside it keep `isDirty` current automatically. */
export function createDirtyTracker(snapshot: () => unknown) {
	let baseline = $state(JSON.stringify(untrack(snapshot)))
	const current = $derived(JSON.stringify(snapshot()))
	return {
		get isDirty() {
			return current !== baseline
		},
		/** Re-baseline to the current draft (call after a successful save or load). */
		markClean() {
			baseline = JSON.stringify(untrack(snapshot))
		},
	}
}
