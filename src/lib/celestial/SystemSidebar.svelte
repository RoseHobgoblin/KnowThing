<script lang="ts">
	import type { MapBody } from './SystemMap.svelte'
	import { resolveColor } from './colors.js'
	import Star from 'phosphor-svelte/lib/Star'
	import Planet from 'phosphor-svelte/lib/Planet'
	import Moon from 'phosphor-svelte/lib/Moon'
	import GlobeSimple from 'phosphor-svelte/lib/GlobeSimple'
	import Asterisk from 'phosphor-svelte/lib/Asterisk'
	import CircleDashed from 'phosphor-svelte/lib/CircleDashed'

	let {
		system,
		stars,
		bodies,
		systemSlug,
	}: {
		system: { name: string, systemType?: string | null, system_type?: string | null }
		stars: MapBody[]
		bodies: MapBody[]
		systemSlug: string
	} = $props()

	const systemType = $derived(system.systemType ?? system.system_type ?? 'single')
	const primaryStar = $derived(stars.find(s => !s.parentStarId) ?? stars[0])

	function planetsForStar(starId: number) {
		return bodies.filter(b => b.starId === starId && !b.parentId)
	}

	function moonsForBody(bodyId: number) {
		return bodies.filter(b => b.parentId === bodyId)
	}

	function bodyIcon(type: string) {
		switch (type) {
			case 'planet': return Planet
			case 'moon': return Moon
			case 'dwarf_planet': return GlobeSimple
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
		<div class="text-[10px] font-semibold text-faint uppercase tracking-wider border-b border-border-subtle pb-1 mb-2">System</div>
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
		</div>
	</div>

	<!-- Body list -->
	<div>
		<div class="text-[10px] font-semibold text-faint uppercase tracking-wider border-b border-border-subtle pb-1 mb-2">Bodies</div>
		<div class="space-y-0.5">
			{#each stars as star (star.id)}
				{@const isPrimary = !star.parentStarId}
				<a
					href="/celestial/{systemSlug}/{star.slug}"
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
						<span class="text-faint text-xs">({star.spectralType})</span>
					{/if}
				</a>

				<!-- Planets under this star -->
				{#each planetsForStar(star.id) as planet (planet.id)}
					<a
						href="/celestial/{systemSlug}/{planet.slug}"
						class="flex items-center gap-2 px-1.5 py-1 ml-4 transition-colors hover:bg-raised"
					>
						<svelte:component
							this={bodyIcon(planet.bodyType)}
							size={14}
							weight="fill"
							class="shrink-0"
							color={resolveColor(planet.color, 'var(--color-secondary)')}
						/>
						<span class="text-body">{planet.name}</span>
						<span class="text-faint text-xs">({planet.bodyType})</span>
					</a>

					<!-- Moons -->
					{#each moonsForBody(planet.id) as moon (moon.id)}
						<a
							href="/celestial/{systemSlug}/{moon.slug}"
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
</div>
