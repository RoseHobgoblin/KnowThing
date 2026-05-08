<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import EntryForm from '$lib/components/wordbook/EntryForm.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { wordbookContributeBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')

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
			goto(`/Wordbook/${lang.slug}/${encodeURIComponent(entry.word)}`)
		} else {
			goto('/Wordbook')
		}
	}
</script>

<svelte:head>
	<title>Add Word — Wordbook — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={wordbookContributeBreadcrumbs(wbName)}
	title="Add a Word"
>
	{#snippet actions()}
		<a href="/Wordbook/contribute/language" class="text-link hover:underline">+ New language</a>
	{/snippet}

	{#if data.languages.length === 0}
		<div class="p-6 bg-accent-subtle border border-accent-border text-center">
			<p class="text-accent-text mb-2">No languages have been created yet.</p>
			<a href="/Wordbook/contribute/language" class="text-link font-medium hover:underline">Create a language first →</a>
		</div>
	{:else}
		<EntryForm
			languages={data.languages}
			initial={data.preselectedLanguageId ? { languageId: data.preselectedLanguageId } : {}}
			onsubmit={handleSubmit}
			submitLabel="Add Entry"
		/>
	{/if}
</ArticleShell>
