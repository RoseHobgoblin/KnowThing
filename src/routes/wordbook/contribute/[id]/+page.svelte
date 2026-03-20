<script lang="ts">
	import type { PageData } from './$types.js';
	import { goto } from '$app/navigation';
	import EntryForm from '$lib/components/wordbook/EntryForm.svelte';

	let { data }: { data: PageData } = $props();

	async function handleSubmit(formData: Record<string, unknown>) {
		const res = await fetch(`/api/wordbook/${data.entry.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (!res.ok) {
			const err = await res.json();
			throw new Error(err.error || 'Failed to update entry');
		}

		const lang = data.languages.find(l => l.id === formData.languageId);
		if (lang) {
			goto(`/wordbook/${lang.slug}/${encodeURIComponent(data.entry.word)}`);
		} else {
			goto('/wordbook');
		}
	}
</script>

<svelte:head>
	<title>Edit "{data.entry.word}" — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-stone-900 mb-1">Edit: {data.entry.word}</h1>
		<p class="text-sm text-stone-500">Update this lexicon entry.</p>
	</div>

	<div class="bg-white rounded-lg border border-stone-200 p-6">
		<EntryForm
			languages={data.languages}
			initial={{
				word: data.entry.word,
				languageId: data.entry.languageId,
				pronunciation: data.entry.pronunciation || '',
				partOfSpeech: data.entry.partOfSpeech || '',
				definition: data.entry.definition,
				etymology: data.entry.etymology || '',
				usageExample: data.entry.usageExample || '',
				usageTranslation: data.entry.usageTranslation || '',
				notes: data.entry.notes || '',
				pageSlug: data.entry.pageSlug || '',
				tags: data.entry.tags || [],
				related: data.entry.related || []
			}}
			onsubmit={handleSubmit}
			submitLabel="Save Changes"
		/>
	</div>
</div>
