<script lang="ts">
	let {
		dirty = false,
		saving = false,
		error = '',
		savedAt = null,
		plain = false,
	}: {
		dirty?: boolean
		saving?: boolean
		error?: string
		savedAt?: Date | null
		/** Render as a bare dot + text (no border or background). */
		plain?: boolean
	} = $props()

	const state = $derived.by(() => {
		if (error) return { label: 'Save failed', className: 'border-error-border bg-error-subtle text-error', dot: 'bg-error' }
		if (saving) return { label: 'Saving...', className: 'border-accent-border bg-accent-subtle text-link', dot: 'bg-accent' }
		if (dirty) return { label: 'Unsaved changes', className: 'border-warning/40 bg-warning/10 text-secondary', dot: 'bg-warning' }
		if (savedAt) return { label: `Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, className: 'border-border-subtle bg-page text-secondary', dot: 'bg-success' }
		return { label: 'Saved', className: 'border-border-subtle bg-page text-secondary', dot: 'bg-success' }
	})
</script>

{#if plain}
	<span class="inline-flex items-center gap-1.5 text-xs font-medium text-secondary">
		<span class={`size-1.5 rounded-full ${state.dot}`}></span>
		{state.label}
	</span>
{:else}
	<span class={`inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-medium ${state.className}`}>
		{state.label}
	</span>
{/if}
