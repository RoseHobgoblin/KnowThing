<script lang="ts">
	import { resolve } from '$app/paths'
	import { untrack } from 'svelte'
	import type { MapBody } from './root-layout.js'
	import type { CalendarConfig } from 'rimecraft'
	import { resolveColor } from './colors.js'
	import { deriveSystemType } from 'tungolcraft'
	import { resolveDisplay, dateFromAbsolute } from 'rimecraft'
	import Select from '$lib/components/ui/Select.svelte'
	import CalendarWidget from '$lib/calendar/CalendarWidget.svelte'
	import Star from 'phosphor-svelte/lib/Star'
	import Planet from 'phosphor-svelte/lib/Planet'
	import Moon from 'phosphor-svelte/lib/Moon'

	import Asterisk from 'phosphor-svelte/lib/Asterisk'
	import CircleDashed from 'phosphor-svelte/lib/CircleDashed'

	let {
		root,
		stars,
		bodies,
		rootSlug,
		sector = null,
		calendars = [],
		currentAbsoluteDay = $bindable(0),
		selectedBody = null,
	}: {
		root: {
			name: string
			distanceLy?: number | null
			formationAge?: string | null
			designations?: string | null
		}
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
	} = $props()

	const formatCoordinate = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })
	const sectorPosition = $derived.by(() => {
		if (!sector || sector.x == null || sector.y == null || sector.z == null) return null
		return `(${formatCoordinate(sector.x)}, ${formatCoordinate(sector.y)}, ${formatCoordinate(sector.z)}) ${sector.units}`
	})

	let selectedCalendarId = $state(untrack(() => calendars[0]?.id ?? 0))
	const selectedCalendar = $derived(calendars.find(c => c.id === selectedCalendarId) ?? calendars[0])
	// The day is fractional while the orrery is playing — floor before calendar math.
	const currentDate = $derived(selectedCalendar ? dateFromAbsolute(selectedCalendar.static_data, Math.floor(currentAbsoluteDay)) : null)
	const resolved = $derived(selectedCalendar && currentDate ? resolveDisplay(selectedCalendar, currentDate) : null)

	const systemType = $derived(deriveSystemType(stars.length))
	const primaryStar = $derived(stars.find(s => !s.parentStarId) ?? stars[0])

	function planetsForStar(starId: number) {
		return bodies.filter(b => b.starId === starId && !b.parentId)
	}

	function moonsForBody(bodyId: number) {
		return bodies.filter(b => b.parentId === bodyId)
	}

	function bodyIcon(type: string, isSatellite: boolean) {
		if (isSatellite) return Moon
		switch (type) {
			case 'planet': return Planet
			case 'asteroid': return Asterisk
			case 'ring_system': return CircleDashed
			default: return Planet
		}
	}

	const typeLabel: Record<string, string> = {
		single: 'Single',
		binary: 'Binary',
		trinary: 'Trinary',
		multiple: 'Multiple',
	}

	const totalBodies = $derived(bodies.length)
</script>

<div class="space-y-4 text-sm">
	<!-- Root metadata -->
	<div>
		<div class="mb-2 border-b border-border-subtle pb-1 text-xs font-semibold tracking-wider text-secondary uppercase">Root</div>
		<div class="space-y-1.5 text-secondary">
			<div class="flex justify-between">
				<span>Type</span>
				<span class="font-medium text-body">{typeLabel[systemType] ?? systemType}</span>
			</div>
			<div class="flex justify-between">
				<span>Stars</span>
				<span class="font-medium text-body">{stars.length}</span>
			</div>
			{#if totalBodies > 0}
				<div class="flex justify-between">
					<span>Bodies</span>
					<span class="font-medium text-body">{totalBodies}</span>
				</div>
			{/if}
			{#if root.distanceLy != null}
				<div class="flex justify-between">
					<span>Distance</span>
					<span class="font-medium text-body">{root.distanceLy.toLocaleString('en-US', { maximumFractionDigits: 2 })} ly</span>
				</div>
			{/if}
			{#if root.formationAge}
				<div class="flex justify-between gap-4">
					<span>Age</span>
					<span class="text-right font-medium text-body">{root.formationAge}</span>
				</div>
			{/if}
			{#if root.designations}
				<div class="flex justify-between gap-4">
					<span>Designations</span>
					<span class="text-right font-medium text-body">{root.designations}</span>
				</div>
			{/if}
			{#if sector}
				<div class="flex justify-between gap-4">
					<span>Sector</span>
					<a
						href={resolve(`/rodder/sector/${sector.sectorSlug}?focus=${encodeURIComponent(rootSlug)}`)}
						class="font-medium text-link transition-colors hover:text-link-hover"
					>{sector.sectorName}</a>
				</div>
				{#if sectorPosition}
					<div class="flex justify-between gap-4">
						<span>Position</span>
						<span class="text-right font-medium text-body">{sectorPosition}</span>
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Selected body detail -->
	{#if selectedBody}
		<div>
			<div class="mb-2 border-b border-border-subtle pb-1 text-xs font-semibold tracking-wider text-secondary uppercase">Selected</div>
			<div class="space-y-1.5">
				<div class="font-medium text-heading">{selectedBody.name}</div>
				<div class="space-y-1 text-xs text-secondary">
					{#if selectedBody.bodyType}
						<div class="flex justify-between">
							<span>Type</span>
							<span class="text-body">{selectedBody.parentId ? 'Satellite' : selectedBody.bodyType}</span>
						</div>
					{/if}
					{#if selectedBody.semiMajorAxisAu}
						<div class="flex justify-between">
							<span>Semi-major axis</span>
							<span class="text-body">{selectedBody.semiMajorAxisAu.toFixed(3)} AU</span>
						</div>
					{/if}
					{#if selectedBody.orbitalPeriodDays}
						<div class="flex justify-between">
							<span>Orbital period</span>
							<span class="text-body">{selectedBody.orbitalPeriodDays < 1 ? (selectedBody.orbitalPeriodDays * 24).toFixed(1) + ' h' : selectedBody.orbitalPeriodDays.toFixed(1) + ' d'}</span>
						</div>
					{/if}
					{#if selectedBody.eccentricity != null}
						<div class="flex justify-between">
							<span>Eccentricity</span>
							<span class="text-body">{selectedBody.eccentricity.toFixed(4)}</span>
						</div>
					{/if}
				</div>
				<a
					href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${selectedBody.slug}` })}
					class="mt-2 block text-xs text-link transition-colors hover:text-link-hover"
				>View details</a>
			</div>
		</div>
	{/if}

	<!-- Body list -->
	<div>
		<div class="mb-2 border-b border-border-subtle pb-1 text-xs font-semibold tracking-wider text-secondary uppercase">Bodies</div>
		<div class="space-y-0.5">
			{#each stars as star (star.id)}
				{@const isPrimary = !star.parentStarId}
				<a
					href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${star.slug}` })}
					class="flex items-center gap-2 px-1.5 py-1 transition-colors hover:bg-raised"
				>
					<Star
						size={16}
						weight={isPrimary ? 'fill' : 'regular'}
						class="shrink-0"
						color={resolveColor(star.color, '#FFE088')}
					/>
					<span class="font-medium text-body">{star.name}</span>
					{#if star.spectralType}
						<span class="text-xs text-secondary">({star.spectralType})</span>
					{/if}
				</a>

				<!-- Planets under this star -->
				{#each planetsForStar(star.id) as planet (planet.id)}
					{@const PlanetIcon = bodyIcon(planet.bodyType, !!planet.parentId)}
					<a
						href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${planet.slug}` })}
						class="ml-4 flex items-center gap-2 px-1.5 py-1 transition-colors hover:bg-raised"
					>
						<PlanetIcon
							size={14}
							weight="fill"
							class="shrink-0"
							color={resolveColor(planet.color, 'var(--color-secondary)')}
						/>
						<span class="text-body">{planet.name}</span>
						<span class="text-xs text-secondary">({planet.parentId ? 'satellite' : planet.bodyType})</span>
					</a>

					<!-- Moons -->
					{#each moonsForBody(planet.id) as moon (moon.id)}
						<a
							href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${moon.slug}` })}
							class="ml-8 flex items-center gap-2 px-1.5 py-0.5 transition-colors hover:bg-raised"
						>
							<Moon size={12} weight="fill" class="shrink-0 text-dim" />
							<span class="text-xs text-secondary">{moon.name}</span>
						</a>
					{/each}
				{/each}
			{/each}
		</div>
	</div>

	<!-- Calendar / Time -->
	{#if calendars.length > 0 && selectedCalendar}
		<div>
			<div class="mb-2 border-b border-border-subtle pb-1 text-xs font-semibold tracking-wider text-secondary uppercase">
				Viewing
				{#if calendars.length > 1}
					<Select
						type="single"
						numeric
						bind:value={selectedCalendarId}
						items={calendars.map(cal => ({ value: String(cal.id), label: cal.name }))}
						size="sm"
						containerClass="ml-1 inline-block"
					/>
				{:else}
					<span class="ml-1 text-secondary">{selectedCalendar.name}</span>
				{/if}
			</div>

			{#if resolved}
				<div class="mb-2 text-center font-medium text-body">
					{resolved.day} {resolved.month_name}, {resolved.year_display}
				</div>
			{/if}

			<CalendarWidget
				config={selectedCalendar}
				year={currentDate?.year}
				monthIndex={currentDate ? currentDate.month - 1 : undefined}
			/>
		</div>
	{/if}
</div>
