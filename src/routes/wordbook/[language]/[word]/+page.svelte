<script lang="ts">
	import type { PageData } from './$types.js';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import LanguageBadge from '$lib/components/wordbook/LanguageBadge.svelte';
	import TagPill from '$lib/components/wordbook/TagPill.svelte';
	import EtymologySection from '$lib/components/wordbook/EtymologySection.svelte';
	import { PARTS_OF_SPEECH, POS_COLORS } from '$lib/components/wordbook/constants.js';

	let { data }: { data: PageData } = $props();

	const layoutData = $derived($page.data);
	const isAuthenticated = $derived(!!layoutData.user);
	const isAdmin = $derived(layoutData.user?.role === 'admin');

	// Add sense form
	let showAddSense = $state(false);
	let newPos = $state('');
	let newDef = $state('');
	let newUsage = $state('');
	let newTranslation = $state('');
	let addingSense = $state(false);

	async function addSense(e: SubmitEvent) {
		e.preventDefault();
		if (!newDef.trim()) return;
		addingSense = true;
		const res = await fetch(`/api/wordbook/${data.entry.id}/definitions`, {
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
			showAddSense = false;
			invalidateAll();
		}
		addingSense = false;
	}

	async function deleteSense(defId: number) {
		if (!confirm('Remove this definition?')) return;
		await fetch(`/api/wordbook/${data.entry.id}/definitions/${defId}`, { method: 'DELETE' });
		invalidateAll();
	}

	async function deleteEntry() {
		if (!confirm(`Delete "${data.word}" entirely? This cannot be undone.`)) return;
		const res = await fetch(`/api/wordbook/${data.entry.id}`, { method: 'DELETE' });
		if (res.ok) goto(`/wordbook/${data.language.slug}`);
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

	<!-- Headword card -->
	<article class="bg-white rounded-lg border border-stone-200 overflow-hidden">
		<div class="p-6">
			<!-- Header with actions -->
			<div class="flex items-start justify-between mb-1">
				<div class="flex items-baseline gap-3 flex-wrap">
					<h1 class="text-3xl font-serif font-bold text-stone-900">{data.word}</h1>
					<LanguageBadge name={data.language.name} slug={data.language.slug} color={data.language.color} />
				</div>
				{#if isAuthenticated}
					<div class="flex gap-3 text-sm shrink-0">
						<a href="/wordbook/contribute/{data.entry.id}" class="text-amber-700 hover:text-amber-900 font-medium">Edit</a>
						{#if isAdmin}
							<button onclick={deleteEntry} class="text-red-400 hover:text-red-600 text-xs">Delete</button>
						{/if}
					</div>
				{/if}
			</div>

			{#if data.entry.pronunciation}
				<p class="text-stone-400 font-mono text-sm mb-4">{data.entry.pronunciation}</p>
			{/if}

			<!-- Definitions -->
			<div class="divide-y divide-stone-100">
				{#each data.definitions as def, i}
					<div class="py-4 first:pt-0 group">
						<div class="flex items-baseline gap-2 mb-1">
							{#if data.definitions.length > 1}
								<span class="text-xs font-bold text-stone-400">{i + 1}.</span>
							{/if}
							{#if def.partOfSpeech}
								<span class="px-1.5 py-0.5 rounded text-[10px] font-medium {posColors[def.partOfSpeech] || 'bg-stone-100 text-stone-600'}">{def.partOfSpeech}</span>
							{/if}
							{#if isAuthenticated && data.definitions.length > 1}
								<button onclick={() => deleteSense(def.id)} class="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-auto">Remove</button>
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
				{#if showAddSense}
					<form onsubmit={addSense} class="mt-4 p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
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
							<button type="submit" disabled={addingSense} class="px-3 py-1 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 disabled:opacity-50">Add</button>
							<button type="button" onclick={() => showAddSense = false} class="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
						</div>
					</form>
				{:else}
					<button onclick={() => showAddSense = true} class="mt-3 text-sm text-amber-700 hover:text-amber-900 hover:underline">+ Add definition</button>
				{/if}
			{/if}

			<!-- Tags -->
			{#if data.entry.tags && data.entry.tags.length > 0}
				<div class="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-stone-100">
					{#each data.entry.tags as tag}
						<TagPill {tag} language={data.language.slug} />
					{/each}
				</div>
			{/if}

			<!-- Wiki link -->
			{#if data.entry.pageSlug}
				<div class="mt-3">
					<a href="/know/{data.entry.pageSlug}" class="text-sm text-amber-700 hover:text-amber-900 hover:underline">
						See also: {data.entry.pageSlug.replace(/_/g, ' ')} →
					</a>
				</div>
			{/if}
		</div>
	</article>

	<!-- Etymology & Relations -->
	<div class="bg-white rounded-lg border border-stone-200 p-6">
		<EtymologySection
			entryId={data.entry.id}
			direct={data.relations.direct}
			cognates={data.relations.cognates}
			etymologyChain={data.relations.etymologyChain}
			narrativeEtymology={data.entry.etymology || ''}
			{isAuthenticated}
		/>
	</div>
</div>
