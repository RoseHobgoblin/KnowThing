<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto, replaceState } from '$app/navigation'
	import { page } from '$app/stores'
	import { pushSuccess } from '$lib/notifications.svelte'
	import LanguageForm from '$lib/feature/wordbook/components/LanguageForm.svelte'
	import LanguageAdminPanels from '$lib/feature/wordbook/components/LanguageAdminPanels.svelte'
	import DimensionEditor from '$lib/feature/wordbook/components/DimensionEditor.svelte'
	import PhonemeEditor from '$lib/feature/wordbook/components/PhonemeEditor.svelte'
	import GraphemeEditor from '$lib/feature/wordbook/components/GraphemeEditor.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import TabNavigation from '$lib/components/ui/TabNavigation.svelte'
	import HelpBlock from '$lib/components/ui/HelpBlock.svelte'
	import { wordbookEditLanguageBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')
	const updateMutation = createMutation(() => ({
		mutationFn: (formData: Record<string, unknown>) =>
			api('PUT', `/api/languages/${data.language.slug}`, formData),
	}))

	const validTabs = ['details', 'phonology', 'orthography', 'inflections'] as const
	type Tab = typeof validTabs[number]

	function tabFromUrl(): Tab {
		const t = $page.url.searchParams.get('tab')
		return validTabs.includes(t as Tab) ? (t as Tab) : 'details'
	}

	let activeTab = $state<string>(tabFromUrl())

	function onNavigationChange(id: string) {
		activeTab = id
		const url = new URL($page.url)
		if (id === 'details') url.searchParams.delete('tab')
		else url.searchParams.set('tab', id)
		replaceState(url, $page.state)
	}

	const navItems = [
		{ id: 'details', label: m.wb_tab_details() },
		{ id: 'phonology', label: m.wb_tab_phonology() },
		{ id: 'orthography', label: m.wb_tab_orthography() },
		{ id: 'inflections', label: m.wb_tab_inflections() },
	]

	// Deleting the language happens in LanguageAdminPanels, a sibling of the edit form
	// that owns the guard — so the signal has to travel up here and back down.
	let languageDeleted = $state(false)

	async function handleDetailsSubmit(formData: Record<string, unknown>) {
		await updateMutation.mutateAsync(formData)
		pushSuccess(m.wb_language_updated())
		// Awaited so LanguageForm stays in its submitting state — and its unsaved-changes
		// guard stays disarmed — until the navigation away has completed.
		await goto(`/Wordbook/${data.language.slug}`)
	}
</script>

<svelte:head>
	<title>Edit {data.language.name} — Wordbook — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={wordbookEditLanguageBreadcrumbs(wbName, data.language)}
	title={m.wb_edit_colon({ name: data.language.name })}
>
	<div class="mb-4">
		<TabNavigation
			{navItems}
			bind:activeSectionId={activeTab}
			{onNavigationChange}
		/>
	</div>

	{#if activeTab === 'details'}
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
			onsubmit={handleDetailsSubmit}
			submitLabel={m.wb_save_changes()}
			recordGone={languageDeleted}
		/>

		<div class="mt-6">
			<LanguageAdminPanels
				languageSlug={data.language.slug}
				languageName={data.language.name}
				dialects={data.dialects}
				isAdmin={$page.data.isAdmin}
				ondeleted={() => (languageDeleted = true)}
			/>
		</div>
	{:else if activeTab === 'phonology'}
		<div class="space-y-3">
			<HelpBlock title={m.wb_what_is_phoneme()} open>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
				<p>{@html m.wb_phoneme_explain_1()}</p>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
				<p>{@html m.wb_phoneme_explain_2()}</p>
			</HelpBlock>
			<PhonemeEditor
				languageSlug={data.language.slug}
				initial={data.phonemes}
			/>
		</div>
	{:else if activeTab === 'orthography'}
		<div class="space-y-3">
			<HelpBlock title={m.wb_what_is_grapheme()} open>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
				<p>{@html m.wb_grapheme_explain_1()}</p>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
				<p>{@html m.wb_grapheme_explain_2()}</p>
			</HelpBlock>
			<GraphemeEditor
				languageSlug={data.language.slug}
				initial={data.graphemes}
				phonemeInventory={data.phonemeSummary}
			/>
		</div>
	{:else if activeTab === 'inflections'}
		<DimensionEditor
			languageSlug={data.language.slug}
			dimensions={data.inflectionDimensions}
			classes={data.paradigmClasses}
			ruleCounts={data.paradigmRuleCounts}
		/>
	{/if}
</ArticleShell>
