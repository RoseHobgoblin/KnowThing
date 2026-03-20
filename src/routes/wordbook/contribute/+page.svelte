<script lang="ts">
	import type { PageData } from './$types.js';
	import { goto } from '$app/navigation';
	import EntryForm from '$lib/components/wordbook/EntryForm.svelte';

	let { data }: { data: PageData } = $props();

	async function handleSubmit(formData: Record<string, unknown>) {
		const res = await fetch('/api/wordbook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (!res.ok) {
			const err = await res.json();
			throw new Error(err.error || 'Failed to create entry');
		}

		const entry = await res.json();
		// Find the language slug for redirect
		const lang = data.languages.find(l => l.id === formData.languageId);
		if (lang) {
			goto(`/wordbook/${lang.slug}/${encodeURIComponent(entry.word)}`);
		} else {
			goto('/wordbook');
		}
	}
</script>

<svelte:head>
	<title>Add Word — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-stone-900 mb-1">Add a Word</h1>
		<p class="text-sm text-stone-500">Contribute to the Wordbook by adding a new lexicon entry.</p>
	</div>

	{#if data.languages.length === 0}
		<div class="p-6 bg-amber-50 border border-amber-200 rounded-lg text-center">
			<p class="text-amber-800 mb-2">No languages have been created yet.</p>
			<a href="/wordbook/contribute/language" class="text-amber-700 hover:underline font-medium">Create a language first →</a>
		</div>
	{:else}
		<div class="bg-white rounded-lg border border-stone-200 p-6">
			<EntryForm languages={data.languages} onsubmit={handleSubmit} submitLabel="Add Entry" />
		</div>
	{/if}
</div>
