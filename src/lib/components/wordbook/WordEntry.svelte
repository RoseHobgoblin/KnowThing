<script lang="ts">
	import LanguageBadge from './LanguageBadge.svelte'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'
	import Badge from '$lib/components/ui/Badge.svelte'
	import { POS_COLORS } from './constants.js'

	let { entry, showLanguage = true }: {
		entry: {
			id: number
			word: string
			pronunciation?: string | null
			partOfSpeech?: string | null
			definition?: string | null
			tags?: string[] | null
			languageName?: string
			languageSlug?: string
			languageColor?: string | null
		}
		showLanguage?: boolean
	} = $props()

	const posClass = $derived(
		entry.partOfSpeech
			? POS_COLORS[entry.partOfSpeech.toLowerCase()] || 'bg-raised text-secondary'
			: '',
	)
</script>

<!-- Compact: search result / list item -->
<a href="/Wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="block p-4 transition-colors hover:bg-accent-subtle/30">
	<div class="flex items-baseline gap-2 flex-wrap">
		<span class="text-lg font-semibold text-heading">{entry.word}</span>
		{#if entry.pronunciation}
			<span class="text-sm text-faint font-mono">{entry.pronunciation}</span>
		{/if}
		{#if entry.partOfSpeech}
			<Badge class={posClass}>{entry.partOfSpeech}</Badge>
		{/if}
		{#if showLanguage && entry.languageName && entry.languageSlug}
			<LanguageBadge name={entry.languageName} slug={entry.languageSlug} color={entry.languageColor} />
		{/if}
	</div>
	{#if entry.definition}
		<p class="text-sm text-secondary mt-1 line-clamp-2"><InlineMarkup text={entry.definition} /></p>
	{/if}
</a>
