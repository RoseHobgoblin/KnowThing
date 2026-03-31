<script lang="ts">
	import TagPill from '$lib/components/wordbook/TagPill.svelte'

	let {
		query,
		language,
		tag,
		pos,
		mediaCategory,
		unused = false,
		clearHref,
	}: {
		query?: string
		language?: string
		tag?: string
		pos?: string
		mediaCategory?: string
		unused?: boolean
		clearHref: string
	} = $props()

	const hasFilters = $derived(Boolean(query || language || tag || pos || mediaCategory || unused))
</script>

{#if hasFilters}
	<div class="flex items-center gap-2 flex-wrap text-sm">
		<span class="text-dim">Filters:</span>
		{#if query}
			<span class="px-2 py-0.5 bg-accent-subtle text-link border border-accent-border">"{query}"</span>
		{/if}
		{#if language}
			<span class="px-2 py-0.5 bg-raised text-secondary border border-border">{language}</span>
		{/if}
		{#if tag}
			<TagPill {tag} />
		{/if}
		{#if pos}
			<span class="px-2 py-0.5 bg-raised text-secondary border border-border">{pos}</span>
		{/if}
		{#if mediaCategory}
			<span class="px-2 py-0.5 bg-raised text-secondary border border-border">{mediaCategory}</span>
		{/if}
		{#if unused}
			<span class="px-2 py-0.5 bg-raised text-secondary border border-border">Unused only</span>
		{/if}
		<a href={clearHref} class="text-xs text-faint hover:text-secondary">Clear all</a>
	</div>
{/if}
