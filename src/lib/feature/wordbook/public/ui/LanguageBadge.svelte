<script lang="ts">
	let { name, slug, color }: { name: string, slug: string, color?: string | null } = $props()
	// color-mix works for ANY color form — hex, var(--token), named — unlike the
	// old `{c}15` hex-alpha concatenation, which produced invalid CSS whenever
	// the stored color was `var(--color-accent)` (the default).
	const c = $derived(color || 'var(--color-accent)')
	const bg = $derived(`color-mix(in srgb, ${c} 8%, transparent)`)
	const border = $derived(`color-mix(in srgb, ${c} 19%, transparent)`)
</script>

<a
	href="/Wordbook/{slug}"
	class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80"
	style="background-color: {bg}; color: {c}; border: 1px solid {border};"
>
	<span class="size-1.5" style="background-color: {c};"></span>
	{name}
</a>
