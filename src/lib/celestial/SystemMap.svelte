<script module lang="ts">
	export interface MapBody {
		id: number
		name: string
		slug: string
		bodyType: string
		pageSlug?: string | null
		semiMajorAxisAu?: number | null
		eccentricity?: number | null
		color?: string | null
		moonCount?: number
		parentStarId?: number | null
	}
</script>

<script lang="ts">
	import { goto } from '$app/navigation'

	let {
		systemName,
		stars,
		bodies,
	}: {
		systemName: string
		stars: MapBody[]
		bodies: MapBody[]
	} = $props()

	let hovered = $state<MapBody | null>(null)
	let hoveredPos = $state({ x: 0, y: 0 })

	const SIZE = 800
	const CENTER = SIZE / 2
	const PADDING = 60

	// Primary star is the one with no parentStarId
	const primaryStar = $derived(stars.find(s => !s.parentStarId) ?? stars[0])
	const companionStars = $derived(stars.filter(s => s.parentStarId))

	// All orbiting bodies: companion stars + planets (not moons — too small)
	const orbitingBodies = $derived.by(() => {
		const all: (MapBody & { orbitAu: number, ecc: number, isStar: boolean })[] = []

		for (const star of companionStars) {
			if (star.semiMajorAxisAu) {
				all.push({ ...star, orbitAu: star.semiMajorAxisAu, ecc: star.eccentricity ?? 0, isStar: true })
			}
		}

		for (const body of bodies) {
			if (body.semiMajorAxisAu && !body.parentStarId) {
				all.push({ ...body, orbitAu: body.semiMajorAxisAu, ecc: body.eccentricity ?? 0, isStar: false })
			}
		}

		return all.sort((a, b) => a.orbitAu - b.orbitAu)
	})

	// Sqrt scale: map AU to pixel radius
	const maxAu = $derived(Math.max(...orbitingBodies.map(b => b.orbitAu), 1))
	const maxVisualRadius = CENTER - PADDING

	function auToPixels(au: number): number {
		return (Math.sqrt(au) / Math.sqrt(maxAu)) * maxVisualRadius
	}

	// Body sizes by type
	function bodyRadius(body: MapBody & { isStar: boolean }): number {
		if (body.isStar) return 6
		switch (body.bodyType) {
			case 'planet': return 4
			case 'dwarf_planet': return 2.5
			case 'moon': return 2
			default: return 3
		}
	}

	// Body color with fallbacks
	function bodyColor(body: MapBody & { isStar: boolean }): string {
		if (body.color) return body.color
		if (body.isStar) return 'var(--color-accent)'
		return 'var(--color-secondary)'
	}

	// Position each body on its orbit (spread evenly for visual clarity)
	function bodyPosition(body: MapBody & { isStar: boolean, orbitAu: number, ecc: number }, index: number, total: number) {
		const a = auToPixels(body.orbitAu)
		const b = a * Math.sqrt(1 - body.ecc * body.ecc)
		const offset = a * body.ecc

		// Spread bodies around the orbit — deterministic angle from index
		const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2

		return {
			x: CENTER - offset + a * Math.cos(angle),
			y: CENTER + b * Math.sin(angle),
			a,
			b,
			offset,
		}
	}

	function handleHover(body: MapBody & { isStar: boolean }, pos: { x: number, y: number }) {
		hovered = body
		hoveredPos = pos
	}

	function handleClick(body: MapBody) {
		const target = body.pageSlug ? `/know/${body.pageSlug}` : `/celestial/${body.slug}`
		goto(target)
	}

	// Star glow gradient ID
	const glowId = 'star-glow'
</script>

<svg
	viewBox="0 0 {SIZE} {SIZE}"
	class="w-full max-w-2xl mx-auto"
	role="img"
	aria-label="System map of {systemName}"
	onmouseleave={() => hovered = null}
>
	<defs>
		<!-- Star glow -->
		<radialGradient id={glowId}>
			<stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.3" />
			<stop offset="60%" stop-color="var(--color-accent)" stop-opacity="0.05" />
			<stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0" />
		</radialGradient>
	</defs>

	<!-- Orbital paths -->
	{#each orbitingBodies as body}
		{@const a = auToPixels(body.orbitAu)}
		{@const b = a * Math.sqrt(1 - body.ecc * body.ecc)}
		{@const offset = a * body.ecc}
		<ellipse
			cx={CENTER - offset}
			cy={CENTER}
			rx={a}
			ry={b}
			fill="none"
			stroke={hovered?.id === body.id ? 'var(--color-accent)' : 'var(--color-border)'}
			stroke-width={hovered?.id === body.id ? 1 : 0.5}
			stroke-dasharray={body.isStar ? '4 3' : 'none'}
			class="transition-colors"
		/>
	{/each}

	<!-- Star glow effect -->
	{#if primaryStar}
		<circle cx={CENTER} cy={CENTER} r={40} fill="url(#{glowId})" />
	{/if}

	<!-- Primary star -->
	{#if primaryStar}
		<circle
			cx={CENTER}
			cy={CENTER}
			r={10}
			fill={primaryStar.color || 'var(--color-accent)'}
			class="cursor-pointer"
			onmouseenter={() => handleHover({ ...primaryStar, isStar: true, orbitAu: 0, ecc: 0 }, { x: CENTER, y: CENTER - 20 })}
			onclick={() => handleClick(primaryStar)}
		/>
		<!-- Star label -->
		<text
			x={CENTER}
			y={CENTER + 22}
			text-anchor="middle"
			fill="var(--color-secondary)"
			font-size="10"
			font-family="var(--font-body)"
		>{primaryStar.name}</text>
	{/if}

	<!-- Orbiting bodies -->
	{#each orbitingBodies as body, i}
		{@const pos = bodyPosition(body, i, orbitingBodies.length)}
		{@const r = bodyRadius(body)}

		<!-- Body dot -->
		<circle
			cx={pos.x}
			cy={pos.y}
			{r}
			fill={bodyColor(body)}
			class="cursor-pointer"
			onmouseenter={() => handleHover(body, { x: pos.x, y: pos.y - r - 8 })}
			onclick={() => handleClick(body)}
		/>

		<!-- Label -->
		<text
			x={pos.x}
			y={pos.y + r + 12}
			text-anchor="middle"
			fill={hovered?.id === body.id ? 'var(--color-heading)' : 'var(--color-dim)'}
			font-size="9"
			font-family="var(--font-body)"
			class="transition-colors pointer-events-none"
		>{body.name}</text>

		<!-- Moon count annotation -->
		{#if body.moonCount && body.moonCount > 0}
			<text
				x={pos.x + r + 4}
				y={pos.y - r}
				fill="var(--color-faint)"
				font-size="7"
				font-family="var(--font-body)"
				class="pointer-events-none"
			>{body.moonCount}☽</text>
		{/if}
	{/each}

	<!-- Tooltip -->
	{#if hovered}
		{@const tipWidth = 140}
		{@const tipHeight = 52}
		{@const tipX = Math.min(Math.max(hoveredPos.x - tipWidth / 2, 4), SIZE - tipWidth - 4)}
		{@const tipY = hoveredPos.y - tipHeight - 8}

		<foreignObject x={tipX} y={tipY} width={tipWidth} height={tipHeight}>
			<div class="bg-surface border border-border-strong p-2 text-xs shadow-lg">
				<div class="font-semibold text-heading">{hovered.name}</div>
				<div class="text-dim mt-0.5">
					{hovered.isStar ? 'Star' : hovered.bodyType}
					{#if hovered.orbitAu}
						 · {hovered.orbitAu.toFixed(2)} AU
					{/if}
					{#if hovered.ecc}
						 · e={hovered.ecc.toFixed(2)}
					{/if}
				</div>
			</div>
		</foreignObject>
	{/if}
</svg>
