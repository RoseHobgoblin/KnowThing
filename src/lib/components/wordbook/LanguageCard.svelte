<script lang="ts">
	let { name, slug, nativeName, family, script, color = 'var(--color-accent)', wordCount = 0 }: {
		name: string
		slug: string
		nativeName?: string | null
		family?: string | null
		script?: string | null
		color?: string
		wordCount?: number
	} = $props()
</script>

<a
	href="/Wordbook/{slug}"
	class="
		block bg-surface border border-border transition-all overflow-hidden group
		hover:border-accent-border hover:shadow-md
	"
>
	<div class="h-1.5" style="background-color: {color};"></div>
	<div class="p-4">
		<div class="flex items-baseline gap-2 mb-1">
			<h3 class="font-semibold text-heading transition-colors group-hover:text-link">{name}</h3>
			{#if nativeName}
				<span class="text-sm text-faint italic">{nativeName}</span>
			{/if}
		</div>

		<div class="flex items-center gap-3 text-xs text-dim mt-2">
			{#if family}
				<span>{family}</span>
			{/if}
			{#if script}
				<span class="text-faint">·</span>
				<span>{script} script</span>
			{/if}
		</div>

		<div class="mt-3 text-sm font-medium" style="color: {color};">
			{wordCount} {wordCount === 1 ? 'word' : 'words'}
		</div>
	</div>
</a>
