<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto, replaceState } from '$app/navigation'
	import { page } from '$app/stores'
	import { pushSuccess } from '$lib/notifications.svelte'
	import EntryForm from '$lib/components/wordbook/EntryForm.svelte'
	import InflectionEditor from '$lib/components/wordbook/InflectionEditor.svelte'
	import InflectionTable from '$lib/components/wordbook/InflectionTable.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import TabNavigation from '$lib/components/ui/TabNavigation.svelte'
	import { wordbookEditBreadcrumbs } from '$lib/utils/breadcrumbs.js'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')

	const validTabs = ['entry', 'inflection'] as const
	type Tab = typeof validTabs[number]

	function tabFromUrl(): Tab {
		const t = $page.url.searchParams.get('tab')
		return validTabs.includes(t as Tab) ? (t as Tab) : 'entry'
	}

	let activeTab = $state<string>(tabFromUrl())

	const hasInflectionSystem = $derived(
		data.availableClasses.length > 0 || data.inflection.dimensions.length > 0
	)

	function onNavigationChange(id: string) {
		activeTab = id
		const url = new URL($page.url)
		if (id === 'entry') url.searchParams.delete('tab')
		else url.searchParams.set('tab', id)
		replaceState(url, $page.state)
	}

	const navItems = $derived([
		{ id: 'entry', label: 'Entry' },
		{ id: 'inflection', label: 'Inflection', shouldShow: () => hasInflectionSystem },
	])

	const firstPos = $derived(data.definitions[0]?.partOfSpeech || '')
	const languageSlug = $derived(
		data.languages.find(l => l.id === data.entry.languageId)?.slug ?? ''
	)

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
	{#if hasInflectionSystem}
		<div class="mb-4">
			<TabNavigation
				{navItems}
				bind:activeSectionId={activeTab}
				{onNavigationChange}
			/>
		</div>
	{/if}

	{#if activeTab === 'entry' || !hasInflectionSystem}
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
	{:else if activeTab === 'inflection'}
		<div class="space-y-3">
			<InflectionTable
				dimensions={data.inflection.dimensions}
				forms={data.inflection.forms}
				overrides={data.inflection.overrides}
				className={data.inflection.className}
				stem={data.inflection.stem}
				hasInflection={data.inflection.hasInflection}
			/>
			<InflectionEditor
				entryId={data.entry.id}
				word={data.entry.word}
				{languageSlug}
				partOfSpeech={firstPos}
				inflection={data.inflection}
				availableClasses={data.availableClasses}
			/>
		</div>
	{/if}
</ArticleShell>
