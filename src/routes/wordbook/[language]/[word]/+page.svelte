<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import { invalidateAll } from '$app/navigation'
	import { goto } from '$app/navigation'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import LanguageBadge from '$lib/components/wordbook/LanguageBadge.svelte'
	import TagPill from '$lib/components/wordbook/TagPill.svelte'
	import EtymologySection from '$lib/components/wordbook/EtymologySection.svelte'
	import VariantManager from '$lib/components/wordbook/VariantManager.svelte'
	import InflectionTable from '$lib/components/wordbook/InflectionTable.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Badge from '$lib/components/ui/Badge.svelte'
	import { PARTS_OF_SPEECH, POS_COLORS } from '$lib/components/wordbook/constants.js'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
	import Trash from 'phosphor-svelte/lib/Trash'
	import { wordbookWordBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { cn } from '$lib/utils'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const layoutData = $derived($page.data)

	createKnowContext({
		resolvedLinks: new Map(Object.entries(data.resolvedLinks ?? {})),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/Wordbook',
		sourceDomain: 'wordbook',
		calendarDate: layoutData.calendarDate ?? null,
		structuredCollections: data.structuredCollections ?? null,
	})
	const permissions = $derived(layoutData.permissions)
	const isAuthenticated = $derived(permissions.isAuthenticated)
	const canManageWordbook = $derived(permissions.canManageWordbook)
	const isAdmin = $derived(layoutData.isAdmin)
	const wbName = $derived(layoutData.siteConfig?.wordbookName ?? 'Wordbook')
	const siteName = $derived(layoutData.siteConfig?.siteName ?? 'KnowThing')

	// Add sense form state
	let addingSenseFor = $state<number | null>(null)
	let newPos = $state('')
	let newDefinition = $state('')
	let newUsage = $state('')
	let newTranslation = $state('')
	let senseError = $state('')
	const definitionMutation = createMutation(() => ({
		mutationFn: ({ method, entryId, definitionId, body }: {
			method: 'POST' | 'DELETE'
			entryId: number
			definitionId?: number
			body?: unknown
		}) => api(method, `/api/wordbook/${entryId}/definitions${definitionId ? `/${definitionId}` : ''}`, body),
	}))
	const deleteEntryMutation = createMutation(() => ({
		mutationFn: (entryId: number) => api('DELETE', `/api/wordbook/${entryId}`),
	}))

	async function addSense(entryId: number, event: Event) {
		event.preventDefault()
		if (!newDefinition.trim()) return
		senseError = ''
		try {
			await definitionMutation.mutateAsync({ method: 'POST', entryId, body: {
				partOfSpeech: newPos || null,
				definition: newDefinition.trim(),
				usageExample: newUsage.trim() || null,
				usageTranslation: newTranslation.trim() || null,
			},
			})
			pushSuccess('Definition added')
			newPos = ''
			newDefinition = ''
			newUsage = ''
			newTranslation = ''
			addingSenseFor = null
			await invalidateAll()
		} catch (error) {
			senseError = error instanceof Error ? error.message : 'Failed to add definition'
			pushError(senseError)
		}
	}

	async function deleteSense(entryId: number, definitionId: number) {
		const ok = await confirmDialog.confirm('Delete definition', 'Delete this definition?', 'Delete', 'Cancel')
		if (!ok) return
		try {
			await definitionMutation.mutateAsync({ method: 'DELETE', entryId, definitionId })
			pushSuccess('Definition deleted')
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Failed to delete definition')
		}
	}

	async function deleteEntry(entryId: number) {
		const ok = await confirmDialog.confirm('Delete word', `Delete "${data.word}"? This cannot be undone.`, 'Delete', 'Cancel')
		if (!ok) return
		try {
			await deleteEntryMutation.mutateAsync(entryId)
			pushSuccess(`"${data.word}" deleted`)
			goto(`/Wordbook/${data.language.slug}`)
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Failed to delete word')
		}
	}

	const posColors = POS_COLORS

	const firstDefinition = $derived(data.homographs[0]?.definitions[0]?.definition ?? '')
	const ogDescription = $derived(firstDefinition ? `${data.word} — ${firstDefinition}` : `${data.word} in ${data.language.name}`)
</script>

<svelte:head>
	<title>{data.word} ({data.language.name}) — {wbName} — {siteName}</title>
	<meta name="description" content={ogDescription} />
	<meta property="og:title" content="{data.word} ({data.language.name}) — {wbName} — {siteName}" />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content={$page.url.href} />
	<meta property="og:site_name" content={siteName} />
</svelte:head>

<ArticleShell
	breadcrumbs={wordbookWordBreadcrumbs(wbName, data.language, data.word)}
	title={data.word}
>
	{#snippet actions()}
		{#if canManageWordbook && data.homographs[0]}
			<a href="/Wordbook/contribute/{data.homographs[0].entry.id}" class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover"><PencilSimple size={14} weight="fill" />Edit</a>
			{#if isAdmin}
				<button onclick={() => deleteEntry(data.homographs[0].entry.id)} class="text-error transition-colors flex items-center gap-1 hover:text-error-hover"><Trash size={14} weight="fill" />Delete</button>
			{/if}
		{:else if isAuthenticated}
			<span class="text-secondary text-sm">View only. Editor role required for wordbook changes.</span>
		{/if}
	{/snippet}

	{#snippet badges()}
		<div class="flex items-center gap-2 mt-1">
			<LanguageBadge name={data.language.name} slug={data.language.slug} color={data.language.color} />
		</div>
	{/snippet}

	{#each data.homographs as hom, homIndex (hom.entry.id)}
		{@const entry = hom.entry}
		{@const defs = hom.definitions}
		{@const variants = hom.variants}
		{@const relations = hom.relations}

		<div class={cn('grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]', homIndex > 0 && 'mt-6')}>
			<div class="space-y-4">
				<!-- Headword card -->
				<div class="bg-surface overflow-hidden">
			<div class="p-4">
				{#if data.isMultipleHomographs}
					<h2 class="text-lg font-bold text-heading mb-2">
						{data.word}<sup class="text-sm text-secondary ml-0.5">{entry.homographNumber}</sup>
					</h2>
				{/if}

				<!-- Entry details -->
				{#if entry.pronunciation || relations.direct || relations.cognates?.length || relations.etymologyChain?.length || entry.etymology}
					<div class="mb-3 space-y-2 border-b border-border-subtle pb-3">
						{#if entry.pronunciation}
							<div class="flex items-baseline gap-4 text-sm">
								<span class="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-secondary">Pronounced</span>
								<span class="font-mono text-body">{entry.pronunciation}</span>
							</div>
						{/if}
						{#if relations.direct || relations.cognates?.length || relations.etymologyChain?.length || entry.etymology}
							<div class="flex items-start gap-4">
								<span class="w-20 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wider text-secondary">Etymology</span>
								<div class="min-w-0 flex-1">
									<EtymologySection
										entryId={entry.id}
										direct={relations.direct}
										cognates={relations.cognates}
										etymologyChain={relations.etymologyChain}
										narrativeEtymology={entry.etymology || ''}
										canEdit={canManageWordbook}
										compact
									/>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Definitions -->
				<div class="divide-y divide-border-subtle">
					{#each defs as definition, index (definition.id)}
						<div class="py-3 group first:pt-0">
							<div class="flex items-baseline gap-2 mb-1">
								{#if defs.length > 1}
									<span class="text-xs font-bold text-secondary">{index + 1}.</span>
								{/if}
								{#if definition.partOfSpeech}
									<Badge class={posColors[definition.partOfSpeech.toLowerCase()] || ''}>{definition.partOfSpeech}</Badge>
								{/if}
								{#if canManageWordbook && defs.length > 1}
									<button onclick={() => deleteSense(entry.id, definition.id)} class="text-error text-xs opacity-0 transition-opacity ml-auto hover:text-error-hover group-hover:opacity-100">×</button>
								{/if}
							</div>
							<p class="text-body"><InlineMarkup text={definition.definition} /></p>
							{#if definition.usageExample}
								<div class="mt-2 pl-3 border-l-2 border-border-subtle">
									<p class="text-sm italic text-secondary">{definition.usageExample}</p>
									{#if definition.usageTranslation}
										<p class="text-sm text-dim mt-0.5">{definition.usageTranslation}</p>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Add sense -->
				{#if canManageWordbook}
					{#if addingSenseFor === entry.id}
						<form onsubmit={event => addSense(entry.id, event)} class="mt-3 p-3 bg-page space-y-2">
							{#if senseError}
								<div class="p-2 bg-error-bg border border-error-border text-error text-xs">{senseError}</div>
							{/if}
							<div class="flex gap-2">
								<Select
									type="single"
									bind:value={newPos}
									placeholder="Part of speech"
									size="sm"
									items={PARTS_OF_SPEECH.map(pos => ({ value: pos, label: pos }))}
								/>
								<Input bind:value={newDefinition} placeholder="Definition..." required containerClass="flex-1" />
							</div>
							<div class="flex gap-2">
								<Input bind:value={newUsage} placeholder="Usage example" containerClass="flex-1" />
								<Input bind:value={newTranslation} placeholder="Translation" containerClass="flex-1" />
							</div>
							<div class="flex gap-2">
								<button type="submit" disabled={definitionMutation.isPending} class="px-3 py-1.5 bg-accent text-surface text-sm hover:bg-accent-hover disabled:opacity-50">Add</button>
								<button type="button" onclick={() => addingSenseFor = null} class="text-xs text-secondary hover:text-body">Cancel</button>
							</div>
						</form>
					{:else}
						<button onclick={() => addingSenseFor = entry.id} class="mt-3 text-sm text-link hover:text-link-hover hover:underline">+ Add definition</button>
					{/if}
				{/if}

				<!-- Tags -->
				{#if entry.tags && entry.tags.length > 0}
					<div class="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border-subtle">
						{#each entry.tags as tag (tag)}
							<TagPill {tag} language={data.language.slug} />
						{/each}
					</div>
				{/if}

				<!-- Entry wiki body — was fetched-but-never-rendered before -->
				{#if hom.bodyAst}
					<article class="know-article mt-4 pt-3 border-t border-border-subtle">
						<WikiNodeComponent node={hom.bodyAst} />
					</article>
				{/if}

				<!-- "See full article" link if a Know article exists -->
				{#if entry.pageSlug}
					<div class="mt-3 pt-3 border-t border-border-subtle">
						<a href="/know/{entry.pageSlug}" class="text-sm text-link hover:text-link-hover hover:underline">
							Read the full article →
						</a>
					</div>
				{/if}
			</div>
		</div>

		{#if hom.inflection.hasInflection || (canManageWordbook && data.availableClasses.length > 0)}
			<section class="bg-surface p-4">
				<InflectionTable
					dimensions={hom.inflection.dimensions}
					forms={hom.inflection.forms}
					overrides={hom.inflection.overrides}
					className={hom.inflection.className}
					stem={hom.inflection.stem}
					hasInflection={hom.inflection.hasInflection}
				/>
				{#if canManageWordbook && (hom.inflection.dimensions.length > 0 || data.availableClasses.length > 0)}
					<a href="/Wordbook/contribute/{entry.id}?tab=inflection" class="mt-2 inline-block text-xs text-link hover:text-link-hover hover:underline">
						{hom.inflection.hasInflection ? 'Edit inflection' : '+ Set up inflection'}
					</a>
				{/if}
			</section>
		{/if}

			</div>

			<aside class="space-y-3">
				{#if variants.length > 0 || canManageWordbook}
					<section class="bg-surface p-3">
						<h2 class="mb-2 text-[0.625rem] font-semibold uppercase tracking-wider text-secondary">Dialect variants</h2>
						<VariantManager
							entryId={entry.id}
							languageSlug={data.language.slug}
							{variants}
							canEdit={canManageWordbook}
						/>
					</section>
				{/if}

				{#if entry.pageSlug}
					<section class="bg-surface p-3">
						<h2 class="mb-2 text-[0.625rem] font-semibold uppercase tracking-wider text-secondary">Linked article</h2>
						<a href="/know/{entry.pageSlug}" class="text-xs text-link hover:text-link-hover hover:underline">Read the full article →</a>
					</section>
				{/if}
			</aside>
		</div>
	{/each}
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
