<script lang="ts">
	let {
		dirty = false,
		saving = false,
		error = '',
		savedAt = null,
	}: {
		dirty?: boolean
		saving?: boolean
		error?: string
		savedAt?: Date | null
	} = $props()

	const state = $derived.by(() => {
		if (error) return { label: 'Save failed', className: 'border-error-border bg-error-subtle text-error' }
		if (saving) return { label: 'Saving...', className: 'border-accent-border bg-accent-subtle text-link' }
		if (dirty) return { label: 'Unsaved changes', className: 'border-warning/40 bg-warning/10 text-secondary' }
		if (savedAt) return { label: `Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, className: 'border-border-subtle bg-page text-faint' }
		return { label: 'Saved', className: 'border-border-subtle bg-page text-faint' }
	})
</script>

<span class={`inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-medium ${state.className}`}>
	{state.label}
</span>
