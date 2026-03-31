<script lang="ts">
	import { untrack } from 'svelte'
	import type { ActionData, PageData } from './$types.js'
	import { enhance } from '$app/forms'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import { page } from '$app/stores'
	import InfoboxStar from '$lib/infoboxes/InfoboxStar.svelte'
	import InfoboxPlanet from '$lib/infoboxes/InfoboxPlanet.svelte'
	import InfoboxSystem from '$lib/infoboxes/InfoboxSystem.svelte'
	import SystemMap from '$lib/celestial/SystemMap.svelte'
	import SystemSidebar from '$lib/celestial/SystemSidebar.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import CelestialConfigureStar from '$lib/components/celestial/CelestialConfigureStar.svelte'
	import CelestialConfigureBody from '$lib/components/celestial/CelestialConfigureBody.svelte'
	import { celestialPathBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
	import GearSix from 'phosphor-svelte/lib/GearSix'
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import RecordModeBanner from '$lib/components/editor/RecordModeBanner.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'

	let { data, form }: { data: PageData, form: ActionData } = $props()

	const initialWikiContent = untrack(() => data.wikiContent ?? '')
	const kind = $derived(data.kind)
	const permissions = $derived($page.data.permissions)
	const isEditMode = $derived(data.isEditMode)
	const isConfigureMode = $derived(data.isConfigureMode)
	const raw = $derived(data.body as any)
	const ast = $derived(data.ast as import('$lib/parser/types.js').WikiNode | null)

	const layoutData = $derived($page.data)

	createKnowContext({
		existingPages: new Set(layoutData.existingPages || []),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: layoutData.calendarDate ?? null,
	})

	// System map time state — default to "now" via primary calendar
	let currentAbsoluteDay = $state(Math.floor(Date.now() / 86_400_000))

	// Build calendar configs for the date scrubber
	const systemCalendarConfigs = $derived.by(() => {
		if (!data.systemCalendars) return []
		return (data.systemCalendars as any[]).map((c: any) => ({
			id: c.id,
			name: c.name,
			description: '',
			primary: false,
			static_data: {
				first_week_day: 0, weekdays: [], months: [], leap_days: [],
				moons: [], eras: [], seasons: [], display_moons: false,
				year_offset: 0, epoch_offset: 0,
				...(c.staticData as Record<string, unknown>),
			},
		}))
	})

	// Edit mode state
	let content = $state(initialWikiContent)
	let showPreview = $state(true)
	let editSummary = $state('')
	let saving = $state(false)

	// Build the current path without /edit or /configure for cancel link
	const viewPath = $derived($page.url.pathname.replace(/\/(edit|configure)$/, ''))
	const editPath = $derived(viewPath + '/edit')
	const configurePath = $derived(viewPath + '/configure')

	// Breadcrumb parents resolved server-side from DB (proper names, not URL slugs)
	const parentCrumbs = $derived(((data as any).parentCrumbs ?? []) as { label: string, href: string }[])

	// Strip infobox templates from the AST — the celestial page renders its own infobox from structured data
	function stripInfoboxes(node: import('$lib/parser/types.js').WikiNode): import('$lib/parser/types.js').WikiNode | null {
		if (node.type === 'template' && node.name.toLowerCase().startsWith('infobox')) return null
		if ('children' in node && Array.isArray(node.children)) {
			const filtered = node.children.map(stripInfoboxes).filter(Boolean) as import('$lib/parser/types.js').WikiNode[]
			return { ...node, children: filtered }
		}
		return node
	}

	const strippedAst = $derived(ast ? stripInfoboxes(ast) : null)

	// Infobox fields from server — resolved via structured-data.ts (same mapper as from=slug)
	const infoboxFields = $derived.by(() =>
		data.infoboxFields
			? new Map(Object.entries(data.infoboxFields))
			: new Map([['name', raw.name ?? '']]),
	)
	const isDirty = $derived(content !== initialWikiContent || editSummary.trim().length > 0)
	const saveError = $derived(form?.error ?? '')

	function resetArticleDraft() {
		content = initialWikiContent
		editSummary = ''
	}
</script>

<svelte:head>
	<title>{isEditMode ? 'Editing ' : ''}{raw.name} — Celestial — KnowThing</title>
</svelte:head>

{#if isConfigureMode && kind === 'star'}
	<CelestialConfigureStar
		star={raw}
		allSystems={(data as any).allSystems ?? []}
		wikiContent={data.wikiContent ?? ''}
		contentRecordId={data.contentRecordId ?? null}
		{parentCrumbs}
	/>
{:else if isConfigureMode && kind === 'planet'}
	<CelestialConfigureBody
		body={raw}
		allStars={(data as any).allStars ?? []}
		siblings={(data as any).siblings ?? []}
		wikiContent={data.wikiContent ?? ''}
		contentRecordId={data.contentRecordId ?? null}
		{parentCrumbs}
	/>
{:else if isEditMode}
	<!-- EDIT MODE -->
	<div>
		<UnsavedChangesGuard when={isDirty && !saving} />
		<form method="POST" use:enhance={() => { saving = true; return async ({ update }) => { saving = false; await update() } }} class="flex flex-col h-[calc(100vh-5rem)]">
			<input type="hidden" name="content" value={content} />
			<input type="hidden" name="contentRecordId" value={data.contentRecordId ?? ''} />
			<input type="hidden" name="summary" value={editSummary} />

			<RecordModeBanner
				modeLabel="Edit Article"
				title="Celestial Article Editor"
				description="Edit reference prose here. Structured celestial properties belong in Configure Record."
			/>

			{#if saveError}
				<div class="px-6 pt-4">
					<FormNotice title="Article changes were not saved" message={saveError} />
				</div>
			{/if}

			<!-- Top bar -->
			<div class="flex items-center justify-between px-6 py-2 bg-surface border-b border-border">
				<h1 class="text-sm font-bold text-secondary truncate">
					Editing: <span class="text-heading">{raw.name}</span>
				</h1>
				<div class="flex items-center gap-2">
					<SaveStatusBadge dirty={isDirty} {saving} error={saveError} />
					<button
						type="button"
						onclick={() => (showPreview = !showPreview)}
						class="px-3 py-1 border border-border text-xs text-secondary hover:bg-raised {showPreview ? 'bg-accent-subtle border-accent-border text-accent' : ''}"
					>
						{showPreview ? 'Hide preview' : 'Show preview'}
					</button>
				</div>
			</div>

			<!-- Editor + Preview -->
			<div class="flex-1 flex flex-col min-h-0 md:flex-row">
				<div class="flex-1 min-h-0 min-w-0 overflow-hidden {showPreview ? 'h-1/2 md:h-auto' : ''}">
					<Editor value={data.wikiContent ?? ''} onchange={v => (content = v)} />
				</div>

				{#if showPreview}
					<div class="w-full h-1/2 border-l border-border bg-surface flex flex-col min-h-0 shrink-0 md:w-[45%] md:max-w-2xl md:h-auto">
						<div class="bg-raised px-6 py-1.5 text-xs font-medium text-faint border-b border-border-subtle uppercase tracking-wide">Preview</div>
						<div class="flex-1 overflow-y-auto px-6 py-4">
							<LivePreview {content} />
						</div>
					</div>
				{/if}
			</div>

			<div class="space-y-3 border-t border-border bg-surface px-6 py-3">
				<input
					type="text"
					bind:value={editSummary}
					placeholder="Edit summary (optional)"
					class="w-full border border-border px-3 py-2 text-sm bg-page text-body focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-border"
				/>
				<StickyActionBar
					dirty={isDirty}
					{saving}
					error={saveError}
					saveType="submit"
					ondiscard={resetArticleDraft}
					cancelHref={viewPath}
				/>
			</div>
		</form>
	</div>
{:else}
	<!-- VIEW MODE -->
	<ArticleShell
		breadcrumbs={celestialPathBreadcrumbs(parentCrumbs, raw.name)}
		title={raw.name}
	>
		{#snippet actions()}
			{#if permissions.canEditContent || permissions.canConfigureCelestial}
				{#if kind !== 'system' && permissions.canConfigureCelestial}
					<a href={configurePath} class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover">
						<GearSix size={14} weight="fill" />Configure
					</a>
				{/if}
				{#if permissions.canEditContent}
					<a href={editPath} class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover">
						<PencilSimple size={14} weight="fill" />Edit
					</a>
				{/if}
			{:else if permissions.isAuthenticated}
				<span class="text-faint text-sm">View only. Editor role required for celestial changes.</span>
			{/if}
		{/snippet}
			<RecordModeBanner
				modeLabel="View Record"
				title="Celestial Detail"
				description={kind === 'system'
					? 'This page shows the system map and linked celestial records. Use Configure or Edit to change structured data or article prose.'
					: 'This page shows structured celestial data alongside article prose. Use Configure for system data and Edit for article content.'}
			>
				{#snippet actions()}
					{#if permissions.canEditContent || permissions.canConfigureCelestial}
						{#if kind !== 'system' && permissions.canConfigureCelestial}
							<a href={configurePath} class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover">
								<GearSix size={14} weight="fill" />Configure Record
							</a>
						{/if}
						{#if permissions.canEditContent}
							<a href={editPath} class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover">
								<PencilSimple size={14} weight="fill" />Edit Article
							</a>
						{/if}
					{/if}
				{/snippet}
			</RecordModeBanner>
			{#if kind === 'system'}
				<!-- System: two-column layout -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
					<!-- Map -->
					<div>
						{#if data.systemStars && data.systemStars.length > 0}
							<SystemMap
								systemName={raw.name}
								stars={data.systemStars}
								bodies={data.systemBodies ?? []}
								{currentAbsoluteDay}
							/>
						{:else}
							<div class="flex items-center justify-center h-64 text-dim border border-border-subtle">
								No stars registered in this system.
							</div>
						{/if}
					</div>

					<!-- Sidebar -->
					<div class="border-l border-border-subtle pl-4 hidden md:block">
						<SystemSidebar
							system={raw}
							stars={data.systemStars ?? []}
							bodies={data.systemBodies ?? []}
							systemSlug={raw.slug}
							calendars={systemCalendarConfigs}
							bind:currentAbsoluteDay
						/>
					</div>

					<!-- Mobile sidebar (no border, below map) -->
					<div class="md:hidden">
						<SystemSidebar
							system={raw}
							stars={data.systemStars ?? []}
							bodies={data.systemBodies ?? []}
							systemSlug={raw.slug}
							calendars={systemCalendarConfigs}
							bind:currentAbsoluteDay
						/>
					</div>
				</div>

				<!-- Prose below the two-column section -->
				{#if strippedAst}
					<section class="space-y-3 mt-4">
						<div>
							<h3 class="text-sm font-semibold text-heading">Article Content</h3>
							<p class="text-xs text-faint">Reference prose and documentation for this system.</p>
						</div>
						<article class="know-article">
							<WikiNodeComponent node={strippedAst} />
						</article>
					</section>
				{:else if !data.wikiContent}
					<div class="border border-border-subtle bg-raised p-4 mt-4">
						<p class="text-dim italic">No article content yet.</p>
					</div>
				{/if}
			{:else}
				<!-- Star/Planet: standard infobox + prose layout -->
				<div class="space-y-4">
					{#if kind === 'star'}
						<InfoboxStar fields={infoboxFields} />
					{:else}
						<InfoboxPlanet fields={infoboxFields} />
					{/if}

					{#if strippedAst}
						<section class="space-y-3">
							<div>
								<h3 class="text-sm font-semibold text-heading">Article Content</h3>
								<p class="text-xs text-faint">Reference prose and documentation for this {kind}.</p>
							</div>
							<article class="know-article">
								<WikiNodeComponent node={strippedAst} />
							</article>
						</section>
					{:else if !data.wikiContent}
						<div class="border border-border-subtle bg-raised p-4">
							<p class="text-dim italic">No article content yet.</p>
						</div>
					{/if}
				</div>
			{/if}
	</ArticleShell>
{/if}
