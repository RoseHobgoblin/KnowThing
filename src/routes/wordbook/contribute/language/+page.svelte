<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import LanguageForm from '$lib/components/wordbook/LanguageForm.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { wordbookAddLanguageBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')
	const createLanguageMutation = createMutation(() => ({
		mutationFn: (formData: Record<string, unknown>) => api<{ slug: string }>('POST', '/api/languages', formData),
	}))

	async function handleSubmit(formData: Record<string, unknown>) {
		const lang = await createLanguageMutation.mutateAsync(formData)
		pushSuccess('Language created')
		goto(`/Wordbook/${lang.slug}`)
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
