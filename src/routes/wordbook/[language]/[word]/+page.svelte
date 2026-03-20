<script lang="ts">
	import type { PageData } from './$types.js';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import LanguageBadge from '$lib/components/wordbook/LanguageBadge.svelte';
	import TagPill from '$lib/components/wordbook/TagPill.svelte';
	import EtymologySection from '$lib/components/wordbook/EtymologySection.svelte';
	import InflectionTable from '$lib/components/wordbook/InflectionTable.svelte';
	import { PARTS_OF_SPEECH, POS_COLORS } from '$lib/components/wordbook/constants.js';

	let { data }: { data: PageData } = $props();

	const layoutData = $derived($page.data);
	const isAuthenticated = $derived(!!layoutData.user);
	const isAdmin = $derived(layoutData.user?.role === 'admin');

	// Add sense form state (per homograph)
	let addingSenseFor = $state<number | null>(null);
	let newPos = $state('');
	let newDef = $state('');
	let newUsage = $state('');
	let newTranslation = $state('');
	let submittingSense = $state(false);

	async function addSense(entryId: number, e: SubmitEvent) {
		e.preventDefault();
		if (!newDef.trim()) return;
		submittingSense = true;
		const res = await fetch(`/api/wordbook/${entryId}/definitions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				partOfSpeech: newPos || undefined,
				definition: newDef.trim(),
				usageExample: newUsage.trim() || undefined,
				usageTranslation: newTranslation.trim() || undefined
			})
		});
		if (res.ok) {
			newPos = ''; newDef = ''; newUsage = ''; newTranslation = '';
			addingSenseFor = null;
			invalidateAll();
		}
		submittingSense = false;
	}

	async function deleteSense(entryId: number, defId: number) {
		if (!confirm('Remove this definition?')) return;
		await fetch(`/api/wordbook/${entryId}/definitions/${defId}`, { method: 'DELETE' });
		invalidateAll();
	}

	async function deleteEntry(entryId: number) {
		if (!confirm(`Delete this entry entirely? This cannot be undone.`)) return;
		const res = await fetch(`/api/wordbook/${entryId}`, { method: 'DELETE' });
		if (res.ok) {
			// If there are other homographs, stay on the page
			if (data.homographs.length > 1) {
				invalidateAll();
			} else {
				goto(`/wordbook/${data.language.slug}`);
			}
		}
	}

	const posColors = POS_COLORS;
	const inputClass = 'w-full px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400';
</script>

<svelte:head>
	<title>{data.word} ({data.language.name}) — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<!-- Breadcrumb -->
	<nav class="text-sm text-stone-500">
		<a href="/wordbook" class="hover:text-amber-700">Wordbook</a>
		<span class="mx-1">›</span>
		<a href="/wordbook/{data.language.slug}" class="hover:text-amber-700">{data.language.name}</a>
		<span class="mx-1">›</span>
		<span class="text-stone-700">{data.word}</span>
	</nav>

	{#each data.homographs as hom, homIndex}
		{@const entry = hom.entry}
		{@const defs = hom.definitions}
		{@const variants = hom.variants}
		{@const relations = hom.relations}

		<!-- Headword card -->
		<article class="bg-white rounded-lg border border-stone-200 overflow-hidden">
			<div class="p-6">
				<!-- Header -->
				<div class="flex items-start justify-between mb-1">
					<div class="flex items-baseline gap-3 flex-wrap">
						<h2 class="text-3xl font-serif font-bold text-stone-900">
							{data.word}{#if data.isMultipleHomographs}<sup class="text-base text-stone-400 ml-0.5">{entry.homographNumber}</sup>{/if}
						</h2>
						{#if homIndex === 0}
							<LanguageBadge name={data.language.name} slug={data.language.slug} color={data.language.color} />
						{/if}
					</div>
					{#if isAuthenticated}
						<div class="flex gap-3 text-sm shrink-0">
							<a href="/wordbook/contribute/{entry.id}" class="text-amber-700 hover:text-amber-900 font-medium">Edit</a>
							{#if isAdmin}
								<button onclick={() => deleteEntry(entry.id)} class="text-red-400 hover:text-red-600 text-xs">Delete</button>
							{/if}
						</div>
					{/if}
				</div>

				{#if entry.pronunciation}
					<p class="text-stone-400 font-mono text-sm">{entry.pronunciation}</p>
				{/if}

				<!-- Dialect variants -->
				{#if variants.length > 0}
					<div class="mb-4 space-y-0.5">
						{#each variants as variant}
							<div class="flex items-baseline gap-2 text-sm">
								<span class="text-stone-500 min-w-[6rem] text-xs font-medium">{variant.dialectName}:</span>
								{#if variant.pronunciation}
									<span class="text-stone-400 font-mono text-xs">{variant.pronunciation}</span>
								{/if}
								{#if variant.spelling}
									<span class="text-stone-600 italic">"{variant.spelling}"</span>
								{/if}
								{#if variant.notes}
									<span class="text-stone-400 text-xs">({variant.notes})</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- Definitions -->
				<div class="divide-y divide-stone-100">
					{#each defs as def, i}
						<div class="py-4 first:pt-0 group">
							<div class="flex items-baseline gap-2 mb-1">
								{#if defs.length > 1}
									<span class="text-xs font-bold text-stone-400">{i + 1}.</span>
								{/if}
								{#if def.partOfSpeech}
									<span class="px-1.5 py-0.5 rounded text-[10px] font-medium {posColors[def.partOfSpeech] || 'bg-stone-100 text-stone-600'}">{def.partOfSpeech}</span>
								{/if}
								{#if isAuthenticated && defs.length > 1}
									<button onclick={() => deleteSense(entry.id, def.id)} class="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-auto">Remove</button>
								{/if}
							</div>
							<p class="text-stone-800 leading-relaxed">{def.definition}</p>
							{#if def.usageExample}
								<div class="mt-2 pl-3 border-l-2 border-amber-200">
									<p class="text-sm italic text-stone-700">{def.usageExample}</p>
									{#if def.usageTranslation}
										<p class="text-sm text-stone-500 mt-0.5">{def.usageTranslation}</p>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Add sense -->
				{#if isAuthenticated}
					{#if addingSenseFor === entry.id}
						<form onsubmit={(e) => addSense(entry.id, e)} class="mt-4 p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
							<div class="flex gap-2">
								<select bind:value={newPos} class="px-2 py-1.5 border border-stone-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-400">
									<option value="">Part of speech</option>
									{#each PARTS_OF_SPEECH as pos}
										<option value={pos}>{pos}</option>
									{/each}
								</select>
								<input type="text" bind:value={newDef} placeholder="Definition..." required class="flex-1 {inputClass}" />
							</div>
							<div class="flex gap-2">
								<input type="text" bind:value={newUsage} placeholder="Usage example" class="flex-1 {inputClass}" />
								<input type="text" bind:value={newTranslation} placeholder="Translation" class="flex-1 {inputClass}" />
							</div>
							<div class="flex gap-2">
								<button type="submit" disabled={submittingSense} class="px-3 py-1 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 disabled:opacity-50">Add</button>
								<button type="button" onclick={() => addingSenseFor = null} class="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
							</div>
						</form>
					{:else}
						<button onclick={() => addingSenseFor = entry.id} class="mt-3 text-sm text-amber-700 hover:text-amber-900 hover:underline">+ Add definition</button>
					{/if}
				{/if}

				<!-- Inflection table -->
				<InflectionTable
					dimensions={hom.inflection.dimensions}
					forms={hom.inflection.forms}
					overrides={hom.inflection.overrides}
					className={hom.inflection.className}
					stem={hom.inflection.stem}
					hasInflection={hom.inflection.hasInflection}
				/>

				<!-- Tags -->
				{#if entry.tags && entry.tags.length > 0}
					<div class="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-stone-100">
						{#each entry.tags as tag}
							<TagPill {tag} language={data.language.slug} />
						{/each}
					</div>
				{/if}

				<!-- Wiki link -->
				{#if entry.pageSlug}
					<div class="mt-3">
						<a href="/know/{entry.pageSlug}" class="text-sm text-amber-700 hover:text-amber-900 hover:underline">
							See also: {entry.pageSlug.replace(/_/g, ' ')} →
						</a>
					</div>
				{/if}
			</div>
		</article>

		<!-- Etymology & Relations (per homograph) -->
		<div class="bg-white rounded-lg border border-stone-200 p-6">
			<EtymologySection
				entryId={entry.id}
				direct={relations.direct}
				cognates={relations.cognates}
				etymologyChain={relations.etymologyChain}
				narrativeEtymology={entry.etymology || ''}
				{isAuthenticated}
			/>
		</div>
	{/each}
</div>
