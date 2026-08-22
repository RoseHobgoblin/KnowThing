<script lang="ts">
	import { untrack, type Component, type Snippet } from 'svelte'
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import { normalizePermissions } from '$lib/permissions.js'
	import RodderStatGrid from '$lib/feature/rodder/public/ui/RodderStatGrid.svelte'
	import RodderFactSheet from '$lib/feature/rodder/public/ui/RodderFactSheet.svelte'
	import RodderContextPanel from '$lib/feature/rodder/public/ui/RodderContextPanel.svelte'
	import RodderBacklinks from '$lib/feature/rodder/public/ui/RodderBacklinks.svelte'
	import RootMap from '$lib/feature/rodder/public/ui/RootMap.svelte'
	import CopyViewLink from '$lib/feature/rodder/public/ui/CopyViewLink.svelte'
	import MapControls from '$lib/feature/rodder/public/ui/MapControls.svelte'
	import RootOverlayPanel from '$lib/feature/rodder/public/ui/RootOverlayPanel.svelte'
	import DateScrubber from '$lib/feature/rodder/public/ui/DateScrubber.svelte'
	import { DEFAULT_MAP_SETTINGS } from '$lib/feature/rodder/public/map-settings.js'
	import {
		RODDER_VIEW_QUERY_PARAM,
		rootViewStateFor,
		type RootCameraState,
		type RootViewState,
	} from '$lib/feature/rodder/public/view-state.js'
	import type { RootSelectionKey } from '$lib/feature/rodder/public/apparent-sky.js'
	import type { MapBody } from '$lib/feature/rodder/public/root-layout.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { SvelteMap } from 'svelte/reactivity'
	import { createKnowContext, slugify, type MediaRenderProps, type ResolvedLink } from '$lib/renderer/context.js'
	import RodderConfigureForm from '$lib/feature/rodder/public/ui/RodderConfigureForm.svelte'
	import { rodderBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import GearSixIcon from 'phosphor-svelte/lib/GearSixIcon'
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank'
	import Info from 'phosphor-svelte/lib/Info'
	import SlidersHorizontal from 'phosphor-svelte/lib/SlidersHorizontal'
	import TreeStructure from 'phosphor-svelte/lib/TreeStructure'
	import XIcon from 'phosphor-svelte/lib/XIcon'
	import type { RodderDetailData } from '$lib/feature/rodder/public/server/detail.server.js'
	import { rodderDownloadRoute } from '../rodder-client.js'
	import { cn } from '$lib/utils.js'

	import type { CalendarConfig } from 'rimecraft'

	let { data, calendarSnippet, mediaRenderer = null }: {
		data: RodderDetailData
		calendarSnippet?: Snippet<[{ config: CalendarConfig, year?: number, monthIndex?: number }]>
		mediaRenderer?: Component<MediaRenderProps> | null
	} = $props()

	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)
	const isConfigureMode = $derived(data.isConfigureMode)
	const raw = $derived(data.body as any)
	const consumerRootMap = $derived(data.document.displays.rootMap)
	const hasRootView = $derived(data.document.capabilities.rootMap)
	const rootStars = $derived((consumerRootMap?.stars ?? []) as unknown as MapBody[])
	const rootBodies = $derived((consumerRootMap?.bodies ?? []) as unknown as MapBody[])
	const apparentSky = $derived(consumerRootMap?.apparentSky ?? null)
	const rootCalendars = $derived(consumerRootMap?.calendars ?? [])
	const rootSectorContext = $derived(data.kind === 'system' || data.kind === 'body' ? data.sectorContext : null)

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})

	// Fact-sheet values linkify a body's relationships as `[[slug|name]]`. Those
	// targets are real, resolved rodder entities — but the renderer paints any
	// wikilink it can't find in `resolvedLinks` as a red (missing) link pointing at
	// `/know/<slug>`. Seed the map from the model so they render live and route to
	// the correct `/Rodder:<slug>` page. A reactive map keeps this correct as the
	// component is reused across client-side navigation between rodder pages.
	function rodderLinkEntries(d: RodderDetailData): [string, ResolvedLink][] {
		const entries: [string, ResolvedLink][] = []
		const add = (ref: { slug: string } | null | undefined) => {
			// Key matches WikiInternalLink's lookup: `${sourceDomain}:${slugify(target).toLowerCase()}`.
			if (ref?.slug) entries.push([`rodder:${slugify(ref.slug).toLowerCase()}`, { href: `/Rodder:${ref.slug}`, exists: true }])
		}
		if (d.kind === 'body' && d.model) {
			add(d.model.satelliteOf)
			add(d.model.star)
			add(d.model.parentBody)
			add(d.model.system)
		} else if (d.kind === 'star' && d.model) {
			add(d.model.companionOf)
			for (const companion of d.model.companions) add(companion)
		}
		return entries
	}

	// Seed synchronously so SSR and the first paint render live links (no red flash),
	// then keep it current across client-side navigation.
	const resolvedLinks = new SvelteMap<string, ResolvedLink>(untrack(() => rodderLinkEntries(data)))

	$effect(() => {
		resolvedLinks.clear()
		for (const [key, value] of rodderLinkEntries(data)) resolvedLinks.set(key, value)
	})

	// Fact-sheet values can include wikilinks; the renderer expects a Know context.
	createKnowContext({
		resolvedLinks,
		pageBaseUrl: '/know',
		sourceDomain: 'rodder',
		calendarDate: $page.data.calendarDate ?? null,
		mediaRenderer: untrack(() => mediaRenderer),
	})

	// Root map state. Seed the in-world day from the first associated calendar's epoch
	// and day length so the map opens on a plausible "now" rather than a raw Unix day.
	function computeInitialDay(): number {
		const cal = hasRootView ? (rootCalendars as any[] | undefined)?.[0] : null
		const sd = cal?.staticData as Record<string, unknown> | undefined
		// Guard against a non-positive/NaN day length (user-editable calendar data):
		// `?? 86_400` only covers null/undefined, so a stored 0 would divide to Infinity.
		const rawDayLength = sd?.day_length_seconds as number | undefined
		const dayLengthSeconds = typeof rawDayLength === 'number' && rawDayLength > 0 ? rawDayLength : 86_400
		const epochOffset = (sd?.epoch_offset as number) ?? 0
		return Math.floor(Date.now() / (dayLengthSeconds * 1000)) + epochOffset
	}
	let currentAbsoluteDay = $state(computeInitialDay())
	let mapScale = $state(DEFAULT_MAP_SETTINGS.scale)
	let mapLabels = $state(DEFAULT_MAP_SETTINGS.labels)
	let mapSkyLabels = $state(DEFAULT_MAP_SETTINGS.skyLabels)
	let mapTrails = $state(DEFAULT_MAP_SETTINGS.trails)
	let mapFollow = $state(DEFAULT_MAP_SETTINGS.follow)
	let mapView = $state(DEFAULT_MAP_SETTINGS.view)
	let mapVisibility = $state(DEFAULT_MAP_SETTINGS.visibility)
	let mapSelectedId = $state<RootSelectionKey | null>(null)
	let mapFocusId = $state<`star:${number}` | `body:${number}` | null>(null)
	let initialCameraState = $state<RootCameraState | null>(null)
	let rootMap = $state<{ getCameraState(): RootCameraState | null } | null>(null)
	type RootOverlay = 'overview' | 'objects' | 'calendar' | 'settings'
	let activeRootOverlay = $state<RootOverlay | null>(null)

	const rootEntityKeys = $derived.by(() => {
		if (!hasRootView) return new Set<`star:${number}` | `body:${number}`>()
		return new Set<`star:${number}` | `body:${number}`>([
			...rootStars.map(star => `star:${star.id}` as const),
			...rootBodies.map(body => `body:${body.id}` as const),
		])
	})
	const rootSelectionKeys = $derived.by(() => new Set<RootSelectionKey>([
		...rootEntityKeys,
		...rootBodies.flatMap(body => body.ringSystems?.map(system => `body:${system.id}` as const) ?? []),
		...(apparentSky?.sources.map(source => source.key) ?? []),
	]))
	const linkedViewState = $derived(hasRootView
		? rootViewStateFor($page.url.searchParams.get(RODDER_VIEW_QUERY_PARAM), raw.slug, {
			selected: rootSelectionKeys,
			focus: rootEntityKeys,
		})
		: null)

	// This component instance is reused across client-side navigation between
	// rodder pages. computeInitialDay() reads `data`, so this effect re-runs
	// when the loaded entity changes — reseeding the map's in-world "now" and
	// clearing a selection carried over from the previous system. The writes are
	// untracked and target state this effect doesn't read, so a user's scrubbing
	// or map selection within a page is never clobbered.
	$effect(() => {
		const state = linkedViewState
		const day = state?.time ?? computeInitialDay()
		untrack(() => {
			currentAbsoluteDay = day
			mapScale = state?.scale ?? DEFAULT_MAP_SETTINGS.scale
			mapLabels = state?.labels ?? DEFAULT_MAP_SETTINGS.labels
			mapSkyLabels = state?.skyLabels ?? DEFAULT_MAP_SETTINGS.skyLabels
			mapTrails = state?.trails ?? DEFAULT_MAP_SETTINGS.trails
			mapFollow = state?.focus != null || (state?.follow ?? DEFAULT_MAP_SETTINGS.follow)
			mapView = state?.mode ?? DEFAULT_MAP_SETTINGS.view
			mapVisibility = state?.visibility ?? DEFAULT_MAP_SETTINGS.visibility
			mapSelectedId = state?.selected ?? null
			mapFocusId = state?.focus ?? null
			initialCameraState = state?.camera ?? null
			activeRootOverlay = null
		})
	})

	function currentViewState(): RootViewState | null {
		if (!hasRootView) return null
		const camera = rootMap?.getCameraState()
		if (!camera) return null
		return {
			version: 1,
			renderer: 'root',
			space: { slug: raw.slug },
			selected: mapSelectedId,
			focus: mapFocusId,
			camera,
			mode: mapView,
			time: Number.isFinite(currentAbsoluteDay) ? currentAbsoluteDay : null,
			labels: mapLabels,
			skyLabels: mapSkyLabels,
			trails: mapTrails,
			visibility: mapVisibility,
			exposure: mapVisibility === 'physical' ? 'fixed' : 'auto',
			scale: mapScale,
			follow: mapFollow,
		}
	}

	const selectedBody = $derived.by(() => {
		if (mapSelectedId == null) return null
		const [k, rawId] = mapSelectedId.split(':')
		const numericId = Number(rawId)
		if (k === 'star') return rootStars.find(b => b.id === numericId) ?? null
		if (k === 'body') return rootBodies.find(b => b.id === numericId) ?? null
		return null
	})
	const selectedSkySource = $derived(
		mapSelectedId?.startsWith('sky-root:')
			? apparentSky?.sources.find(source => source.key === mapSelectedId) ?? null
			: null,
	)
	const selectedOverlayTitle = $derived(selectedSkySource ? 'Sky source' : 'Selected object')

	function toggleRootOverlay(panel: RootOverlay) {
		activeRootOverlay = activeRootOverlay === panel ? null : panel
	}

	function selectRootEntity(key: `star:${number}` | `body:${number}`) {
		mapSelectedId = key
	}

	const rootCalendarConfigs = $derived.by(() => {
		if (!hasRootView) return []
		return (rootCalendars as any[]).filter((c: any) => c.staticData && typeof c.staticData === 'object' && !Array.isArray(c.staticData)).map((c: any) => ({
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


	// The raw row carries only the unified parent edge; the registry reference
	// lists derive the legacy-shaped fields (systemId/parentStarId for stars,
	// starId/body-parentId for bodies) for every entity — including this one.
	const starSelfRef = $derived.by(() =>
		data.kind === 'star' ? ((data.allStars ?? []) as any[]).find(s => s.id === raw.id) ?? null : null,
	)
	const bodySelfRef = $derived.by(() =>
		data.kind === 'body' ? ((data.siblings ?? []) as any[]).find(b => b.id === raw.id) ?? null : null,
	)

	// A moon (planet-kind body whose parent is another body) orbits its parent,
	// not the star.
	const isSatellite = $derived(data.kind === 'body' && bodySelfRef?.parentId != null)

	// Context-panel data: a star's planets; a planet's sibling planets + its moons;
	// a moon's co-moons (the other satellites of the same parent).
	const contextBodies = $derived.by(() => {
		if (data.kind === 'star') return data.systemPlanets ?? []
		if (data.kind === 'body') {
			if (data.sectorContext) return []
			if (isSatellite) {
				return (data.siblings ?? []).filter(b => b.parentId === bodySelfRef?.parentId && b.id !== raw.id)
			}
			// Same primary: same nearest star, or the same barycenter for circumbinary bodies.
			return (data.siblings ?? []).filter(b => b.starId === bodySelfRef?.starId
				&& b.parentSystemId === bodySelfRef?.parentSystemId
				&& b.parentId == null && b.id !== raw.id)
		}
		return []
	})
	const contextMoons = $derived.by(() =>
		data.kind === 'body' ? (data.siblings ?? []).filter(b => b.parentId === raw.id) : [],
	)
	// Habitable zone and the self-distance dot are heliocentric — only meaningful
	// for a planet orbiting the star directly. A moon's semiMajorAxisAu is relative
	// to its parent body, so plotting it on the star's HZ axis would be nonsense.
	const contextHz = $derived(
		data.kind === 'star'
			? data.model?.habitableZoneAu ?? null
			: (data.kind === 'body' && !isSatellite ? data.parentStarHz : null),
	)
	const contextSelfAu = $derived(data.kind === 'body' && !isSatellite ? data.model?.semiMajorAxisAu ?? null : null)
	// Provenance for the planet's parent-star HZ, surfaced from the catalogue model
	// that produced it. Only the body path carries it; a star's own HZ comes from a
	// different derivation and has no catalogue record to cite here.
	const contextHzSource = $derived(
		data.kind === 'body' && !isSatellite ? data.parentStarHz?.source ?? null : null,
	)
</script>

<svelte:head>
	<title>{raw.name} — Rodder — KnowThing</title>
</svelte:head>

{#if isConfigureMode && data.kind === 'star'}
	<RodderConfigureForm
		kind="star"
		record={{ ...raw, systemId: starSelfRef?.systemId ?? null, parentStarId: starSelfRef?.parentStarId ?? null }}
		systems={data.allSystems ?? []}
		stars={data.allStars ?? []}
	/>
{:else if isConfigureMode && data.kind === 'body'}
	<RodderConfigureForm
		kind="body"
		record={{ ...raw, starId: bodySelfRef?.starId ?? null, parentId: bodySelfRef?.parentId ?? null, parentSystemId: bodySelfRef?.parentSystemId ?? null, sectorId: data.sectorContext?.sectorId ?? null }}
		systems={data.allSystems ?? []}
		stars={data.allStars ?? []}
		siblings={data.siblings ?? []}
		sectors={data.sectors}
	/>
{:else if isConfigureMode && data.kind === 'system'}
	<!-- Map rows carry id/name; systemId is trivially this system (they were fetched by it). -->
	<RodderConfigureForm
		kind="system"
		record={{ ...raw, sectorId: data.sectorContext?.sectorId ?? null }}
		sectors={data.sectors}
		stars={(data.rootStars ?? []).map(s => ({ id: s.id, name: s.name, systemId: raw.id }))}
	/>
{:else}
	<ArticleShell
		breadcrumbs={rodderBreadcrumbs(raw.name)}
		title={raw.name}
	>
		{#snippet actions()}
			<a
				href={resolve(...rodderDownloadRoute(raw.slug))}
				class="text-link transition-colors hover:text-link-hover"
				download
			>Download JSON</a>
			{#if hasRootView && (rootStars.length > 0 || rootBodies.length > 0)}
				<CopyViewLink getState={currentViewState} />
			{/if}
			{#if permissions.canConfigureRodder}
				<a
					href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${raw.slug}/configure` })}
					class="flex items-center gap-1 font-medium text-link transition-colors hover:text-link-hover"
				>
					<GearSixIcon size={14} weight="fill" />Configure
				</a>
			{:else if permissions.isAuthenticated && !permissions.canConfigureRodder}
				<span class="text-sm text-secondary">View only. Editor role required for rodder changes.</span>
			{/if}
		{/snippet}

		{#if hasRootView && (data.kind === 'system' || data.kind === 'body')}
			<div class="min-w-0 overflow-hidden">
				{#if rootStars.length > 0 || rootBodies.length > 0}
					<div class="relative isolate overflow-hidden border border-border-subtle bg-black">
						<div class="h-[clamp(28rem,72vh,56rem)]">
							<RootMap
								bind:this={rootMap}
								rootName={raw.name}
								stars={rootStars}
								bodies={rootBodies}
								apparentSky={data.apparentSky}
								{currentAbsoluteDay}
								scale={mapScale}
								labels={mapLabels}
								skyLabels={mapSkyLabels}
								trails={mapTrails}
								visibility={mapVisibility}
								bind:follow={mapFollow}
								bind:view={mapView}
								bind:selectedId={() => mapSelectedId, (selected) => {
									mapSelectedId = selected
									activeRootOverlay = null
								}}
								bind:focusId={mapFocusId}
								{initialCameraState}
							/>
						</div>

						<div class="
							absolute top-11 left-2 z-30 flex max-w-[calc(100%-1rem)] items-center overflow-x-auto border border-faint/50 bg-surface/90 text-xs shadow-lg
							backdrop-blur-sm
						" aria-label="Map displays">
							<span class="max-w-36 truncate border-r border-faint/50 px-2 py-1.5 font-medium text-heading" title={raw.name}>{raw.name}</span>
							<button
								type="button"
								class={cn('flex items-center gap-1 px-2 py-1.5 text-secondary transition-colors hover:text-heading', activeRootOverlay === 'overview' && 'bg-accent-subtle text-accent')}
								aria-expanded={activeRootOverlay === 'overview'}
								aria-controls="root-context-overlay"
								onclick={() => toggleRootOverlay('overview')}
							><Info size={14} />Overview</button>
							<button
								type="button"
								class={cn('flex items-center gap-1 px-2 py-1.5 text-secondary transition-colors hover:text-heading', activeRootOverlay === 'objects' && 'bg-accent-subtle text-accent')}
								aria-expanded={activeRootOverlay === 'objects'}
								aria-controls="root-context-overlay"
								onclick={() => toggleRootOverlay('objects')}
							><TreeStructure size={14} />Objects</button>
							{#if rootCalendarConfigs.length > 0}
								<button
									type="button"
									class={cn('flex items-center gap-1 px-2 py-1.5 text-secondary transition-colors hover:text-heading', activeRootOverlay === 'calendar' && 'bg-accent-subtle text-accent')}
									aria-expanded={activeRootOverlay === 'calendar'}
									aria-controls="root-context-overlay"
									onclick={() => toggleRootOverlay('calendar')}
								><CalendarBlank size={14} />Calendar</button>
							{/if}
							<button
								type="button"
								class={cn('flex items-center gap-1 px-2 py-1.5 text-secondary transition-colors hover:text-heading', activeRootOverlay === 'settings' && 'bg-accent-subtle text-accent')}
								aria-expanded={activeRootOverlay === 'settings'}
								aria-controls="root-context-overlay"
								onclick={() => toggleRootOverlay('settings')}
							><SlidersHorizontal size={14} />Display</button>
						</div>

						{#if activeRootOverlay}
							<aside
								id="root-context-overlay"
								class="
									absolute inset-x-2 bottom-2 z-40 max-h-[48%] overflow-auto border border-faint/60 bg-surface/95 shadow-xl backdrop-blur-sm
									sm:top-20 sm:right-auto sm:bottom-auto sm:left-2 sm:max-h-[calc(100%-5.5rem)] sm:w-80
								"
								aria-label={activeRootOverlay === 'settings' ? 'Display settings' : `${activeRootOverlay} display`}
							>
								<div class="sticky top-0 flex items-center justify-between border-b border-border-subtle bg-raised/95 px-3 py-2">
									<h2 class="text-xs font-semibold tracking-wider text-secondary uppercase">{activeRootOverlay === 'objects' ? 'Root objects' : (activeRootOverlay === 'settings' ? 'Display settings' : activeRootOverlay)}</h2>
									<button type="button" class="text-secondary transition-colors hover:text-heading" aria-label="Close overlay" onclick={() => { activeRootOverlay = null }}><XIcon size={15} /></button>
								</div>
								<div class="p-3">
									{#if activeRootOverlay === 'settings'}
										<MapControls
											bind:labels={mapLabels}
											bind:skyLabels={mapSkyLabels}
											bind:trails={mapTrails}
											bind:visibility={mapVisibility}
											variant="panel"
										/>
									{:else}
										<RootOverlayPanel
											panel={activeRootOverlay}
											root={raw}
											rootKind={data.kind}
											stars={rootStars}
											bodies={rootBodies}
											rootSlug={raw.slug}
											sector={rootSectorContext}
											calendars={rootCalendarConfigs}
											{calendarSnippet}
											bind:currentAbsoluteDay
											onselect={selectRootEntity}
										/>
									{/if}
								</div>
							</aside>
						{:else if mapSelectedId && (selectedBody || selectedSkySource)}
							<aside
								id="root-selection-inspector"
								class="
									absolute inset-x-2 bottom-2 z-40 max-h-[48%] overflow-auto border border-accent/60 bg-surface/95 shadow-xl backdrop-blur-sm
									sm:top-12 sm:right-2 sm:bottom-auto sm:left-auto sm:max-h-[calc(100%-3.5rem)] sm:w-80
								"
								aria-label={selectedOverlayTitle}
							>
								<div class="sticky top-0 flex items-center justify-between border-b border-border-subtle bg-raised/95 px-3 py-2">
									<h2 class="text-xs font-semibold tracking-wider text-secondary uppercase">{selectedOverlayTitle}</h2>
									<button
										type="button"
										class="text-secondary transition-colors hover:text-heading"
										aria-label="Close inspector"
										onclick={() => {
											mapSelectedId = null
										}}
									><XIcon size={15} /></button>
								</div>
								<div class="p-3">
									<RootOverlayPanel
										panel="selection"
										root={raw}
										rootKind={data.kind}
										stars={rootStars}
										bodies={rootBodies}
										rootSlug={raw.slug}
										{selectedBody}
										{selectedSkySource}
									/>
								</div>
							</aside>
						{/if}
					</div>
					{#if rootCalendarConfigs.length > 0}
						<DateScrubber calendars={rootCalendarConfigs} bind:currentAbsoluteDay />
					{/if}
				{:else}
					<div class="flex h-64 items-center justify-center text-dim">No objects registered in this root.</div>
				{/if}
			</div>
			<div class="mt-4"><RodderBacklinks links={data.backlinks} /></div>
			{#if data.kind === 'body' && data.model}
				<div class="mt-4 space-y-4">
					<RodderStatGrid model={data.model} />
					<div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px] lg:items-start">
						<div class="min-w-0"><RodderFactSheet model={data.model} /></div>
						<RodderContextPanel
							model={data.model}
							bodies={contextBodies}
							moons={contextMoons}
							hz={contextHz}
							hzSource={contextHzSource}
							selfAu={contextSelfAu}
						/>
					</div>
				</div>
			{/if}
		{:else if (data.kind === 'star' || data.kind === 'body') && data.model}
			<div class="space-y-4">
				<RodderStatGrid model={data.model} />
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px] lg:items-start">
					<div class="min-w-0">
						<RodderFactSheet model={data.model} />
					</div>
					<div class="space-y-4">
						<RodderContextPanel
							model={data.model}
							bodies={contextBodies}
							moons={contextMoons}
							hz={contextHz}
							hzSource={contextHzSource}
							selfAu={contextSelfAu}
						/>
						<RodderBacklinks links={data.backlinks} />
					</div>
				</div>
			</div>
		{:else}
			<p class="text-dim">No data available for this entity.</p>
		{/if}
	</ArticleShell>
{/if}
