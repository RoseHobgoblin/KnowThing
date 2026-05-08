<script lang="ts">
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import InfoboxStar from '$lib/infoboxes/InfoboxStar.svelte'
	import InfoboxPlanet from '$lib/infoboxes/InfoboxPlanet.svelte'
	import SystemMap from '$lib/celestial/SystemMap.svelte'
	import MapControls from '$lib/celestial/MapControls.svelte'
	import SystemSidebar from '$lib/celestial/SystemSidebar.svelte'
	import { DEFAULT_MAP_SETTINGS } from '$lib/celestial/map-settings.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import CelestialConfigureStar from '$lib/components/celestial/CelestialConfigureStar.svelte'
	import CelestialConfigureBody from '$lib/components/celestial/CelestialConfigureBody.svelte'
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

	// Infobox values can include wikilinks; the renderer expects a Know context.
	createKnowContext({
		resolvedLinks: new Map(),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		sourceDomain: 'celestial',
		calendarDate: $page.data.calendarDate ?? null,
	})

	// System map state
	let currentAbsoluteDay = $state(Math.floor(Date.now() / 86_400_000))
	let mapScale = $state(DEFAULT_MAP_SETTINGS.scale)
	let mapLabels = $state(DEFAULT_MAP_SETTINGS.labels)
	let mapTrails = $state(DEFAULT_MAP_SETTINGS.trails)
	let mapFollow = $state(DEFAULT_MAP_SETTINGS.follow)
	let mapSelectedId = $state<`star:${number}` | `body:${number}` | null>(null)

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

	const configurePath = $derived(`/Celestial:${raw.slug}/configure`)

	const infoboxFields = $derived.by(() =>
		data.infoboxFields
			? new Map(Object.entries(data.infoboxFields))
			: new Map([['name', raw.name ?? '']]),
	)
</script>

<svelte:head>
	<title>{raw.name} — Celestial — KnowThing</title>
</svelte:head>

{#if isConfigureMode && data.kind === 'star'}
	<CelestialConfigureStar
		star={raw}
		allSystems={data.allSystems ?? []}
		wikiContent=""
		contentRecordId={null}
	/>
{:else if isConfigureMode && data.kind === 'planet'}
	<CelestialConfigureBody
		body={raw}
		allStars={data.allStars ?? []}
		siblings={data.siblings ?? []}
		wikiContent=""
		contentRecordId={null}
	/>
{:else}
	<ArticleShell
		breadcrumbs={celestialBreadcrumbs(raw.name)}
		title={raw.name}
	>
		{#snippet actions()}
			{#if kind !== 'system' && permissions.canConfigureCelestial}
				<a href={configurePath} class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover">
					<GearSixIcon size={14} weight="fill" />Configure
				</a>
			{:else if permissions.isAuthenticated && !permissions.canConfigureCelestial}
				<span class="text-faint text-sm">View only. Editor role required for celestial changes.</span>
			{/if}
		{/snippet}

		{#if kind === 'system' && data.kind === 'system'}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
				<div class="border border-border-subtle overflow-hidden">
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
		{:else}
			<div class="space-y-4">
				{#if kind === 'star'}
					<InfoboxStar fields={infoboxFields} />
				{:else}
					<InfoboxPlanet fields={infoboxFields} />
				{/if}
			</div>
		{/if}
	</ArticleShell>
{/if}
