<script lang="ts">
	import { untrack } from 'svelte'
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import { normalizePermissions } from '$lib/permissions.js'
	import RodderStatGrid from '$lib/rodder/RodderStatGrid.svelte'
	import RodderFactSheet from '$lib/rodder/RodderFactSheet.svelte'
	import RodderContextPanel from '$lib/rodder/RodderContextPanel.svelte'
	import RodderBacklinks from '$lib/rodder/RodderBacklinks.svelte'
	import RootMap from '$lib/rodder/RootMap.svelte'
	import CopyViewLink from '$lib/rodder/CopyViewLink.svelte'
	import MapControls from '$lib/rodder/MapControls.svelte'
	import RootSidebar from '$lib/rodder/RootSidebar.svelte'
	import DateScrubber from '$lib/rodder/DateScrubber.svelte'
	import { DEFAULT_MAP_SETTINGS } from '$lib/rodder/map-settings.js'
	import {
		RODDER_VIEW_QUERY_PARAM,
		rootViewStateFor,
		type RootCameraState,
		type RootViewState,
	} from '$lib/rodder/view-state.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { SvelteMap } from 'svelte/reactivity'
	import { createKnowContext, slugify, type ResolvedLink } from '$lib/renderer/context.js'
	import RodderConfigureForm from '$lib/components/rodder/RodderConfigureForm.svelte'
	import { rodderBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import GearSixIcon from 'phosphor-svelte/lib/GearSixIcon'
	import type { RodderDetailData } from '$lib/server/loaders/rodder-detail.js'

	let { data }: { data: RodderDetailData } = $props()

	const kind = $derived(data.kind)
	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)
	const isConfigureMode = $derived(data.isConfigureMode)
	const raw = $derived(data.body as any)

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
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		sourceDomain: 'rodder',
		calendarDate: $page.data.calendarDate ?? null,
	})

	// Root map state. Seed the in-world day from the first associated calendar's epoch
	// and day length so the map opens on a plausible "now" rather than a raw Unix day.
	function computeInitialDay(): number {
		const cal = data.kind === 'system' ? (data.rootCalendars as any[] | undefined)?.[0] : null
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
	let mapTrails = $state(DEFAULT_MAP_SETTINGS.trails)
	let mapFollow = $state(DEFAULT_MAP_SETTINGS.follow)
	let mapView = $state(DEFAULT_MAP_SETTINGS.view)
	let mapVisibility = $state(DEFAULT_MAP_SETTINGS.visibility)
	let mapSelectedId = $state<`star:${number}` | `body:${number}` | null>(null)
	let mapFocusId = $state<`star:${number}` | `body:${number}` | null>(null)
	let initialCameraState = $state<RootCameraState | null>(null)
	let rootMap = $state<{ getCameraState(): RootCameraState | null } | null>(null)

	const rootEntityKeys = $derived.by(() => {
		if (data.kind !== 'system') return new Set<`star:${number}` | `body:${number}`>()
		return new Set<`star:${number}` | `body:${number}`>([
			...(data.rootStars ?? []).map(star => `star:${star.id}` as const),
			...(data.rootBodies ?? []).map(body => `body:${body.id}` as const),
		])
	})
	const linkedViewState = $derived(data.kind === 'system'
		? rootViewStateFor($page.url.searchParams.get(RODDER_VIEW_QUERY_PARAM), raw.slug, rootEntityKeys)
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
			mapTrails = state?.trails ?? DEFAULT_MAP_SETTINGS.trails
			mapFollow = state?.follow ?? DEFAULT_MAP_SETTINGS.follow
			mapView = state?.mode ?? DEFAULT_MAP_SETTINGS.view
			mapVisibility = state?.visibility ?? DEFAULT_MAP_SETTINGS.visibility
			mapSelectedId = state?.selected ?? null
			mapFocusId = state?.focus ?? null
			initialCameraState = state?.camera ?? null
		})
	})

	function currentViewState(): RootViewState | null {
		if (data.kind !== 'system') return null
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
		if (k === 'star' && data.kind === 'system') return (data.rootStars ?? []).find(b => b.id === numericId) ?? null
		if (k === 'body' && data.kind === 'system') return (data.rootBodies ?? []).find(b => b.id === numericId) ?? null
		return null
	})

	const rootCalendarConfigs = $derived.by(() => {
		if (data.kind !== 'system') return []
		if (!data.rootCalendars) return []
		return (data.rootCalendars as any[]).map((c: any) => ({
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
		record={{ ...raw, starId: bodySelfRef?.starId ?? null, parentId: bodySelfRef?.parentId ?? null, parentSystemId: bodySelfRef?.parentSystemId ?? null }}
		systems={data.allSystems ?? []}
		stars={data.allStars ?? []}
		siblings={data.siblings ?? []}
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
			{#if data.kind === 'system' && data.rootStars && data.rootStars.length > 0}
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

		{#if kind === 'system' && data.kind === 'system'}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
				<div class="min-w-0 overflow-hidden">
					{#if data.rootStars && data.rootStars.length > 0}
						<MapControls
							bind:labels={mapLabels}
							bind:trails={mapTrails}
							bind:visibility={mapVisibility}
							bind:follow={mapFollow}
							hasSelection={mapSelectedId != null}
						/>
						<div class="h-[clamp(28rem,72vh,56rem)]">
							<RootMap
								bind:this={rootMap}
								rootName={raw.name}
								stars={data.rootStars}
								bodies={data.rootBodies ?? []}
								{currentAbsoluteDay}
								scale={mapScale}
								labels={mapLabels}
								trails={mapTrails}
								visibility={mapVisibility}
								follow={mapFollow}
								bind:view={mapView}
								bind:selectedId={mapSelectedId}
								bind:focusId={mapFocusId}
								{initialCameraState}
							/>
						</div>
						{#if rootCalendarConfigs.length > 0}
							<DateScrubber calendars={rootCalendarConfigs} bind:currentAbsoluteDay />
						{/if}
					{:else}
						<div class="flex h-64 items-center justify-center text-dim">
							No stars registered in this system.
						</div>
					{/if}
				</div>

				<div class="space-y-4 md:border-l md:border-border-subtle md:pl-4">
					<RootSidebar
						root={raw}
						stars={data.rootStars ?? []}
						bodies={data.rootBodies ?? []}
						rootSlug={raw.slug}
						sector={data.sectorContext}
						calendars={rootCalendarConfigs}
						bind:currentAbsoluteDay
						{selectedBody}
					/>
					<RodderBacklinks links={data.backlinks} />
				</div>
			</div>
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
