<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import LanguageBadge from './LanguageBadge.svelte';

	type RelatedEntry = {
		id: number;
		relationId: number;
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
		entryId,
		direct,
		cognates = [],
		etymologyChain = [],
		narrativeEtymology = '',
		isAuthenticated = false
	}: {
		entryId: number;
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
		isAuthenticated?: boolean;
	} = $props();

	const hasAnyContent = $derived(
		direct.derivedFrom.length > 0 ||
		direct.loanFrom.length > 0 ||
		direct.compoundOf.length > 0 ||
		direct.derivedWords.length > 0 ||
		direct.loanedTo.length > 0 ||
		direct.compoundsUsing.length > 0 ||
		cognates.length > 0 ||
		etymologyChain.length > 1 ||
		!!narrativeEtymology ||
		isAuthenticated
	);

	// ── Delete relation ──
	async function deleteRelation(relationId: number) {
		const res = await fetch(`/api/wordbook/${entryId}/relations/${relationId}`, { method: 'DELETE' });
		if (res.ok) invalidateAll();
	}

	// ── Add relation form state ──
	let showForm = $state(false);
	let direction = $state<'from' | 'to'>('from'); // 'from' = this word comes from target, 'to' = target comes from this
	let relationType = $state('derived_from');
	let targetQuery = $state('');
	let targetId = $state<number | null>(null);
	let notes = $state('');
	let submitting = $state(false);
	let formError = $state('');
	let searchResults = $state<Array<{ id: number; word: string; definition: string; languageName: string; languageSlug: string }>>([]);
	let showDropdown = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	const typeLabels: Record<string, string> = {
		derived_from: 'Derived from',
		loan_from: 'Borrowed from',
		compound_of: 'Compound of'
	};
	const reverseTypeLabels: Record<string, string> = {
		derived_from: 'Derives from this',
		loan_from: 'Borrowed this',
		compound_of: 'Is compound using this'
	};

	function handleSearch() {
		if (searchTimeout) clearTimeout(searchTimeout);
		targetId = null;
		if (targetQuery.trim().length < 2) { searchResults = []; showDropdown = false; return; }
		searchTimeout = setTimeout(async () => {
			const res = await fetch(`/api/wordbook?q=${encodeURIComponent(targetQuery.trim())}&limit=10`);
			if (res.ok) { searchResults = await res.json(); showDropdown = searchResults.length > 0; }
		}, 300);
	}

	function selectTarget(r: typeof searchResults[0]) {
		targetId = r.id;
		targetQuery = `${r.word} (${r.languageName})`;
		showDropdown = false;
	}

	async function addRelation(e: SubmitEvent) {
		e.preventDefault();
		if (!targetId) { formError = 'Select a target word'; return; }
		formError = '';
		submitting = true;

		// Direction determines who is source vs target
		const sourceId = direction === 'from' ? entryId : targetId;
		const tgtId = direction === 'from' ? targetId : entryId;

		try {
			const res = await fetch(`/api/wordbook/${sourceId}/relations`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetId: tgtId, relationType, notes: notes.trim() || undefined })
			});
			if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
			targetQuery = ''; targetId = null; notes = ''; showForm = false;
			invalidateAll();
		} catch (e: any) { formError = e.message; }
		finally { submitting = false; }
	}

	function relationLabel(type: string): string {
		switch (type) {
			case 'derived_from': return 'derived from';
			case 'loan_from': return 'borrowed from';
			case 'compound_of': return 'compound of';
			default: return type;
		}
	}
</script>

{#if hasAnyContent}
<div class="space-y-4">

	<!-- Etymology chain breadcrumb -->
	{#if etymologyChain.length > 1}
		<div class="flex items-center gap-1 flex-wrap text-sm">
			<span class="text-xs font-medium uppercase tracking-wide text-stone-400 mr-1">Origin</span>
			{#each etymologyChain as step, i}
				{#if i > 0}
					<span class="text-stone-300 text-xs">→</span>
				{/if}
				<a
					href="/wordbook/{step.languageSlug}/{encodeURIComponent(step.word)}"
					class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-50 hover:bg-amber-50 text-amber-700 hover:text-amber-900 transition-colors"
					title="{step.definition}"
				>
					<span class="italic font-medium">{step.word}</span>
					<span class="text-stone-400 text-xs">({step.languageName})</span>
				</a>
			{/each}
		</div>
	{/if}

	<!-- Etymology sources -->
	{#if direct.derivedFrom.length > 0 || direct.loanFrom.length > 0 || direct.compoundOf.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-stone-400 mb-2">Etymology</h3>

			{#each direct.derivedFrom as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1 group">
					<span class="text-stone-400">←</span>
					<span class="text-stone-500">derived from</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline italic">{entry.word}</a>
					<span class="text-stone-400">({entry.languageName})</span>
					<span class="text-stone-500 text-xs">"{entry.definition}"</span>
					{#if entry.relationNotes}<span class="text-stone-400 text-xs">— {entry.relationNotes}</span>{/if}
					{#if isAuthenticated}
						<button onclick={() => deleteRelation(entry.relationId)} class="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">×</button>
					{/if}
				</div>
			{/each}

			{#each direct.loanFrom as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1 group">
					<span class="text-stone-400">←</span>
					<span class="text-stone-500">borrowed from</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline italic">{entry.word}</a>
					<span class="text-stone-400">({entry.languageName})</span>
					<span class="text-stone-500 text-xs">"{entry.definition}"</span>
					{#if entry.relationNotes}<span class="text-stone-400 text-xs">— {entry.relationNotes}</span>{/if}
					{#if isAuthenticated}
						<button onclick={() => deleteRelation(entry.relationId)} class="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">×</button>
					{/if}
				</div>
			{/each}

			{#if direct.compoundOf.length > 0}
				<div class="flex items-baseline gap-2 text-sm mb-1 flex-wrap group">
					<span class="text-stone-400">←</span>
					<span class="text-stone-500">compound of</span>
					{#each direct.compoundOf as entry, i}
						{#if i > 0}<span class="text-stone-400">+</span>{/if}
						<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline italic">{entry.word}</a>
						<span class="text-stone-500 text-xs">({entry.definition})</span>
						{#if isAuthenticated}
							<button onclick={() => deleteRelation(entry.relationId)} class="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">×</button>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Narrative etymology -->
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
				<div class="flex items-baseline gap-2 text-sm mb-1 group">
					<span class="text-stone-400">→</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline">{entry.word}</a>
					{#if entry.partOfSpeech}<span class="text-xs text-stone-400">({entry.partOfSpeech})</span>{/if}
					<span class="text-stone-500 text-xs">"{entry.definition}"</span>
					{#if isAuthenticated}
						<button onclick={() => deleteRelation(entry.relationId)} class="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">×</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Borrowed by -->
	{#if direct.loanedTo.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-stone-400 mb-2">Borrowed by</h3>
			{#each direct.loanedTo as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1 group">
					<span class="text-stone-400">→</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline italic">{entry.word}</a>
					<span class="text-stone-400">({entry.languageName})</span>
					<span class="text-stone-500 text-xs">"{entry.definition}"</span>
					{#if isAuthenticated}
						<button onclick={() => deleteRelation(entry.relationId)} class="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">×</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Compounds using this -->
	{#if direct.compoundsUsing.length > 0}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wide text-stone-400 mb-2">Compounds</h3>
			{#each direct.compoundsUsing as entry}
				<div class="flex items-baseline gap-2 text-sm mb-1 group">
					<span class="text-stone-400">→</span>
					<a href="/wordbook/{entry.languageSlug}/{encodeURIComponent(entry.word)}" class="font-medium text-amber-700 hover:text-amber-900 hover:underline">{entry.word}</a>
					<span class="text-stone-500 text-xs">"{entry.definition}"</span>
					{#if isAuthenticated}
						<button onclick={() => deleteRelation(entry.relationId)} class="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">×</button>
					{/if}
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

	<!-- Add relation form (integrated) -->
	{#if isAuthenticated}
		{#if showForm}
			<div class="mt-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
				<div class="flex items-center justify-between mb-3">
					<h4 class="text-xs font-medium uppercase tracking-wide text-stone-500">Add relation</h4>
					<button onclick={() => showForm = false} class="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
				</div>

				<!-- Direction toggle -->
				<div class="flex gap-1 mb-3 text-xs">
					<button
						onclick={() => direction = 'from'}
						class="px-3 py-1.5 rounded-md transition-colors {direction === 'from' ? 'bg-amber-600 text-white' : 'bg-white text-stone-600 border border-stone-300 hover:bg-stone-50'}"
					>This word comes from...</button>
					<button
						onclick={() => direction = 'to'}
						class="px-3 py-1.5 rounded-md transition-colors {direction === 'to' ? 'bg-amber-600 text-white' : 'bg-white text-stone-600 border border-stone-300 hover:bg-stone-50'}"
					>Another word comes from this...</button>
				</div>

				<form onsubmit={addRelation} class="space-y-3">
					{#if formError}
						<div class="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{formError}</div>
					{/if}

					<div class="flex gap-3 flex-wrap">
						<select bind:value={relationType} class="px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
							{#each Object.entries(direction === 'from' ? typeLabels : reverseTypeLabels) as [value, label]}
								<option {value}>{label}</option>
							{/each}
						</select>

						<div class="relative flex-1 min-w-[200px]">
							<input
								type="text"
								bind:value={targetQuery}
								oninput={handleSearch}
								onfocus={() => { if (searchResults.length > 0) showDropdown = true; }}
								onblur={() => setTimeout(() => showDropdown = false, 200)}
								placeholder="Search for a word..."
								class="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
							/>
							{#if showDropdown}
								<div class="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
									{#each searchResults as result}
										<button type="button" onclick={() => selectTarget(result)} class="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm border-b border-stone-100 last:border-0">
											<span class="font-medium">{result.word}</span>
											<span class="text-stone-400 text-xs ml-1">({result.languageName})</span>
											<span class="text-stone-500 text-xs block">{result.definition}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<input type="text" bind:value={notes} placeholder="Notes (optional)" class="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />

					<button type="submit" disabled={submitting || !targetId} class="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
						{submitting ? 'Adding...' : 'Add'}
					</button>
				</form>
			</div>
		{:else}
			<button onclick={() => showForm = true} class="text-sm text-amber-700 hover:text-amber-900 hover:underline">
				+ Add etymological relation
			</button>
		{/if}
	{/if}

</div>
{:else if isAuthenticated}
	<!-- No relations yet, but user can add -->
	<div class="text-center py-4">
		<p class="text-sm text-stone-400 mb-2">No etymological relations yet.</p>
		<button onclick={() => showForm = true} class="text-sm text-amber-700 hover:text-amber-900 hover:underline">
			+ Add etymological relation
		</button>
		{#if showForm}
			<!-- same form, duplicated for the empty state -->
			<div class="mt-4 p-4 bg-stone-50 rounded-lg border border-stone-200 text-left">
				<div class="flex items-center justify-between mb-3">
					<h4 class="text-xs font-medium uppercase tracking-wide text-stone-500">Add relation</h4>
					<button onclick={() => showForm = false} class="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
				</div>
				<div class="flex gap-1 mb-3 text-xs">
					<button onclick={() => direction = 'from'} class="px-3 py-1.5 rounded-md transition-colors {direction === 'from' ? 'bg-amber-600 text-white' : 'bg-white text-stone-600 border border-stone-300 hover:bg-stone-50'}">This word comes from...</button>
					<button onclick={() => direction = 'to'} class="px-3 py-1.5 rounded-md transition-colors {direction === 'to' ? 'bg-amber-600 text-white' : 'bg-white text-stone-600 border border-stone-300 hover:bg-stone-50'}">Another word comes from this...</button>
				</div>
				<form onsubmit={addRelation} class="space-y-3">
					{#if formError}<div class="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{formError}</div>{/if}
					<div class="flex gap-3 flex-wrap">
						<select bind:value={relationType} class="px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
							{#each Object.entries(direction === 'from' ? typeLabels : reverseTypeLabels) as [value, label]}
								<option {value}>{label}</option>
							{/each}
						</select>
						<div class="relative flex-1 min-w-[200px]">
							<input type="text" bind:value={targetQuery} oninput={handleSearch} onfocus={() => { if (searchResults.length > 0) showDropdown = true; }} onblur={() => setTimeout(() => showDropdown = false, 200)} placeholder="Search for a word..." class="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
							{#if showDropdown}
								<div class="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
									{#each searchResults as result}
										<button type="button" onclick={() => selectTarget(result)} class="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm border-b border-stone-100 last:border-0">
											<span class="font-medium">{result.word}</span><span class="text-stone-400 text-xs ml-1">({result.languageName})</span>
											<span class="text-stone-500 text-xs block">{result.definition}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
					<input type="text" bind:value={notes} placeholder="Notes (optional)" class="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
					<button type="submit" disabled={submitting || !targetId} class="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">{submitting ? 'Adding...' : 'Add'}</button>
				</form>
			</div>
		{/if}
	</div>
{/if}
