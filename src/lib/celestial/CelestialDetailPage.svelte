<script lang="ts">
	import { untrack } from 'svelte'
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import { normalizePermissions } from '$lib/permissions.js'
	import CelestialStatGrid from '$lib/celestial/CelestialStatGrid.svelte'
	import CelestialFactSheet from '$lib/celestial/CelestialFactSheet.svelte'
	import CelestialContextPanel from '$lib/celestial/CelestialContextPanel.svelte'
	import CelestialBacklinks from '$lib/celestial/CelestialBacklinks.svelte'
	import SystemMap from '$lib/celestial/SystemMap.svelte'
	import MapControls from '$lib/celestial/MapControls.svelte'
	import SystemSidebar from '$lib/celestial/SystemSidebar.svelte'
	import DateScrubber from '$lib/celestial/DateScrubber.svelte'
	import { DEFAULT_MAP_SETTINGS } from '$lib/celestial/map-settings.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { SvelteMap } from 'svelte/reactivity'
	import { createKnowContext, slugify, type ResolvedLink } from '$lib/renderer/context.js'
	import CelestialConfigureForm from '$lib/components/celestial/CelestialConfigureForm.svelte'
	import { celestialBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import GearSixIcon from 'phosphor-svelte/lib/GearSixIcon'
	import type { CelestialDetailData } from '$lib/server/loaders/celestial-detail.js'

	let { data }: { data: CelestialDetailData } = $props()

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
	// targets are real, resolved celestial entities — but the renderer paints any
	// wikilink it can't find in `resolvedLinks` as a red (missing) link pointing at
	// `/know/<slug>`. Seed the map from the model so they render live and route to
	// the correct `/Celestial:<slug>` page. A reactive map keeps this correct as the
	// component is reused across client-side navigation between celestial pages.
	function celestialLinkEntries(d: CelestialDetailData): [string, ResolvedLink][] {
		const entries: [string, ResolvedLink][] = []
		const add = (ref: { slug: string } | null | undefined) => {
			// Key matches WikiInternalLink's lookup: `${sourceDomain}:${slugify(target).toLowerCase()}`.
			if (ref?.slug) entries.push([`celestial:${slugify(ref.slug).toLowerCase()}`, { href: `/Celestial:${ref.slug}`, exists: true }])
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
	const resolvedLinks = new SvelteMap<string, ResolvedLink>(untrack(() => celestialLinkEntries(data)))

	$effect(() => {
		resolvedLinks.clear()
		for (const [key, value] of celestialLinkEntries(data)) resolvedLinks.set(key, value)
	})

	// Fact-sheet values can include wikilinks; the renderer expects a Know context.
	createKnowContext({
		resolvedLinks,
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		sourceDomain: 'celestial',
		calendarDate: $page.data.calendarDate ?? null,
	})

	// System map state. Seed the in-world day from the first system calendar's epoch
	// and day length so the map opens on a plausible "now" rather than a raw Unix day.
	function computeInitialDay(): number {
		const cal = data.kind === 'system' ? (data.systemCalendars as any[] | undefined)?.[0] : null
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
	let mapSelectedId = $state<`star:${number}` | `body:${number}` | null>(null)

	// This component instance is reused across client-side navigation between
	// celestial pages. computeInitialDay() reads `data`, so this effect re-runs
	// when the loaded entity changes — reseeding the map's in-world "now" and
	// clearing a selection carried over from the previous system. The writes are
	// untracked and target state this effect doesn't read, so a user's scrubbing
	// or map selection within a page is never clobbered.
	$effect(() => {
		const day = computeInitialDay()
		untrack(() => {
			currentAbsoluteDay = day
			mapView = DEFAULT_MAP_SETTINGS.view
			mapSelectedId = null
		})
	})

	const selectedBody = $derived.by(() => {
		if (mapSelectedId == null) return null
		const [k, rawId] = mapSelectedId.split(':')
		const numericId = Number(rawId)
		if (k === 'star' && data.kind === 'system') return (data.systemStars ?? []).find(b => b.id === numericId) ?? null
		if (k === 'body' && data.kind === 'system') return (data.systemBodies ?? []).find(b => b.id === numericId) ?? null
		return null
	})

	const systemCalendarConfigs = $derived.by(() => {
		if (data.kind !== 'system') return []
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
	<title>{raw.name} — Celestial — KnowThing</title>
</svelte:head>

{#if isConfigureMode && data.kind === 'star'}
	<CelestialConfigureForm
		kind="star"
		record={{ ...raw, systemId: starSelfRef?.systemId ?? null, parentStarId: starSelfRef?.parentStarId ?? null }}
		systems={data.allSystems ?? []}
		stars={data.allStars ?? []}
	/>
{:else if isConfigureMode && data.kind === 'body'}
	<CelestialConfigureForm
		kind="body"
		record={{ ...raw, starId: bodySelfRef?.starId ?? null, parentId: bodySelfRef?.parentId ?? null, parentSystemId: bodySelfRef?.parentSystemId ?? null }}
		systems={data.allSystems ?? []}
		stars={data.allStars ?? []}
		siblings={data.siblings ?? []}
	/>
{:else if isConfigureMode && data.kind === 'system'}
	<!-- Map rows carry id/name; systemId is trivially this system (they were fetched by it). -->
	<CelestialConfigureForm
		kind="system"
		record={raw}
		stars={(data.systemStars ?? []).map(s => ({ id: s.id, name: s.name, systemId: raw.id }))}
	/>
{:else}
	<ArticleShell
		breadcrumbs={celestialBreadcrumbs(raw.name)}
		title={raw.name}
	>
		{#snippet actions()}
			{#if permissions.canConfigureCelestial}
				<a
					href={resolve('/[...ns_path=namespaced]', { ns_path: `Celestial:${raw.slug}/configure` })}
					class="flex items-center gap-1 font-medium text-link transition-colors hover:text-link-hover"
				>
					<GearSixIcon size={14} weight="fill" />Configure
				</a>
			{:else if permissions.isAuthenticated && !permissions.canConfigureCelestial}
				<span class="text-sm text-secondary">View only. Editor role required for celestial changes.</span>
			{/if}
		{/snippet}

		{#if kind === 'system' && data.kind === 'system'}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
				<div class="min-w-0 overflow-hidden">
					{#if data.systemStars && data.systemStars.length > 0}
						<MapControls
							bind:labels={mapLabels}
							bind:trails={mapTrails}
							bind:follow={mapFollow}
							hasSelection={mapSelectedId != null}
						/>
						<div class="h-[clamp(28rem,72vh,56rem)]">
							<SystemMap
								systemName={raw.name}
								stars={data.systemStars}
								bodies={data.systemBodies ?? []}
								{currentAbsoluteDay}
								scale={mapScale}
								labels={mapLabels}
								trails={mapTrails}
								follow={mapFollow}
								bind:view={mapView}
								bind:selectedId={mapSelectedId}
							/>
						</div>
						{#if systemCalendarConfigs.length > 0}
							<DateScrubber calendars={systemCalendarConfigs} bind:currentAbsoluteDay />
						{/if}
					{:else}
						<div class="flex h-64 items-center justify-center text-dim">
							No stars registered in this system.
						</div>
					{/if}
				</div>

				<div class="space-y-4 md:border-l md:border-border-subtle md:pl-4">
					<SystemSidebar
						system={raw}
						stars={data.systemStars ?? []}
						bodies={data.systemBodies ?? []}
						systemSlug={raw.slug}
						calendars={systemCalendarConfigs}
						bind:currentAbsoluteDay
						{selectedBody}
					/>
					<CelestialBacklinks links={data.backlinks} />
				</div>
			</div>
		{:else if (data.kind === 'star' || data.kind === 'body') && data.model}
			<div class="space-y-4">
				<CelestialStatGrid model={data.model} />
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px] lg:items-start">
					<div class="min-w-0">
						<CelestialFactSheet model={data.model} />
					</div>
					<div class="space-y-4">
						<CelestialContextPanel
							model={data.model}
							bodies={contextBodies}
							moons={contextMoons}
							hz={contextHz}
							hzSource={contextHzSource}
							selfAu={contextSelfAu}
						/>
						<CelestialBacklinks links={data.backlinks} />
					</div>
				</div>
			</div>
		{:else}
			<p class="text-dim">No data available for this entity.</p>
		{/if}
	</ArticleShell>
{/if}
