<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import LanguageForm from '$lib/components/wordbook/LanguageForm.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { wordbookAddLanguageBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')

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
	breadcrumbs={wordbookAddLanguageBreadcrumbs(wbName)}
	title="Add a Language"
>
	<LanguageForm
		existingLanguages={data.existingLanguages}
		onsubmit={handleSubmit}
		submitLabel="Create Language"
	/>
</ArticleShell>
