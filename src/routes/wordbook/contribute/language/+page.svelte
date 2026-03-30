<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import LanguageForm from '$lib/components/wordbook/LanguageForm.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'

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

<ArticleShell
	breadcrumbs={[{ label: 'Wordbook', href: '/wordbook' }, { label: 'Add Language' }]}
	title="Add a Language"
>
	<LanguageForm
		existingLanguages={data.existingLanguages}
		onsubmit={handleSubmit}
		submitLabel="Create Language"
	/>
</ArticleShell>
