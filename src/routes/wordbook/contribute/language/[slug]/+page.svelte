<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import LanguageForm from '$lib/components/wordbook/LanguageForm.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { wordbookEditLanguageBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')

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

<ArticleShell
	breadcrumbs={wordbookEditLanguageBreadcrumbs(wbName, data.language)}
	title="Edit: {data.language.name}"
>
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
</ArticleShell>
