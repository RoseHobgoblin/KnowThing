<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto, replaceState } from '$app/navigation'
	import { page } from '$app/stores'
	import { pushSuccess } from '$lib/notifications.svelte'
	import LanguageForm from '$lib/components/wordbook/LanguageForm.svelte'
	import LanguageAdminPanels from '$lib/components/wordbook/LanguageAdminPanels.svelte'
	import DimensionEditor from '$lib/components/wordbook/DimensionEditor.svelte'
	import PhonemeEditor from '$lib/components/phonology/PhonemeEditor.svelte'
	import GraphemeEditor from '$lib/components/phonology/GraphemeEditor.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import TabNavigation from '$lib/components/ui/TabNavigation.svelte'
	import HelpBlock from '$lib/components/ui/HelpBlock.svelte'
	import { wordbookEditLanguageBreadcrumbs } from '$lib/utils/breadcrumbs.js'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')

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
		{ id: 'details', label: 'Details' },
		{ id: 'phonology', label: 'Phonology' },
		{ id: 'orthography', label: 'Orthography' },
		{ id: 'inflections', label: 'Inflections' },
	]

	async function handleDetailsSubmit(formData: Record<string, unknown>) {
		const response = await fetch(`/api/languages/${data.language.slug}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData),
		})
		if (!response.ok) {
			const error = await response.json()
			throw new Error(error.error || 'Failed to update language')
		}
		pushSuccess('Language updated')
		goto(`/Wordbook/${data.language.slug}`)
	}
</script>

<svelte:head>
	<title>Edit {data.language.name} — Wordbook — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={wordbookEditLanguageBreadcrumbs(wbName, data.language)}
	title="Edit: {data.language.name}"
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
			submitLabel="Save Changes"
		/>

		<div class="mt-6">
			<LanguageAdminPanels
				languageSlug={data.language.slug}
				languageName={data.language.name}
				dialects={data.dialects}
				isAdmin={$page.data.isAdmin}
			/>
		</div>
	{:else if activeTab === 'phonology'}
		<div class="space-y-3">
			<HelpBlock title="What is a phoneme?" open>
				<p>A <strong>phoneme</strong> is a meaningful unit of sound in this language — a sound that can change a word's meaning. List one row per distinctive sound.</p>
				<p>Use <strong>IPA</strong> in the symbol column. Mark <strong>marginal</strong> for sounds that only appear in loanwords or rare contexts. <em>Place</em>, <em>manner</em>, and <em>voicing</em> are optional but power the chart layout.</p>
			</HelpBlock>
			<PhonemeEditor
				languageSlug={data.language.slug}
				initial={data.phonemes}
			/>
		</div>
	{:else if activeTab === 'orthography'}
		<div class="space-y-3">
			<HelpBlock title="What is a grapheme?" open>
				<p>A <strong>grapheme</strong> is a written symbol or letter cluster. List the script units that represent the language's phonemes.</p>
				<p><em>Romanization</em> is the Latin-alphabet rendering used in transliteration. <em>Environment</em> describes when this grapheme is used (e.g. "word-initial", "before front vowels"). Link each grapheme to the phoneme(s) it represents.</p>
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
