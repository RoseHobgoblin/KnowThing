<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import EntryForm from '$lib/components/wordbook/EntryForm.svelte'

	let { data }: { data: PageData } = $props()

	async function handleSubmit(formData: Record<string, unknown>) {
		// Update headword
		const res = await fetch(`/api/wordbook/${data.entry.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				word: formData.word,
				languageId: formData.languageId,
				pronunciation: formData.pronunciation,
				etymology: formData.etymology,
				notes: formData.notes,
				pageSlug: formData.pageSlug,
				tags: formData.tags,
			}),
		})

		if (!res.ok) {
			const error = await res.json()
			throw new Error(error.error || 'Failed to update entry')
		}

		// Bulk replace definitions atomically
		const defs = formData.defs as Array<{ partOfSpeech?: string, definition: string, usageExample?: string, usageTranslation?: string }>
		if (defs && defs.length > 0) {
			const defRes = await fetch(`/api/wordbook/${data.entry.id}/definitions`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ defs }),
			})
			if (!defRes.ok) {
				const error = await defRes.json()
				throw new Error(error.error || 'Failed to update definitions')
			}
		}

		const lang = data.languages.find(l => l.id === formData.languageId)
		if (lang) {
			goto(`/wordbook/${lang.slug}/${encodeURIComponent(String(formData.word))}`)
		} else {
			goto('/wordbook')
		}
	}
</script>

<svelte:head>
	<title>Edit "{data.entry.word}" — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-heading mb-1">Edit: {data.entry.word}</h1>
		<p class="text-sm text-dim">Update this lexicon entry.</p>
	</div>

	<div class="bg-surface rounded-lg border border-border p-6">
		<EntryForm
			languages={data.languages}
			initial={{
				word: data.entry.word,
				languageId: data.entry.languageId,
				pronunciation: data.entry.pronunciation || '',
				etymology: data.entry.etymology || '',
				notes: data.entry.notes || '',
				pageSlug: data.entry.pageSlug || '',
				tags: data.entry.tags || [],
			}}
			initialDefinitions={data.definitions.map(d => ({
				partOfSpeech: d.partOfSpeech,
				definition: d.definition,
				usageExample: d.usageExample,
				usageTranslation: d.usageTranslation,
			}))}
			onsubmit={handleSubmit}
			submitLabel="Save Changes"
		/>
	</div>
</div>
