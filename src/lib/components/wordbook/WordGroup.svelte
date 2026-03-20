<script lang="ts">
	import WordEntry from './WordEntry.svelte';
	import LanguageBadge from './LanguageBadge.svelte';

	let { word, entries, languageName, languageSlug, languageColor }: {
		word: string;
		entries: Array<{
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
		}>;
		languageName: string;
		languageSlug: string;
		languageColor?: string | null;
	} = $props();
</script>

<article class="bg-white rounded-lg border border-stone-200 overflow-hidden">
	<div class="p-6">
		<!-- Headword -->
		<div class="flex items-baseline gap-3 flex-wrap mb-1">
			<h2 class="text-3xl font-serif font-bold text-stone-900">{word}</h2>
			<LanguageBadge name={languageName} slug={languageSlug} color={languageColor} />
		</div>

		{#if entries[0]?.pronunciation}
			<p class="text-stone-400 font-mono text-sm mb-4">{entries[0].pronunciation}</p>
		{/if}

		<!-- Numbered definitions if multiple senses -->
		<div class="divide-y divide-stone-100">
			{#each entries as entry, i}
				<div class="py-4 first:pt-0">
					{#if entries.length > 1}
						<span class="text-xs font-bold text-stone-400 mr-2">{i + 1}.</span>
					{/if}
					<WordEntry {entry} showLanguage={false} />
				</div>
			{/each}
		</div>
	</div>
</article>
