<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import LanguageForm from '$lib/feature/wordbook/components/LanguageForm.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { wordbookAddLanguageBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')
	const createLanguageMutation = createMutation(() => ({
		mutationFn: (formData: Record<string, unknown>) => api<{ slug: string }>('POST', '/api/languages', formData),
	}))

	async function handleSubmit(formData: Record<string, unknown>) {
		const lang = await createLanguageMutation.mutateAsync(formData)
		pushSuccess(m.wb_language_created())
		// Awaited so LanguageForm stays in its submitting state — and its unsaved-changes
		// guard stays disarmed — until the navigation away has completed.
		await goto(`/Wordbook/${lang.slug}`)
	}
</script>

<svelte:head>
	<title>Add Language — Wordbook — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={wordbookAddLanguageBreadcrumbs(wbName)}
	title={m.wb_add_a_language_heading()}
>
	<LanguageForm
		existingLanguages={data.existingLanguages}
		onsubmit={handleSubmit}
		submitLabel={m.wb_create_language()}
	/>
</ArticleShell>
