<script lang="ts">
	import { untrack } from 'svelte'
	import type { MapBody } from './system-layout.js'
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
		system,
		stars,
		bodies,
		systemSlug,
		calendars = [],
		currentAbsoluteDay = $bindable(0),
		selectedBody = null,
	}: {
		system: {
			name: string
			distanceLy?: number | null
			formationAge?: string | null
			designations?: string | null
		}
		stars: MapBody[]
		bodies: MapBody[]
		systemSlug: string
		calendars?: (CalendarConfig & { id: number })[]
		currentAbsoluteDay?: number
		selectedBody?: MapBody | null
	} = $props()

	let selectedCalendarId = $state(untrack(() => calendars[0]?.id ?? 0))
	const selectedCalendar = $derived(calendars.find(c => c.id === selectedCalendarId) ?? calendars[0])
	const currentDate = $derived(selectedCalendar ? dateFromAbsolute(selectedCalendar.static_data, currentAbsoluteDay) : null)
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
	<!-- System metadata -->
	<div>
		<div class="text-xs font-semibold text-secondary uppercase tracking-wider border-b border-border-subtle pb-1 mb-2">System</div>
		<div class="space-y-1.5 text-secondary">
			<div class="flex justify-between">
				<span>Type</span>
				<span class="text-body font-medium">{typeLabel[systemType] ?? systemType}</span>
			</div>
			<div class="flex justify-between">
				<span>Stars</span>
				<span class="text-body font-medium">{stars.length}</span>
			</div>
			{#if totalBodies > 0}
				<div class="flex justify-between">
					<span>Bodies</span>
					<span class="text-body font-medium">{totalBodies}</span>
				</div>
			{/if}
			{#if system.distanceLy != null}
				<div class="flex justify-between">
					<span>Distance</span>
					<span class="text-body font-medium">{system.distanceLy.toLocaleString('en-US', { maximumFractionDigits: 2 })} ly</span>
				</div>
			{/if}
			{#if system.formationAge}
				<div class="flex justify-between gap-4">
					<span>Age</span>
					<span class="text-body font-medium text-right">{system.formationAge}</span>
				</div>
			{/if}
			{#if system.designations}
				<div class="flex justify-between gap-4">
					<span>Designations</span>
					<span class="text-body font-medium text-right">{system.designations}</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Selected body detail -->
	{#if selectedBody}
		<div>
			<div class="text-xs font-semibold text-secondary uppercase tracking-wider border-b border-border-subtle pb-1 mb-2">Selected</div>
			<div class="space-y-1.5">
				<div class="font-medium text-heading">{selectedBody.name}</div>
				<div class="space-y-1 text-secondary text-xs">
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
					href="/Celestial:{selectedBody.slug}"
					class="block text-link text-xs mt-2 transition-colors hover:text-link-hover"
				>View details</a>
			</div>
		</div>
	{/if}

	<!-- Body list -->
	<div>
		<div class="text-xs font-semibold text-secondary uppercase tracking-wider border-b border-border-subtle pb-1 mb-2">Bodies</div>
		<div class="space-y-0.5">
			{#each stars as star (star.id)}
				{@const isPrimary = !star.parentStarId}
				<a
					href="/Celestial:{star.slug}"
					class="flex items-center gap-2 px-1.5 py-1 transition-colors hover:bg-raised"
				>
					<Star
						size={16}
						weight={isPrimary ? 'fill' : 'regular'}
						class="shrink-0"
						color={resolveColor(star.color, '#FFE088')}
					/>
					<span class="text-body font-medium">{star.name}</span>
					{#if star.spectralType}
						<span class="text-secondary text-xs">({star.spectralType})</span>
					{/if}
				</a>

				<!-- Planets under this star -->
				{#each planetsForStar(star.id) as planet (planet.id)}
					{@const PlanetIcon = bodyIcon(planet.bodyType, !!planet.parentId)}
					<a
						href="/Celestial:{planet.slug}"
						class="flex items-center gap-2 px-1.5 py-1 ml-4 transition-colors hover:bg-raised"
					>
						<PlanetIcon
							size={14}
							weight="fill"
							class="shrink-0"
							color={resolveColor(planet.color, 'var(--color-secondary)')}
						/>
						<span class="text-body">{planet.name}</span>
						<span class="text-secondary text-xs">({planet.parentId ? 'satellite' : planet.bodyType})</span>
					</a>

					<!-- Moons -->
					{#each moonsForBody(planet.id) as moon (moon.id)}
						<a
							href="/Celestial:{moon.slug}"
							class="flex items-center gap-2 px-1.5 py-0.5 ml-8 transition-colors hover:bg-raised"
						>
							<Moon size={12} weight="fill" class="shrink-0 text-dim" />
							<span class="text-secondary text-xs">{moon.name}</span>
						</a>
					{/each}
				{/each}
			{/each}
		</div>
	</div>

	<!-- Calendar / Time -->
	{#if calendars.length > 0 && selectedCalendar}
		<div>
			<div class="text-xs font-semibold text-secondary uppercase tracking-wider border-b border-border-subtle pb-1 mb-2">
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
					<span class="text-secondary ml-1">{selectedCalendar.name}</span>
				{/if}
			</div>

			{#if resolved}
				<div class="text-body font-medium text-center mb-2">
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
