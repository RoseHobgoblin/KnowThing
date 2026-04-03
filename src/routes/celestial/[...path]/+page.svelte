<script lang="ts">
	import { untrack } from 'svelte'
	import type { ActionData, PageData } from './$types.js'
	import { enhance } from '$app/forms'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import InfoboxStar from '$lib/infoboxes/InfoboxStar.svelte'
	import InfoboxPlanet from '$lib/infoboxes/InfoboxPlanet.svelte'
	import SystemMap from '$lib/celestial/SystemMap.svelte'
	import MapControls from '$lib/celestial/MapControls.svelte'
	import SystemSidebar from '$lib/celestial/SystemSidebar.svelte'
	import { DEFAULT_MAP_SETTINGS } from '$lib/celestial/map-settings.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import CelestialConfigureStar from '$lib/components/celestial/CelestialConfigureStar.svelte'
	import CelestialConfigureBody from '$lib/components/celestial/CelestialConfigureBody.svelte'
	import { celestialPathBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon'
	import GearSixIcon from 'phosphor-svelte/lib/GearSixIcon'
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'

	let { data, form }: { data: PageData, form: ActionData } = $props()

	const initialWikiContent = untrack(() => data.wikiContent ?? '')
	const kind = $derived(data.kind)
	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)
	const isEditMode = $derived(data.isEditMode)
	const isConfigureMode = $derived(data.isConfigureMode)
	const raw = $derived(data.body as any)
	const ast = $derived(data.ast as import('$lib/parser/types.js').WikiNode | null)

	const layoutData = $derived($page.data)

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})

	createKnowContext({
		resolvedLinks: new Map(Object.entries(data.resolvedLinks ?? {})),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/celestial',
		calendarDate: layoutData.calendarDate ?? null,
	})

	// System map state
	let currentAbsoluteDay = $state(Math.floor(Date.now() / 86_400_000))
	let mapScale = $state(DEFAULT_MAP_SETTINGS.scale)
	let mapLabels = $state(DEFAULT_MAP_SETTINGS.labels)
	let mapTrails = $state(DEFAULT_MAP_SETTINGS.trails)
	let mapFollow = $state(DEFAULT_MAP_SETTINGS.follow)
	let mapSelectedId = $state<string | null>(null)

	// Resolve selected body for sidebar detail
	const selectedBody = $derived.by(() => {
		if (mapSelectedId == null) return null
		const [kind, rawId] = mapSelectedId.split(':')
		const numericId = Number(rawId)
		if (kind === 'star') return (data.systemStars ?? []).find(b => b.id === numericId) ?? null
		if (kind === 'body') return (data.systemBodies ?? []).find(b => b.id === numericId) ?? null
		return null
	})

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
						<GearSixIcon size={14} weight="fill" />Configure
					</a>
				{/if}
				{#if permissions.canEditContent}
					<a href={editPath} class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover">
						<PencilSimpleIcon size={14} weight="fill" />Edit
					</a>
				{/if}
			{:else if permissions.isAuthenticated}
				<span class="text-faint text-sm">View only. Editor role required for celestial changes.</span>
			{/if}
		{/snippet}
			{#if kind === 'system'}
				<!-- System: two-column layout -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
					<!-- Map + Controls -->
					<div class="max-w-2xl mx-auto border border-border-subtle overflow-hidden">
						{#if data.systemStars && data.systemStars.length > 0}
							<MapControls
								bind:scale={mapScale}
								bind:labels={mapLabels}
								bind:trails={mapTrails}
								bind:follow={mapFollow}
								hasSelection={mapSelectedId != null}
							/>
							<SystemMap
								systemName={raw.name}
								stars={data.systemStars}
								bodies={data.systemBodies ?? []}
								{currentAbsoluteDay}
								scale={mapScale}
								labels={mapLabels}
								trails={mapTrails}
								follow={mapFollow}
								bind:selectedId={mapSelectedId}
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
							{selectedBody}
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
							{selectedBody}
						/>
					</div>
				</div>

				<!-- Prose below the two-column section -->
				{#if strippedAst}
					<section class="space-y-3 mt-4">
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
