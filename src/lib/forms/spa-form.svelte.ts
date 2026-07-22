import { superForm, defaults, type SuperValidated } from 'sveltekit-superforms'
import { zod4, zod4Client } from 'sveltekit-superforms/adapters'
import type { ZodType } from 'zod'

export interface SpaFormHelpers {
	/** Re-baseline the dirty tracker to the just-submitted values (call after a
	 * successful save when the form stays mounted). */
	markClean: () => void
}

export interface SpaFormConfig<T extends Record<string, unknown>> {
	/** Zod schema — the single source of truth for defaults, types, and validation. */
	schema: ZodType<T>
	/** Initial field values. */
	initial: T
	/** Runs once the draft is client-valid. Throw to surface `submitError`. */
	onValid: (data: T, helpers: SpaFormHelpers) => Promise<void>
	/** Fallback shown when `onValid` throws a non-Error. */
	errorMessage?: string
}

/**
 * Wraps the repeated SPA-mode superforms wiring (validators, `resetForm: false`,
 * the `onUpdate` → validate → submit → catch dance, and tainted-based dirty
 * tracking) behind one call. Returns the superforms stores plus a reactive
 * `submitError`/`isDirty`. Bind `$form`/`$errors` into UI components as usual.
 */
export function createSpaForm<T extends Record<string, unknown>>(config: SpaFormConfig<T>) {
	let submitError = $state('')

	// The zod4 adapter infers its own output type which TS can't prove equals the
	// caller's T (semantically identical). Erase the adapter typing and pin the
	// SuperForm generic to T so the returned stores ($form, $errors) stay typed.
	const initialForm = defaults(config.initial, zod4(config.schema) as never) as SuperValidated<T>
	const sf = superForm(initialForm, {
		SPA: true,
		validators: zod4Client(config.schema) as never,
		resetForm: false,
		async onUpdate({ form }) {
			if (!form.valid) return
			submitError = ''
			try {
				await config.onValid(form.data, { markClean: () => sf.reset({ data: form.data }) })
			} catch (error) {
				submitError = error instanceof Error ? error.message : (config.errorMessage ?? 'Something went wrong')
			}
		},
	})

	return {
		form: sf.form,
		errors: sf.errors,
		enhance: sf.enhance,
		submitting: sf.submitting,
		reset: sf.reset,
		clearError() {
			submitError = ''
		},
		get isDirty() {
			return sf.isTainted()
		},
		get submitError() {
			return submitError
		},
	}
}
