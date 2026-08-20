<script lang="ts">
	import { resolve } from '$app/paths'
	import { untrack } from 'svelte'
	import type { CalendarConfig } from 'rimecraft'
	import { dateFromAbsolute, resolveDisplay } from 'rimecraft'
	import { deriveSystemType } from 'tungolcraft'
	import Asterisk from 'phosphor-svelte/lib/Asterisk'
	import CircleDashed from 'phosphor-svelte/lib/CircleDashed'
	import Moon from 'phosphor-svelte/lib/Moon'
	import Planet from 'phosphor-svelte/lib/Planet'
	import Star from 'phosphor-svelte/lib/Star'
	import CalendarWidget from '$lib/calendar/CalendarWidget.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import type { ApparentSkySource } from './apparent-sky.js'
	import { resolveColor } from './colors.js'
	import { keyForBody, type EntityKey, type MapBody } from './root-layout.js'

	type Panel = 'overview' | 'objects' | 'calendar' | 'selection'

	let {
		panel,
		root,
		rootKind = 'system',
		stars,
		bodies,
		rootSlug,
		sector = null,
		calendars = [],
		currentAbsoluteDay = $bindable(0),
		selectedBody = null,
		selectedSkySource = null,
		onselect,
	}: {
		panel: Panel
		root: {
			name: string
			bodyType?: string | null
			distanceLy?: number | null
			formationAge?: string | null
			designations?: string | null
		}
		rootKind?: 'system' | 'body'
		stars: MapBody[]
		bodies: MapBody[]
		rootSlug: string
		sector?: {
			sectorName: string
			sectorSlug: string
			units: string
			x: number | null
			y: number | null
			z: number | null
		} | null
		calendars?: (CalendarConfig & { id: number })[]
		currentAbsoluteDay?: number
		selectedBody?: MapBody | null
		selectedSkySource?: ApparentSkySource | null
		onselect?: (key: EntityKey) => void
	} = $props()

	const formatCoordinate = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 })
	const sectorPosition = $derived.by(() => {
		if (!sector || sector.x == null || sector.y == null || sector.z == null) return null
		return `(${formatCoordinate(sector.x)}, ${formatCoordinate(sector.y)}, ${formatCoordinate(sector.z)}) ${sector.units}`
	})

	let selectedCalendarId = $state(untrack(() => calendars[0]?.id ?? 0))
	const selectedCalendar = $derived(calendars.find(calendar => calendar.id === selectedCalendarId) ?? calendars[0])
	const currentDate = $derived(selectedCalendar ? dateFromAbsolute(selectedCalendar.static_data, Math.floor(currentAbsoluteDay)) : null)
	const resolvedDate = $derived(selectedCalendar && currentDate ? resolveDisplay(selectedCalendar, currentDate) : null)

	const systemType = $derived(deriveSystemType(stars.length))
	const totalBodies = $derived(bodies.length)
	const centralBodies = $derived(bodies.filter(body => body.isRoot))
	const rootType = $derived(rootKind === 'body'
		? (root.bodyType ? root.bodyType.replaceAll('_', ' ') : 'body')
		: ({ single: 'Single', binary: 'Binary', trinary: 'Trinary', multiple: 'Multiple' }[systemType] ?? systemType))

	function planetsForStar(starId: number) {
		return bodies.filter(body => body.starId === starId && !body.parentId)
	}

	function moonsForBody(bodyId: number) {
		return bodies.filter(body => body.parentId === bodyId)
	}

	function bodyIcon(type: string, isSatellite: boolean) {
		if (isSatellite) return Moon
		switch (type) {
			case 'asteroid': return Asterisk
			case 'ring_system': return CircleDashed
			default: return Planet
		}
	}

	function brightnessSourceLabel(source: ApparentSkySource['stars'][number]['brightnessSource']) {
		switch (source) {
			case 'absolute-magnitude': return 'absolute magnitude'
			case 'stored-luminosity': return 'stored luminosity'
			case 'derived-luminosity': return 'derived luminosity'
			default: return 'brightness unavailable'
		}
	}

	function selectBody(body: MapBody, isStar: boolean) {
		onselect?.(keyForBody(body, isStar))
	}
</script>

<div class="text-sm" data-root-overlay-panel={panel}>
	{#if panel === 'overview'}
		<div class="space-y-1.5 text-secondary">
			<div class="flex justify-between gap-4">
				<span>Type</span>
				<span class="text-right font-medium text-body capitalize">{rootType}</span>
			</div>
			{#if rootKind === 'system' || stars.length > 0}
				<div class="flex justify-between"><span>Stars</span><span class="font-medium text-body">{stars.length}</span></div>
			{/if}
			{#if totalBodies > 0}
				<div class="flex justify-between"><span>Bodies</span><span class="font-medium text-body">{totalBodies}</span></div>
			{/if}
			{#if root.distanceLy != null}
				<div class="flex justify-between gap-4">
					<span>Distance</span>
					<span class="text-right font-medium text-body">{root.distanceLy.toLocaleString('en-US', { maximumFractionDigits: 2 })} ly</span>
				</div>
			{/if}
			{#if root.formationAge}
				<div class="flex justify-between gap-4"><span>Age</span><span class="text-right font-medium text-body">{root.formationAge}</span></div>
			{/if}
			{#if root.designations}
				<div class="flex justify-between gap-4"><span>Designations</span><span class="text-right font-medium text-body">{root.designations}</span></div>
			{/if}
			{#if sector}
				<div class="flex justify-between gap-4">
					<span>Sector</span>
					<a
						href={resolve(`/rodder/sector/${sector.sectorSlug}?focus=${encodeURIComponent(rootSlug)}`)}
						class="text-right font-medium text-link transition-colors hover:text-link-hover"
					>{sector.sectorName}</a>
				</div>
				{#if sectorPosition}
					<div class="flex justify-between gap-4"><span>Position</span><span class="text-right font-medium text-body">{sectorPosition}</span></div>
				{/if}
			{/if}
		</div>
	{:else if panel === 'selection'}
		{#if selectedBody}
			<div class="space-y-2">
				<div class="font-medium text-heading">{selectedBody.name}</div>
				<div class="space-y-1 text-xs text-secondary">
					{#if selectedBody.bodyType}
						<div class="flex justify-between"><span>Type</span><span class="text-body capitalize">{selectedBody.parentId ? 'Satellite' : selectedBody.bodyType}</span></div>
					{/if}
					{#if selectedBody.spectralType}
						<div class="flex justify-between"><span>Spectral type</span><span class="text-body">{selectedBody.spectralType}</span></div>
					{/if}
					{#if selectedBody.semiMajorAxisAu}
						<div class="flex justify-between"><span>Semi-major axis</span><span class="text-body">{selectedBody.semiMajorAxisAu.toFixed(3)} AU</span></div>
					{/if}
					{#if selectedBody.orbitalPeriodDays}
						<div class="flex justify-between">
							<span>Orbital period</span>
							<span class="text-body">{selectedBody.orbitalPeriodDays < 1 ? `${(selectedBody.orbitalPeriodDays * 24).toFixed(1)} h` : `${selectedBody.orbitalPeriodDays.toFixed(1)} d`}</span>
						</div>
					{/if}
					{#if selectedBody.eccentricity != null}
						<div class="flex justify-between"><span>Eccentricity</span><span class="text-body">{selectedBody.eccentricity.toFixed(4)}</span></div>
					{/if}
				</div>
				<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${selectedBody.slug}` })} class="text-xs text-link transition-colors hover:text-link-hover">View details</a>
			</div>
		{:else if selectedSkySource}
			<div class="space-y-2">
				<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${selectedSkySource.rootSlug}` })} class="font-medium text-link transition-colors hover:text-link-hover">{selectedSkySource.rootName}</a>
				<div class="space-y-1 text-xs text-secondary">
					<div class="flex justify-between gap-3"><span>Distance</span><span class="text-body">{selectedSkySource.distance.toLocaleString('en-US', { maximumFractionDigits: 2 })} {selectedSkySource.units}</span></div>
					<div class="flex justify-between gap-3"><span>Apparent magnitude</span><span class="text-body">{selectedSkySource.apparentMagnitude?.toFixed(2) ?? 'Unavailable'}</span></div>
					<div class="flex justify-between gap-3"><span>Position</span><span class="text-body capitalize">{selectedSkySource.positionProvenance}</span></div>
				</div>
				{#if selectedSkySource.brightnessStatus !== 'complete'}
					<p class="text-xs text-accent">
						{selectedSkySource.brightnessStatus === 'unavailable'
							? 'Brightness is unavailable; enhanced appearance is illustrative.'
							: 'Combined brightness excludes members without physical inputs.'}
					</p>
				{/if}
				<div>
					<div class="text-[0.68rem] tracking-wider text-secondary uppercase">Unresolved members</div>
					{#each selectedSkySource.stars as star (star.id)}
						<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${star.slug}` })} class="flex items-start justify-between gap-2 py-0.5 text-xs text-link transition-colors hover:text-link-hover">
							<span>{star.name}</span>
							<span class="text-right text-secondary">{#if star.spectralType}{star.spectralType} · {/if}{brightnessSourceLabel(star.brightnessSource)}</span>
						</a>
					{/each}
				</div>
			</div>
		{:else}
			<p class="text-secondary">Select a local object or authored sky source to inspect it.</p>
		{/if}
	{:else if panel === 'objects'}
		<div class="space-y-0.5">
			{#each centralBodies as centralBody (centralBody.id)}
				{@const RootIcon = bodyIcon(centralBody.bodyType, false)}
				<div class="flex items-center gap-2 px-1.5 py-1 transition-colors hover:bg-raised">
					<RootIcon size={16} weight="fill" class="shrink-0" color={resolveColor(centralBody.color, 'var(--color-secondary)')} />
					<button type="button" class="min-w-0 flex-1 truncate text-left font-medium text-body" onclick={() => selectBody(centralBody, false)}>{centralBody.name} <span class="text-xs font-normal text-secondary">(root)</span></button>
					<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${centralBody.slug}` })} class="text-xs text-link hover:text-link-hover">Open</a>
				</div>
				{#each moonsForBody(centralBody.id) as moon (moon.id)}
					<div class="ml-4 flex items-center gap-2 px-1.5 py-0.5 transition-colors hover:bg-raised">
						<Moon size={12} weight="fill" class="shrink-0 text-dim" />
						<button type="button" class="min-w-0 flex-1 truncate text-left text-xs text-secondary" onclick={() => selectBody(moon, false)}>{moon.name}</button>
						<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${moon.slug}` })} class="text-xs text-link hover:text-link-hover">Open</a>
					</div>
				{/each}
			{/each}
			{#each stars as star (star.id)}
				{@const isPrimary = !star.parentStarId}
				<div class="flex items-center gap-2 px-1.5 py-1 transition-colors hover:bg-raised">
					<Star size={16} weight={isPrimary ? 'fill' : 'regular'} class="shrink-0" color={resolveColor(star.color, '#FFE088')} />
					<button type="button" class="min-w-0 flex-1 truncate text-left font-medium text-body" onclick={() => selectBody(star, true)}>{star.name}{#if star.spectralType} <span class="text-xs font-normal text-secondary">({star.spectralType})</span>{/if}</button>
					<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${star.slug}` })} class="text-xs text-link hover:text-link-hover">Open</a>
				</div>
				{#each planetsForStar(star.id) as planet (planet.id)}
					{@const PlanetIcon = bodyIcon(planet.bodyType, !!planet.parentId)}
					<div class="ml-4 flex items-center gap-2 px-1.5 py-1 transition-colors hover:bg-raised">
						<PlanetIcon size={14} weight="fill" class="shrink-0" color={resolveColor(planet.color, 'var(--color-secondary)')} />
						<button type="button" class="min-w-0 flex-1 truncate text-left text-body" onclick={() => selectBody(planet, false)}>{planet.name} <span class="text-xs text-secondary">({planet.bodyType})</span></button>
						<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${planet.slug}` })} class="text-xs text-link hover:text-link-hover">Open</a>
					</div>
					{#each moonsForBody(planet.id) as moon (moon.id)}
						<div class="ml-8 flex items-center gap-2 px-1.5 py-0.5 transition-colors hover:bg-raised">
							<Moon size={12} weight="fill" class="shrink-0 text-dim" />
							<button type="button" class="min-w-0 flex-1 truncate text-left text-xs text-secondary" onclick={() => selectBody(moon, false)}>{moon.name}</button>
							<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${moon.slug}` })} class="text-xs text-link hover:text-link-hover">Open</a>
						</div>
					{/each}
				{/each}
			{/each}
		</div>
	{:else if panel === 'calendar'}
		{#if calendars.length > 0 && selectedCalendar}
			<div class="space-y-2">
				{#if calendars.length > 1}
					<Select type="single" numeric bind:value={selectedCalendarId} items={calendars.map(calendar => ({ value: String(calendar.id), label: calendar.name }))} size="sm" />
				{:else}
					<div class="text-xs font-medium text-secondary">{selectedCalendar.name}</div>
				{/if}
				{#if resolvedDate}
					<div class="text-center font-medium text-body">{resolvedDate.day} {resolvedDate.month_name}, {resolvedDate.year_display}</div>
				{/if}
				<CalendarWidget config={selectedCalendar} year={currentDate?.year} monthIndex={currentDate ? currentDate.month - 1 : undefined} />
			</div>
		{:else}
			<p class="text-secondary">No calendar is associated with this root.</p>
		{/if}
	{/if}
</div>
