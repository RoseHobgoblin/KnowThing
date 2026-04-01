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
		spectralType?: string | null
		starId?: number | null
		parentId?: number | null
		orbitalPeriodDays?: number | null
		epochPhase?: number | null
	}
</script>

<script lang="ts">
	import { resolveColor } from './colors.js'
	import { orbitalAngle } from './orbit.js'
	import type { ScaleMode, LabelMode, TrailMode, CenterTarget } from './map-settings.js'

	let {
		systemName,
		stars,
		bodies,
		currentAbsoluteDay,
		scale = 'compressed',
		labels = 'major',
		trails = 'off',
		centerOn = 'system',
		followSelection = false,
		selectedId = $bindable(null),
	}: {
		systemName: string
		stars: MapBody[]
		bodies: MapBody[]
		currentAbsoluteDay?: number | null
		scale?: ScaleMode
		labels?: LabelMode
		trails?: TrailMode
		centerOn?: CenterTarget
		followSelection?: boolean
		selectedId?: number | null
	} = $props()

	let hovered = $state<(MapBody & { isStar: boolean }) | null>(null)
	let hoveredPos = $state({ x: 0, y: 0 })

	const SIZE = 800
	const CENTER = SIZE / 2
	const PADDING = 80

	// Primary star is the one with no parentStarId
	const primaryStar = $derived(stars.find(s => !s.parentStarId) ?? stars[0])
	const companionStars = $derived(stars.filter(s => s.parentStarId))

	// All orbiting bodies: companion stars + direct orbiters (not satellites)
	const orbitingBodies = $derived.by(() => {
		const all: (MapBody & { orbitAu: number, ecc: number, isStar: boolean })[] = []

		for (const star of companionStars) {
			if (star.semiMajorAxisAu) {
				all.push({ ...star, orbitAu: star.semiMajorAxisAu, ecc: star.eccentricity ?? 0, isStar: true })
			}
		}

		for (const body of bodies) {
			if (body.semiMajorAxisAu && !body.parentId) {
				all.push({ ...body, orbitAu: body.semiMajorAxisAu, ecc: body.eccentricity ?? 0, isStar: false })
			}
		}

		return all.sort((a, b) => a.orbitAu - b.orbitAu)
	})

	// --- Scale functions ---
	const maxAu = $derived(Math.max(...orbitingBodies.map(b => b.orbitAu), 1))
	const maxEcc = $derived(Math.max(...orbitingBodies.map(b => b.ecc), 0))
	const maxVisualRadius = $derived((CENTER - PADDING) / (1 + maxEcc * 0.5))

	function auToPixels(au: number): number {
		switch (scale) {
			case 'realistic':
				return (au / maxAu) * maxVisualRadius
			case 'logarithmic':
				return maxAu > 1
					? (Math.log10(1 + au * 9 / maxAu) / Math.log10(10)) * maxVisualRadius
					: (au / maxAu) * maxVisualRadius
			case 'compressed':
			default:
				return (Math.sqrt(au) / Math.sqrt(maxAu)) * maxVisualRadius
		}
	}

	// Body sizes by type
	function bodyRadius(body: { isStar: boolean, bodyType: string, parentId?: number | null }): number {
		if (body.isStar) return 6
		if (body.parentId) return 2
		switch (body.bodyType) {
			case 'planet': return 4
			default: return 3
		}
	}

	// Position a body on its orbit
	function bodyPosition(body: MapBody & { orbitAu: number, ecc: number }, index: number, total: number) {
		const a = auToPixels(body.orbitAu)
		const b = a * Math.sqrt(1 - body.ecc * body.ecc)
		const offset = a * body.ecc

		let angle: number
		if (currentAbsoluteDay != null && body.orbitAu > 0) {
			const periodDays = body.orbitalPeriodDays ?? (body.orbitAu * 365.25)
			const phase = body.epochPhase ?? 0
			angle = orbitalAngle(periodDays, phase, currentAbsoluteDay)
		} else {
			angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2
		}

		return { x: CENTER - offset + a * Math.cos(angle), y: CENTER + b * Math.sin(angle), a, b, offset, angle }
	}

	// --- Trail path generation ---
	function trailPath(body: MapBody & { orbitAu: number, ecc: number }, currentAngle: number): string {
		const a = auToPixels(body.orbitAu)
		const b = a * Math.sqrt(1 - body.ecc * body.ecc)
		const offset = a * body.ecc

		if (trails === 'full') {
			// Full ellipse
			return `M ${CENTER - offset + a},${CENTER} A ${a},${b} 0 1 1 ${CENTER - offset + a - 0.001},${CENTER}`
		}

		// Short trail: ~25% of orbit behind the body
		const steps = 32
		const arcSpan = Math.PI * 0.5
		const points: string[] = []
		for (let i = 0; i <= steps; i++) {
			const t = currentAngle - (i / steps) * arcSpan
			const px = CENTER - offset + a * Math.cos(t)
			const py = CENTER + b * Math.sin(t)
			points.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)}`)
		}
		return points.join(' ')
	}

	// --- Label visibility ---
	function showLabel(body: MapBody & { isStar: boolean }, isSelected: boolean): boolean {
		switch (labels) {
			case 'off': return false
			case 'hovered': return hovered?.id === body.id
			case 'major':
				// Stars, direct planets, and selected body always labeled
				if (body.isStar) return true
				if (!body.parentId) return true
				if (isSelected) return true
				if (hovered?.id === body.id) return true
				return false
			case 'all': return true
		}
	}

	// --- Center/follow offset ---
	const viewOffset = $derived.by(() => {
		if (centerOn === 'system' || centerOn === 'star') {
			// Both center on the primary star at the origin
			return { x: 0, y: 0 }
		}

		if (centerOn === 'selection' && selectedId != null) {
			const body = orbitingBodies.find(b => b.id === selectedId)
			if (body) {
				const idx = orbitingBodies.indexOf(body)
				const pos = bodyPosition(body, idx, orbitingBodies.length)
				return { x: CENTER - pos.x, y: CENTER - pos.y }
			}
		}

		return { x: 0, y: 0 }
	})

	// Follow selection: recenter on selected body
	const effectiveOffset = $derived(followSelection && selectedId != null ? viewOffset : (centerOn === 'selection' ? viewOffset : { x: 0, y: 0 }))

	// --- Interaction ---
	function handleSelect(body: MapBody) {
		selectedId = selectedId === body.id ? null : body.id
	}

	function handleHover(body: MapBody & { isStar: boolean }, pos: { x: number, y: number }) {
		hovered = body
		hoveredPos = pos
	}

	const tipWidth = 160
	const tipHeight = 50
	const tipRight = $derived(hoveredPos.x + effectiveOffset.x + 16 + tipWidth < SIZE)
	const tipX = $derived(tipRight ? hoveredPos.x + effectiveOffset.x + 16 : hoveredPos.x + effectiveOffset.x - tipWidth - 16)
	const tipY = $derived(Math.min(Math.max(hoveredPos.y + effectiveOffset.y - tipHeight / 2, 4), SIZE - tipHeight - 4))

	const glowId = 'star-glow'
</script>

<svg
	viewBox="0 0 {SIZE} {SIZE}"
	class="w-full max-w-2xl mx-auto bg-page"
	role="img"
	aria-label="System map of {systemName}"
	onmouseleave={() => hovered = null}
>
	<defs>
		<radialGradient id="{glowId}-inner">
			<stop offset="0%" stop-color={resolveColor(primaryStar?.color, '#FFE088')} stop-opacity="0.4" />
			<stop offset="30%" stop-color={resolveColor(primaryStar?.color, '#FFE088')} stop-opacity="0.15" />
			<stop offset="100%" stop-color={resolveColor(primaryStar?.color, '#FFE088')} stop-opacity="0" />
		</radialGradient>
		<radialGradient id="{glowId}-ambient">
			<stop offset="0%" stop-color={resolveColor(primaryStar?.color, '#FFE088')} stop-opacity="0.06" />
			<stop offset="40%" stop-color={resolveColor(primaryStar?.color, '#FFE088')} stop-opacity="0.02" />
			<stop offset="100%" stop-color={resolveColor(primaryStar?.color, '#FFE088')} stop-opacity="0" />
		</radialGradient>
		{#each companionStars as cStar, i (cStar.id)}
			{@const cColor = resolveColor(cStar.color, '#FFE088')}
			<radialGradient id="{glowId}-comp-{i}">
				<stop offset="0%" stop-color={cColor} stop-opacity="0.3" />
				<stop offset="30%" stop-color={cColor} stop-opacity="0.1" />
				<stop offset="100%" stop-color={cColor} stop-opacity="0" />
			</radialGradient>
		{/each}
	</defs>

	<g transform="translate({effectiveOffset.x},{effectiveOffset.y})">
		<!-- Orbital paths -->
		{#each orbitingBodies as body}
			{@const a = auToPixels(body.orbitAu)}
			{@const b = a * Math.sqrt(1 - body.ecc * body.ecc)}
			{@const offset = a * body.ecc}
			{@const isSelected = body.id === selectedId}
			<ellipse
				cx={CENTER - offset}
				cy={CENTER}
				rx={a}
				ry={b}
				fill="none"
				stroke={isSelected ? 'var(--color-accent)' : hovered?.id === body.id ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-accent-light) 15%, transparent)'}
				stroke-width={isSelected ? 2 : hovered?.id === body.id ? 1.5 : 1}
				stroke-dasharray={body.isStar ? '4 3' : 'none'}
				class="transition-colors"
			/>
		{/each}

		<!-- Trails -->
		{#if trails !== 'off' && currentAbsoluteDay != null}
			{#each orbitingBodies as body, i}
				{@const pos = bodyPosition(body, i, orbitingBodies.length)}
				<path
					d={trailPath(body, pos.angle)}
					fill="none"
					stroke={resolveColor(body.color, body.isStar ? '#FFE088' : 'var(--color-accent-light)')}
					stroke-width={1}
					stroke-opacity={0.4}
					stroke-linecap="round"
				/>
			{/each}
		{/if}

		<!-- Star glow -->
		{#if primaryStar}
			<circle cx={CENTER} cy={CENTER} r={CENTER * 0.85} fill="url(#{glowId}-ambient)" />
			<circle cx={CENTER} cy={CENTER} r={50} fill="url(#{glowId}-inner)" />
		{/if}

		<!-- Primary star -->
		{#if primaryStar}
			{@const isSelected = primaryStar.id === selectedId}
			<circle
				cx={CENTER}
				cy={CENTER}
				r={10}
				fill={resolveColor(primaryStar.color, '#FFE088')}
				stroke={isSelected ? 'var(--color-accent)' : 'none'}
				stroke-width={isSelected ? 2 : 0}
				class="cursor-pointer"
				onmouseenter={() => handleHover({ ...primaryStar, isStar: true }, { x: CENTER, y: CENTER - 16 })}
				onmouseleave={() => hovered = null}
				onclick={() => handleSelect(primaryStar)}
				onkeydown={(e) => { if (e.key === 'Enter') handleSelect(primaryStar) }}
				role="button"
				tabindex="0"
			/>
			{#if showLabel({ ...primaryStar, isStar: true }, isSelected)}
				<text
					x={CENTER}
					y={CENTER + 22}
					text-anchor="middle"
					fill={isSelected ? 'var(--color-accent)' : 'var(--color-secondary)'}
					font-size="10"
					font-family="var(--font-body)"
					class="pointer-events-none"
				>{primaryStar.name}</text>
			{/if}
		{/if}

		<!-- Orbiting bodies -->
		{#each orbitingBodies as body, i}
			{@const pos = bodyPosition(body, i, orbitingBodies.length)}
			{@const r = bodyRadius(body)}
			{@const isSelected = body.id === selectedId}

			<!-- Companion star glow -->
			{#if body.isStar}
				{@const compIdx = companionStars.findIndex(s => s.id === body.id)}
				{#if compIdx >= 0}
					<circle cx={pos.x} cy={pos.y} r={30} fill="url(#{glowId}-comp-{compIdx})" />
				{/if}
			{/if}

			<circle
				cx={pos.x}
				cy={pos.y}
				{r}
				fill={resolveColor(body.color, body.isStar ? '#FFE088' : 'var(--color-secondary)')}
				stroke={isSelected ? 'var(--color-accent)' : 'none'}
				stroke-width={isSelected ? 2 : 0}
				class="cursor-pointer"
				onmouseenter={() => handleHover(body, { x: pos.x, y: pos.y })}
				onmouseleave={() => hovered = null}
				onclick={() => handleSelect(body)}
				onkeydown={(e) => { if (e.key === 'Enter') handleSelect(body) }}
				role="button"
				tabindex="0"
			/>

			{#if showLabel(body, isSelected)}
				<text
					x={pos.x}
					y={pos.y + r + 12}
					text-anchor="middle"
					fill={isSelected ? 'var(--color-accent)' : hovered?.id === body.id ? 'var(--color-heading)' : 'var(--color-dim)'}
					font-size="9"
					font-family="var(--font-body)"
					class="transition-colors pointer-events-none"
				>{body.name}</text>
			{/if}

			{#if body.moonCount && body.moonCount > 0 && labels !== 'off'}
				<text
					x={pos.x + r + 4}
					y={pos.y - r}
					fill="var(--color-faint)"
					font-size="7"
					font-family="var(--font-body)"
					class="pointer-events-none"
				>{body.moonCount}&#x263D;</text>
			{/if}
		{/each}
	</g>

	<!-- Tooltip -->
	{#if hovered}
		<foreignObject x={tipX} y={tipY} width={tipWidth} height={tipHeight}>
			<div class="bg-surface border border-accent/30 px-2.5 py-1.5 shadow-lg">
				<div class="font-semibold text-heading text-xs whitespace-nowrap">{hovered.name}{#if hovered.isStar && hovered.spectralType} <span class="text-faint font-normal">({hovered.spectralType})</span>{/if}</div>
				{#if hovered.semiMajorAxisAu}
					<div class="text-faint text-[10px]">{hovered.semiMajorAxisAu.toFixed(3)} AU</div>
				{/if}
			</div>
		</foreignObject>
	{/if}
</svg>
