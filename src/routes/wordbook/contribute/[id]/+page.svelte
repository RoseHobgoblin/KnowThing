<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto, replaceState } from '$app/navigation'
	import { page } from '$app/stores'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { pushSuccess } from '$lib/notifications.svelte'
	import EntryForm from '$lib/components/wordbook/EntryForm.svelte'
	import InflectionEditor from '$lib/components/wordbook/InflectionEditor.svelte'
	import InflectionTable from '$lib/components/wordbook/InflectionTable.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import TabNavigation from '$lib/components/ui/TabNavigation.svelte'
	import { wordbookEditBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { m } from '$lib/paraglide/messages.js'

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
		data.availableClasses.length > 0 || data.inflection.dimensions.length > 0,
	)

	function onNavigationChange(id: string) {
		activeTab = id
		const url = new URL($page.url)
		if (id === 'entry') url.searchParams.delete('tab')
		else url.searchParams.set('tab', id)
		replaceState(url, $page.state)
	}

	const navItems = $derived([
		{ id: 'entry', label: m.wb_tab_entry() },
		{ id: 'inflection', label: m.wb_tab_inflection(), shouldShow: () => hasInflectionSystem },
	])

	const firstPos = $derived(data.definitions[0]?.partOfSpeech || '')
	const languageSlug = $derived(
		data.languages.find(l => l.id === data.entry.languageId)?.slug ?? '',
	)
	const updateMutation = createMutation(() => ({
		mutationFn: ({ resource, body }: { resource: 'entry' | 'definitions', body: unknown }) =>
			api('PUT', `/api/wordbook/${data.entry.id}${resource === 'definitions' ? '/definitions' : ''}`, body),
	}))

	async function handleSubmit(formData: Record<string, unknown>) {
		await updateMutation.mutateAsync({ resource: 'entry', body: {
			word: formData.word,
			languageId: formData.languageId,
			pronunciation: formData.pronunciation,
			etymology: formData.etymology,
			notes: formData.notes,
			pageSlug: formData.pageSlug,
			tags: formData.tags,
		},
		})

		const defs = formData.defs as Array<{ partOfSpeech?: string, definition: string, usageExample?: string, usageTranslation?: string }>
		if (defs && defs.length > 0) {
			await updateMutation.mutateAsync({ resource: 'definitions', body: { defs } })
		}

		pushSuccess(m.wb_word_updated())
		const lang = data.languages.find(l => l.id === formData.languageId)
		// Awaited so EntryForm stays in its submitting state — and its unsaved-changes
		// guard stays disarmed — until the navigation away has completed.
		if (lang) {
			await goto(`/Wordbook/${lang.slug}/${encodeURIComponent(String(formData.word))}`)
		} else {
			await goto('/Wordbook')
		}
	}
</script>

<svelte:head>
	<title>Edit "{data.entry.word}" — Wordbook — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={wordbookEditBreadcrumbs(wbName, data.entry.word)}
	title={m.wb_edit_colon({ name: data.entry.word })}
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
			relationsManagedAt={languageSlug
				? `/Wordbook/${languageSlug}/${encodeURIComponent(data.entry.word)}`
				: '/Wordbook'}
			onsubmit={handleSubmit}
			submitLabel={m.wb_save_changes()}
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
