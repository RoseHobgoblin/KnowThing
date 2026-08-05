<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import EntryForm from '$lib/components/wordbook/EntryForm.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { wordbookContributeBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')
	const createEntryMutation = createMutation(() => ({
		mutationFn: (formData: Record<string, unknown>) => api<{ word: string }>('POST', '/api/wordbook', formData),
	}))

	async function handleSubmit(formData: Record<string, unknown>) {
		const entry = await createEntryMutation.mutateAsync(formData)
		pushSuccess(m.wb_word_created())
		const lang = data.languages.find(l => l.id === formData.languageId)
		// Awaited so EntryForm stays in its submitting state — and its unsaved-changes
		// guard stays disarmed — until the navigation away has completed.
		if (lang) {
			await goto(`/Wordbook/${lang.slug}/${encodeURIComponent(entry.word)}`)
		} else {
			await goto('/Wordbook')
		}
	}
</script>

<svelte:head>
	<title>Add Word — Wordbook — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={wordbookContributeBreadcrumbs(wbName)}
	title={m.wb_add_a_word_heading()}
>
	{#snippet actions()}
		<a href="/Wordbook/contribute/language" class="text-link hover:underline">+ {m.wb_new_language()}</a>
	{/snippet}

	{#if data.languages.length === 0}
		<div class="p-6 bg-accent-subtle border border-accent-border text-center">
			<p class="text-accent-text mb-2">{m.wb_no_languages_created()}</p>
			<a href="/Wordbook/contribute/language" class="text-link font-medium hover:underline">{m.wb_create_language_first()} →</a>
		</div>
	{:else}
		<EntryForm
			languages={data.languages}
			initial={data.preselectedLanguageId ? { languageId: data.preselectedLanguageId } : {}}
			onsubmit={handleSubmit}
			submitLabel={m.wb_add_entry()}
		/>
	{/if}
</ArticleShell>
