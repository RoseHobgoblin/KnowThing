<script lang="ts">
	import LanguageBadge from './LanguageBadge.svelte';
	import TagPill from './TagPill.svelte';

	let { entry, showLanguage = true, compact = false }: {
		entry: {
			id: number;
			word: string;
			pronunciation?: string | null;
			partOfSpeech?: string | null;
			definition: string;
			etymology?: string | null;
			usageExample?: string | null;
			usageTranslation?: string | null;
			notes?: string | null;
			pageSlug?: string | null;
			tags?: string[] | null;
			related?: string[] | null;
			languageName?: string;
			languageSlug?: string;
			languageColor?: string | null;
		};
		showLanguage?: boolean;
		compact?: boolean;
	} = $props();

	const posColors: Record<string, string> = {
		noun: 'bg-blue-100 text-blue-700',
		verb: 'bg-green-100 text-green-700',
		adjective: 'bg-purple-100 text-purple-700',
		adverb: 'bg-orange-100 text-orange-700',
		pronoun: 'bg-pink-100 text-pink-700',
		preposition: 'bg-cyan-100 text-cyan-700',
		conjunction: 'bg-yellow-100 text-yellow-700',
		interjection: 'bg-red-100 text-red-700',
		particle: 'bg-stone-100 text-stone-700',
		determiner: 'bg-indigo-100 text-indigo-700'
	};

	const posClass = entry.partOfSpeech
		? posColors[entry.partOfSpeech.toLowerCase()] || 'bg-stone-100 text-stone-600'
		: '';
</script>

{#if compact}
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
		<p class="text-sm text-stone-600 mt-1 line-clamp-2">{entry.definition}</p>
	</a>
{:else}
	<!-- Full: entry page -->
	<div class="mb-6">
		<div class="flex items-baseline gap-3 flex-wrap mb-2">
			{#if entry.partOfSpeech}
				<span class="px-2 py-0.5 rounded text-xs font-medium {posClass}">{entry.partOfSpeech}</span>
			{/if}
			{#if entry.pronunciation}
				<span class="text-stone-400 font-mono text-sm bg-stone-50 px-2 py-0.5 rounded">{entry.pronunciation}</span>
			{/if}
		</div>

		<p class="text-stone-800 leading-relaxed">{entry.definition}</p>

		{#if entry.etymology}
			<div class="mt-3">
				<span class="text-xs font-medium uppercase tracking-wide text-stone-400">Etymology</span>
				<p class="text-sm text-stone-600 mt-1 leading-relaxed">{entry.etymology}</p>
			</div>
		{/if}

		{#if entry.usageExample}
			<div class="mt-3 pl-3 border-l-2 border-amber-200">
				<p class="text-sm italic text-stone-700">{entry.usageExample}</p>
				{#if entry.usageTranslation}
					<p class="text-sm text-stone-500 mt-0.5">{entry.usageTranslation}</p>
				{/if}
			</div>
		{/if}

		{#if entry.notes}
			<p class="mt-3 text-xs text-stone-500 italic">{entry.notes}</p>
		{/if}

		{#if entry.tags && entry.tags.length > 0}
			<div class="flex flex-wrap gap-1.5 mt-3">
				{#each entry.tags as tag}
					<TagPill {tag} language={entry.languageSlug} />
				{/each}
			</div>
		{/if}

		{#if entry.related && entry.related.length > 0}
			<div class="mt-3">
				<span class="text-xs font-medium uppercase tracking-wide text-stone-400">Related</span>
				<div class="flex flex-wrap gap-2 mt-1">
					{#each entry.related as word}
						<a
							href="/wordbook/{entry.languageSlug}/{encodeURIComponent(word)}"
							class="text-sm text-amber-700 hover:text-amber-900 hover:underline"
						>{word}</a>
					{/each}
				</div>
			</div>
		{/if}

		{#if entry.pageSlug}
			<div class="mt-3">
				<a href="/know/{entry.pageSlug}" class="text-sm text-amber-700 hover:text-amber-900 hover:underline">
					See also: {entry.pageSlug.replace(/_/g, ' ')} →
				</a>
			</div>
		{/if}
	</div>
{/if}
