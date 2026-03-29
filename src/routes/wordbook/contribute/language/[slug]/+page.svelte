<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import LanguageForm from '$lib/components/wordbook/LanguageForm.svelte'

	let { data }: { data: PageData } = $props()

	async function handleSubmit(formData: Record<string, unknown>) {
		const res = await fetch(`/api/languages/${data.language.slug}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData),
		})
		if (!res.ok) {
			const error = await res.json()
			throw new Error(error.error || 'Failed to update language')
		}
		pushSuccess('Language updated')
		goto(`/wordbook/${data.language.slug}`)
	}
</script>

<svelte:head>
	<title>Edit {data.language.name} — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-heading mb-1">Edit: {data.language.name}</h1>
		<p class="text-sm text-dim">
			<a href="/wordbook/{data.language.slug}" class="text-link hover:underline">← Back to {data.language.name}</a>
		</p>
	</div>

	<div class="bg-surface rounded-lg border border-border p-6">
		<LanguageForm
			initial={{
				name: data.language.name,
				slug: data.language.slug,
				nativeName: data.language.nativeName || '',
				script: data.language.script || 'Latin',
				family: data.language.family || '',
				color: data.language.color || 'var(--color-accent)',
				description: data.language.description || '',
				pageSlug: data.language.pageSlug || '',
				parentLanguageId: data.language.parentLanguageId || null,
				languageType: data.language.languageType || 'language',
			}}
			existingLanguages={data.otherLanguages}
			onsubmit={handleSubmit}
			submitLabel="Save Changes"
		/>
	</div>
</div>
