<script lang="ts">
	import LanguageBadge from './LanguageBadge.svelte';
	import { POS_COLORS } from './constants.js';

	let { entry, showLanguage = true }: {
		entry: {
			id: number;
			word: string;
			pronunciation?: string | null;
			partOfSpeech?: string | null;
			definition?: string | null;
			tags?: string[] | null;
			languageName?: string;
			languageSlug?: string;
			languageColor?: string | null;
		};
		showLanguage?: boolean;
	} = $props();

	const posClass = $derived(
		entry.partOfSpeech
			? POS_COLORS[entry.partOfSpeech.toLowerCase()] || 'bg-stone-100 text-stone-600'
			: ''
	);
</script>

<!-- Compact: search result / list item -->
<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="block p-4 hover:bg-amber-50/30 transition-colors rounded-lg">
	<div class="flex items-baseline gap-2 flex-wrap">
		<span class="text-lg font-semibold text-stone-900">{entry.word}</span>
		{#if entry.pronunciation}
			<span class="text-sm text-stone-400 font-mono">{entry.pronunciation}</span>
		{/if}
		{#if entry.partOfSpeech}
			<span class="px-1.5 py-0.5 rounded text-[10px] font-medium {posClass}">{entry.partOfSpeech}</span>
		{/if}
		{#if showLanguage && entry.languageName && entry.languageSlug}
			<LanguageBadge name={entry.languageName} slug={entry.languageSlug} color={entry.languageColor} />
		{/if}
	</div>
	{#if entry.definition}
		<p class="text-sm text-stone-600 mt-1 line-clamp-2">{entry.definition}</p>
	{/if}
</a>
