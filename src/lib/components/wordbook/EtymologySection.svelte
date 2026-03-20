<script lang="ts">
	import LanguageBadge from './LanguageBadge.svelte';

	type RelatedEntry = {
		id: number;
		word: string;
		definition: string;
		pronunciation: string | null;
		partOfSpeech: string | null;
		languageName: string;
		languageSlug: string;
		languageFamily: string | null;
		languageColor: string | null;
		relationNotes: string | null;
	};

	type CognateGroup = {
		family: string;
		languages: Array<{
			name: string;
			slug: string;
			words: Array<{ id: number; word: string; definition: string; pronunciation: string | null }>;
		}>;
	};

	type EtymologyStep = {
		id: number;
		word: string;
		definition: string;
		languageName: string;
		languageSlug: string;
		relation: string | null;
	};

	let {
		direct,
		cognates = [],
		etymologyChain = [],
		narrativeEtymology = ''
	}: {
		direct: {
			derivedFrom: RelatedEntry[];
			loanFrom: RelatedEntry[];
			compoundOf: RelatedEntry[];
			derivedWords: RelatedEntry[];
			loanedTo: RelatedEntry[];
			compoundsUsing: RelatedEntry[];
		};
		cognates?: CognateGroup[];
		etymologyChain?: EtymologyStep[];
		narrativeEtymology?: string;
	} = $props();

	const hasAnyRelations = $derived(
		direct.derivedFrom.length > 0 ||
		direct.loanFrom.length > 0 ||
		direct.compoundOf.length > 0 ||
		direct.derivedWords.length > 0 ||
		direct.loanedTo.length > 0 ||
		direct.compoundsUsing.length > 0 ||
		cognates.length > 0 ||
		!!narrativeEtymology
	);

	function relationLabel(type: string): string {
		switch (type) {
			case 'derived_from': return 'derived from';
			case 'loan_from': return 'borrowed from';
			case 'compound_of': return 'compound of';
			default: return type;
		}
	}
</script>

{#if hasAnyRelations}
<div class="space-y-4 mt-4">

	<!-- Etymology sources -->
	{#if direct.derivedFrom.length > 0 || direct.loanFrom.length > 0 || direct.compoundOf.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-stone-400 mb-2">Etymology</h3>

			{#each direct.derivedFrom as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1">
					<span class="text-stone-400">←</span>
					<span class="text-stone-500">derived from</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline italic">{entry.word}</a>
					<span class="text-stone-400">({entry.languageName})</span>
					<span class="text-stone-500 text-xs">"{entry.definition}"</span>
					{#if entry.relationNotes}
						<span class="text-stone-400 text-xs">— {entry.relationNotes}</span>
					{/if}
				</div>
			{/each}

			{#each direct.loanFrom as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1">
					<span class="text-stone-400">←</span>
					<span class="text-stone-500">borrowed from</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline italic">{entry.word}</a>
					<span class="text-stone-400">({entry.languageName})</span>
					<span class="text-stone-500 text-xs">"{entry.definition}"</span>
					{#if entry.relationNotes}
						<span class="text-stone-400 text-xs">— {entry.relationNotes}</span>
					{/if}
				</div>
			{/each}

			{#if direct.compoundOf.length > 0}
				<div class="flex items-baseline gap-2 text-sm mb-1 flex-wrap">
					<span class="text-stone-400">←</span>
					<span class="text-stone-500">compound of</span>
					{#each direct.compoundOf as entry, i}
						{#if i > 0}<span class="text-stone-400">+</span>{/if}
						<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline italic">{entry.word}</a>
						<span class="text-stone-500 text-xs">({entry.definition})</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Narrative etymology (plain text, kept for editorial notes) -->
	{#if narrativeEtymology}
		<div>
			{#if direct.derivedFrom.length === 0 && direct.loanFrom.length === 0 && direct.compoundOf.length === 0}
				<h3 class="text-xs font-medium uppercase tracking-wide text-stone-400 mb-2">Etymology</h3>
			{/if}
			<p class="text-sm text-stone-600 italic leading-relaxed">{narrativeEtymology}</p>
		</div>
	{/if}

	<!-- Derived forms -->
	{#if direct.derivedWords.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-stone-400 mb-2">Derived forms</h3>
			{#each direct.derivedWords as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1">
					<span class="text-stone-400">→</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline">{entry.word}</a>
					{#if entry.partOfSpeech}
						<span class="text-xs text-stone-400">({entry.partOfSpeech})</span>
					{/if}
					<span class="text-stone-500 text-xs">"{entry.definition}"</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Borrowed by -->
	{#if direct.loanedTo.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-stone-400 mb-2">Borrowed by</h3>
			{#each direct.loanedTo as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1">
					<span class="text-stone-400">→</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline italic">{entry.word}</a>
					<span class="text-stone-400">({entry.languageName})</span>
					<span class="text-stone-500 text-xs">"{entry.definition}"</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Compounds using this word -->
	{#if direct.compoundsUsing.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-stone-400 mb-2">Compounds</h3>
			{#each direct.compoundsUsing as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1">
					<span class="text-stone-400">→</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline">{entry.word}</a>
					<span class="text-stone-500 text-xs">"{entry.definition}"</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Auto-computed cognates -->
	{#if cognates.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-stone-400 mb-2">Cognates</h3>
			{#each cognates as group}
				<div class="mb-3">
					<div class="text-xs text-stone-400 font-medium mb-1">{group.family} family</div>
					{#each group.languages as lang}
						<div class="flex items-baseline gap-2 text-sm mb-1 ml-3">
							<span class="text-stone-500 min-w-[5rem]">{lang.name}:</span>
							{#each lang.words as w, i}
								{#if i > 0}<span class="text-stone-300">,</span>{/if}
								<a href="/wordbook/{lang.slug}/{encodeURIComponent(w.word)}" class="text-amber-700 hover:text-amber-900 hover:underline italic">{w.word}</a>
								<span class="text-stone-400 text-xs">({w.definition})</span>
							{/each}
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

</div>
{/if}
