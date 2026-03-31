<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { pushSuccess } from '$lib/notifications.svelte'
	import EntryForm from '$lib/components/wordbook/EntryForm.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { wordbookEditBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')

	async function handleSubmit(formData: Record<string, unknown>) {
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

		pushSuccess('Word updated')
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

<ArticleShell
	breadcrumbs={wordbookEditBreadcrumbs(wbName, data.entry.word)}
	title="Edit: {data.entry.word}"
>
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
</ArticleShell>
