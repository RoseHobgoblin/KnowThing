<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import LanguageForm from '$lib/components/wordbook/LanguageForm.svelte'

	let { data }: { data: PageData } = $props()

	async function handleSubmit(formData: Record<string, unknown>) {
		const res = await fetch('/api/languages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData),
		})
		if (!res.ok) {
			const error = await res.json()
			throw new Error(error.error || 'Failed to create language')
		}
		const lang = await res.json()
		pushSuccess('Language created')
		goto(`/wordbook/${lang.slug}`)
	}
</script>

<svelte:head>
	<title>Add Language — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-heading mb-1">Add a Language</h1>
		<p class="text-sm text-dim">Register a new language for the Wordbook.</p>
	</div>

	<div class="bg-surface rounded-lg border border-border p-6">
		<LanguageForm
			existingLanguages={data.existingLanguages}
			onsubmit={handleSubmit}
			submitLabel="Create Language"
		/>
	</div>
</div>
