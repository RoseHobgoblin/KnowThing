<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import EntryForm from '$lib/components/wordbook/EntryForm.svelte'

	let { data }: { data: PageData } = $props()

	async function handleSubmit(formData: Record<string, unknown>) {
		const res = await fetch('/api/wordbook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData),
		})

		if (!res.ok) {
			const error = await res.json()
			throw new Error(error.error || 'Failed to create entry')
		}

		const entry = await res.json()
		pushSuccess('Word created')
		const lang = data.languages.find(l => l.id === formData.languageId)
		if (lang) {
			goto(`/wordbook/${lang.slug}/${encodeURIComponent(entry.word)}`)
		} else {
			goto('/wordbook')
		}
	}
</script>

<svelte:head>
	<title>Add Word — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-heading mb-1">Add a Word</h1>
			<p class="text-sm text-dim">
				<a href="/wordbook" class="text-link hover:underline">← Back to Wordbook</a>
			</p>
		</div>
		<a href="/wordbook/contribute/language" class="text-sm text-link hover:underline">+ New language</a>
	</div>

	{#if data.languages.length === 0}
		<div class="p-6 bg-accent-subtle border border-accent-border text-center">
			<p class="text-accent-text mb-2">No languages have been created yet.</p>
			<a href="/wordbook/contribute/language" class="text-link font-medium hover:underline">Create a language first →</a>
		</div>
	{:else}
		<div class="bg-surface border border-border p-6">
			<EntryForm
				languages={data.languages}
				initial={data.preselectedLanguageId ? { languageId: data.preselectedLanguageId } : {}}
				onsubmit={handleSubmit}
				submitLabel="Add Entry"
			/>
		</div>
	{/if}
</div>
