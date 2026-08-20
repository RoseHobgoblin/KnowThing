<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import { invalidateAll } from '$app/navigation'
	import { goto } from '$app/navigation'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import LanguageBadge from '$lib/feature/wordbook/components/LanguageBadge.svelte'
	import TagPill from '$lib/feature/wordbook/components/TagPill.svelte'
	import EtymologySection from '$lib/feature/wordbook/components/EtymologySection.svelte'
	import VariantManager from '$lib/feature/wordbook/components/VariantManager.svelte'
	import InflectionTable from '$lib/feature/wordbook/components/InflectionTable.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Badge from '$lib/components/ui/Badge.svelte'
	import { PARTS_OF_SPEECH, POS_COLORS } from '$lib/feature/wordbook/components/constants.js'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import { untrack } from 'svelte'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
	import Trash from 'phosphor-svelte/lib/Trash'
	import { wordbookWordBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { cn } from '$lib/utils'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const layoutData = $derived($page.data)

	// setContext runs once at init — reading current data/store values here is
	// intentional, so untrack to silence the state_referenced_locally warning.
	untrack(() =>
		createKnowContext({
			resolvedLinks: new Map(Object.entries(data.resolvedLinks ?? {})),
			mediaBaseUrl: '/api/media',
			pageBaseUrl: '/Wordbook',
			sourceDomain: 'wordbook',
			calendarDate: layoutData.calendarDate ?? null,
			structuredCollections: data.structuredCollections ?? null,
		}),
	)
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
			pushSuccess(m.wb_definition_added())
			newPos = ''
			newDefinition = ''
			newUsage = ''
			newTranslation = ''
			addingSenseFor = null
			await invalidateAll()
		} catch (error) {
			senseError = error instanceof Error ? error.message : m.wb_failed_add_definition()
			pushError(senseError)
		}
	}

	async function deleteSense(entryId: number, definitionId: number) {
		const ok = await confirmDialog.confirm(m.wb_delete_definition(), m.wb_delete_definition_confirm(), m.common_delete(), m.common_cancel())
		if (!ok) return
		try {
			await definitionMutation.mutateAsync({ method: 'DELETE', entryId, definitionId })
			pushSuccess(m.wb_definition_deleted())
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wb_failed_delete_definition())
		}
	}

	async function deleteEntry(entryId: number) {
		const ok = await confirmDialog.confirm(m.wb_delete_word(), m.common_delete_confirm_named({ name: data.word }), m.common_delete(), m.common_cancel())
		if (!ok) return
		try {
			await deleteEntryMutation.mutateAsync(entryId)
			pushSuccess(m.wb_word_deleted({ name: data.word }))
			goto(`/Wordbook/${data.language.slug}`)
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wb_failed_delete_word())
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
			<a href="/Wordbook/contribute/{data.homographs[0].entry.id}" class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover"><PencilSimple size={14} weight="fill" />{m.common_edit()}</a>
			{#if isAdmin}
				<button onclick={() => deleteEntry(data.homographs[0].entry.id)} class="text-error transition-colors flex items-center gap-1 hover:text-error-hover"><Trash size={14} weight="fill" />{m.common_delete()}</button>
			{/if}
		{:else if isAuthenticated}
			<span class="text-secondary text-sm">{m.common_view_only_editor()}</span>
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
								<span class="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-secondary">{m.wb_pronounced()}</span>
								<span class="font-mono text-body">{entry.pronunciation}</span>
							</div>
						{/if}
						{#if relations.direct || relations.cognates?.length || relations.etymologyChain?.length || entry.etymology}
							<div class="flex items-start gap-4">
								<span class="w-20 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wider text-secondary">{m.wb_etymology()}</span>
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
									placeholder={m.wb_part_of_speech()}
									size="sm"
									items={PARTS_OF_SPEECH.map(pos => ({ value: pos, label: pos }))}
								/>
								<Input bind:value={newDefinition} placeholder={m.wb_definition_placeholder()} required containerClass="flex-1" />
							</div>
							<div class="flex gap-2">
								<Input bind:value={newUsage} placeholder={m.wb_usage_example()} containerClass="flex-1" />
								<Input bind:value={newTranslation} placeholder={m.wb_translation()} containerClass="flex-1" />
							</div>
							<div class="flex gap-2">
								<button type="submit" disabled={definitionMutation.isPending} class="px-3 py-1.5 bg-accent text-surface text-sm hover:bg-accent-hover disabled:opacity-50">{m.common_add()}</button>
								<button type="button" onclick={() => addingSenseFor = null} class="text-xs text-secondary hover:text-body">{m.common_cancel()}</button>
							</div>
						</form>
					{:else}
						<button onclick={() => addingSenseFor = entry.id} class="mt-3 text-sm text-link hover:text-link-hover hover:underline">+ {m.wb_add_definition()}</button>
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
							{m.wb_read_full_article()} →
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
						{hom.inflection.hasInflection ? m.wb_edit_inflection() : `+ ${m.wb_set_up_inflection()}`}
					</a>
				{/if}
			</section>
		{/if}

			</div>

			<aside class="space-y-3">
				{#if variants.length > 0 || canManageWordbook}
					<section class="bg-surface p-3">
						<h2 class="mb-2 text-[0.625rem] font-semibold uppercase tracking-wider text-secondary">{m.wb_dialect_variants()}</h2>
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
						<h2 class="mb-2 text-[0.625rem] font-semibold uppercase tracking-wider text-secondary">{m.wb_linked_article()}</h2>
						<a href="/know/{entry.pageSlug}" class="text-xs text-link hover:text-link-hover hover:underline">{m.wb_read_full_article()} →</a>
					</section>
				{/if}
			</aside>
		</div>
	{/each}
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
