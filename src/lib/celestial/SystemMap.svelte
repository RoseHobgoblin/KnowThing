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
	import type { ScaleMode, LabelMode, TrailMode } from './map-settings.js'

	let {
		systemName,
		stars,
		bodies,
		currentAbsoluteDay,
		scale = 'compressed',
		labels = 'major',
		trails = 'off',
		follow = false,
		selectedId = $bindable(null),
	}: {
		systemName: string
		stars: MapBody[]
		bodies: MapBody[]
		currentAbsoluteDay?: number | null
		scale?: ScaleMode
		labels?: LabelMode
		trails?: TrailMode
		follow?: boolean
		selectedId?: number | null
	} = $props()

	let hovered = $state<MapBody | null>(null)
	let hoveredPos = $state({ x: 0, y: 0 })

	const SIZE = 800
	const CENTER = SIZE / 2
	const PADDING = 80

	// --- Data model ---
	const primaryStar = $derived(stars.find(s => !s.parentStarId) ?? stars[0])
	const companionStars = $derived(stars.filter(s => s.parentStarId))

	type OrbitBody = MapBody & { orbitAu: number, ecc: number, isStar: boolean }

	// Direct orbiters of the system center (companion stars + planets orbiting star directly)
	const directOrbiters = $derived.by(() => {
		const all: OrbitBody[] = []
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

	// Satellites grouped by parent
	function satellitesOf(parentId: number): OrbitBody[] {
		return bodies
			.filter(b => b.parentId === parentId && b.semiMajorAxisAu)
			.map(b => ({ ...b, orbitAu: b.semiMajorAxisAu!, ecc: b.eccentricity ?? 0, isStar: false }))
			.sort((a, b) => a.orbitAu - b.orbitAu)
	}

	// --- Selection helpers ---
	// "Family" of a selection: the selected body + its parent + its children
	const selectionFamily = $derived.by(() => {
		if (selectedId == null) return new Set<number>()
		const ids = new Set<number>([selectedId])
		// Add parent
		const sel = [...stars, ...bodies].find(b => b.id === selectedId)
		if (sel?.parentId) ids.add(sel.parentId)
		if (sel?.starId) ids.add(sel.starId)
		// Add children (satellites)
		for (const b of bodies) {
			if (b.parentId === selectedId) ids.add(b.id)
		}
		return ids
	})

	function isInFamily(id: number): boolean {
		return selectionFamily.has(id)
	}

	// --- Scale ---
	const maxAu = $derived(Math.max(...directOrbiters.map(b => b.orbitAu), 1))
	const maxVisualRadius = $derived(CENTER - PADDING)

	function auToPixels(au: number): number {
		if (maxAu <= 0) return 0
		switch (scale) {
			case 'realistic':
				return (au / maxAu) * maxVisualRadius
			case 'logarithmic':
				return (Math.log10(1 + au * 9 / maxAu)) * maxVisualRadius
			case 'compressed':
			default:
				return (Math.sqrt(au / maxAu)) * maxVisualRadius
		}
	}

	function bodyRadius(body: { isStar: boolean, parentId?: number | null }): number {
		if (body.isStar) return 6
		if (body.parentId) return 2.5
		return 4
	}

	// --- Positioning ---
	function computeAngle(body: OrbitBody, index: number, total: number): number {
		if (currentAbsoluteDay != null && body.orbitAu > 0) {
			const periodDays = body.orbitalPeriodDays ?? (body.orbitAu * 365.25)
			return orbitalAngle(periodDays, body.epochPhase ?? 0, currentAbsoluteDay)
		}
		return (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2
	}

	function ellipsePosition(a: number, b: number, ecc: number, angle: number, cx: number, cy: number) {
		const offset = a * ecc
		return { x: cx - offset + a * Math.cos(angle), y: cy + b * Math.sin(angle) }
	}

	// Precomputed positions for direct orbiters
	const directPositions = $derived(directOrbiters.map((body, i) => {
		const a = auToPixels(body.orbitAu)
		const b = a * Math.sqrt(1 - body.ecc * body.ecc)
		const angle = computeAngle(body, i, directOrbiters.length)
		const pos = ellipsePosition(a, b, body.ecc, angle, CENTER, CENTER)
		return { body, a, b, angle, ...pos }
	}))

	// --- Follow / camera offset ---
	const cameraOffset = $derived.by(() => {
		if (!follow || selectedId == null) return { x: 0, y: 0 }

		// Check if selection is a direct orbiter
		const direct = directPositions.find(p => p.body.id === selectedId)
		if (direct) return { x: CENTER - direct.x, y: CENTER - direct.y }

		// Check if selection is a satellite — find its parent's position
		const sel = bodies.find(b => b.id === selectedId)
		if (sel?.parentId) {
			const parentPos = directPositions.find(p => p.body.id === sel.parentId)
			if (parentPos) {
				// Satellite position relative to parent
				const sats = satellitesOf(sel.parentId)
				const satIdx = sats.findIndex(s => s.id === selectedId)
				if (satIdx >= 0) {
					const sat = sats[satIdx]
					const satA = Math.max(12 + satIdx * 8, 12)
					const satB = satA * Math.sqrt(1 - sat.ecc * sat.ecc)
					const satAngle = computeAngle(sat, satIdx, sats.length)
					const satPos = ellipsePosition(satA, satB, sat.ecc, satAngle, parentPos.x, parentPos.y)
					return { x: CENTER - satPos.x, y: CENTER - satPos.y }
				}
			}
		}

		// Selected star at center
		if (stars.find(s => s.id === selectedId && !s.parentStarId)) return { x: 0, y: 0 }

		return { x: 0, y: 0 }
	})

	// --- Trail paths ---
	function trailPath(a: number, b: number, ecc: number, angle: number, cx: number, cy: number): string {
		const offset = a * ecc
		if (trails === 'full') {
			return `M ${cx - offset + a},${cy} A ${a},${b} 0 1 1 ${cx - offset + a - 0.001},${cy}`
		}
		const steps = 32
		const span = Math.PI * 0.5
		const pts: string[] = []
		for (let i = 0; i <= steps; i++) {
			const t = angle - (i / steps) * span
			const px = cx - offset + a * Math.cos(t)
			const py = cy + b * Math.sin(t)
			pts.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)}`)
		}
		return pts.join(' ')
	}

	// --- Label visibility ---
	function showLabel(body: MapBody & { isStar: boolean }, isSelected: boolean): boolean {
		switch (labels) {
			case 'off': return false
			case 'hovered': return hovered?.id === body.id
			case 'major':
				if (body.isStar) return true
				if (!body.parentId) return true
				if (isSelected) return true
				if (hovered?.id === body.id) return true
				return false
			case 'all': return true
		}
	}

	// --- Orbit stroke style ---
	function orbitStroke(bodyId: number, isSelected: boolean): { color: string, width: number } {
		if (isSelected) return { color: 'var(--color-accent)', width: 2.5 }
		if (selectedId != null && isInFamily(bodyId)) return { color: 'var(--color-accent-light)', width: 1.5 }
		if (hovered?.id === bodyId) return { color: 'var(--color-accent)', width: 1.5 }
		return { color: 'color-mix(in srgb, var(--color-accent-light) 15%, transparent)', width: 1 }
	}

	// --- Body fill opacity (dim non-family when something is selected) ---
	function bodyOpacity(bodyId: number): number {
		if (selectedId == null) return 1
		if (bodyId === selectedId || isInFamily(bodyId)) return 1
		return 0.35
	}

	// --- Interaction ---
	function handleSelect(body: MapBody) {
		selectedId = selectedId === body.id ? null : body.id
	}

	function handleBackgroundClick() {
		selectedId = null
	}

	function handleHover(body: MapBody, pos: { x: number, y: number }) {
		hovered = body
		hoveredPos = pos
	}

	// Tooltip
	const tipWidth = 160
	const tipHeight = 50
	const tipRight = $derived(hoveredPos.x + cameraOffset.x + 16 + tipWidth < SIZE)
	const tipX = $derived(tipRight ? hoveredPos.x + cameraOffset.x + 16 : hoveredPos.x + cameraOffset.x - tipWidth - 16)
	const tipY = $derived(Math.min(Math.max(hoveredPos.y + cameraOffset.y - tipHeight / 2, 4), SIZE - tipHeight - 4))

	const glowId = 'star-glow'

	// Satellite ring radius around a parent body (pixels, not AU-scaled)
	const SAT_BASE_R = 14
	const SAT_STEP = 8
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
	viewBox="0 0 {SIZE} {SIZE}"
	class="w-full max-w-2xl mx-auto bg-page"
	role="img"
	aria-label="System map of {systemName}"
	onmouseleave={() => hovered = null}
	onclick={handleBackgroundClick}
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

	<g transform="translate({cameraOffset.x},{cameraOffset.y})">
		<!-- Orbital ellipses for direct orbiters -->
		{#each directPositions as dp (dp.body.id)}
			{@const orbit = orbitStroke(dp.body.id, dp.body.id === selectedId)}
			{@const offset = dp.a * dp.body.ecc}
			<ellipse
				cx={CENTER - offset}
				cy={CENTER}
				rx={dp.a}
				ry={dp.b}
				fill="none"
				stroke={orbit.color}
				stroke-width={orbit.width}
				stroke-dasharray={dp.body.isStar ? '4 3' : 'none'}
				opacity={bodyOpacity(dp.body.id)}
				class="transition-all duration-150"
			/>
		{/each}

		<!-- Trails -->
		{#if trails !== 'off' && currentAbsoluteDay != null}
			{#each directPositions as dp (dp.body.id)}
				<path
					d={trailPath(dp.a, dp.b, dp.body.ecc, dp.angle, CENTER, CENTER)}
					fill="none"
					stroke={resolveColor(dp.body.color, dp.body.isStar ? '#FFE088' : 'var(--color-accent-light)')}
					stroke-width={1}
					stroke-opacity={0.4 * bodyOpacity(dp.body.id)}
					stroke-linecap="round"
				/>
			{/each}
		{/if}

		<!-- Star glow -->
		{#if primaryStar}
			<circle cx={CENTER} cy={CENTER} r={CENTER * 0.85} fill="url(#{glowId}-ambient)" />
			<circle cx={CENTER} cy={CENTER} r={50} fill="url(#{glowId}-inner)" />
		{/if}

		<!-- Primary star body -->
		{#if primaryStar}
			{@const isSelected = primaryStar.id === selectedId}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<circle
				cx={CENTER}
				cy={CENTER}
				r={10}
				fill={resolveColor(primaryStar.color, '#FFE088')}
				stroke={isSelected ? 'var(--color-accent)' : 'none'}
				stroke-width={isSelected ? 2.5 : 0}
				opacity={bodyOpacity(primaryStar.id)}
				class="cursor-pointer"
				onmouseenter={() => handleHover(primaryStar, { x: CENTER, y: CENTER - 16 })}
				onmouseleave={() => hovered = null}
				onclick={(e) => { e.stopPropagation(); handleSelect(primaryStar) }}
			/>
			{#if showLabel({ ...primaryStar, isStar: true }, isSelected)}
				<text
					x={CENTER}
					y={CENTER + 22}
					text-anchor="middle"
					fill={isSelected ? 'var(--color-accent)' : 'var(--color-secondary)'}
					font-size="10"
					font-weight={isSelected ? '600' : '400'}
					font-family="var(--font-body)"
					class="pointer-events-none"
				>{primaryStar.name}</text>
			{/if}
		{/if}

		<!-- Direct orbiters + their satellites -->
		{#each directPositions as dp (dp.body.id)}
			{@const r = bodyRadius(dp.body)}
			{@const isSelected = dp.body.id === selectedId}
			{@const sats = satellitesOf(dp.body.id)}

			<!-- Companion star glow -->
			{#if dp.body.isStar}
				{@const compIdx = companionStars.findIndex(s => s.id === dp.body.id)}
				{#if compIdx >= 0}
					<circle cx={dp.x} cy={dp.y} r={30} fill="url(#{glowId}-comp-{compIdx})" opacity={bodyOpacity(dp.body.id)} />
				{/if}
			{/if}

			<!-- Body circle -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<circle
				cx={dp.x}
				cy={dp.y}
				{r}
				fill={resolveColor(dp.body.color, dp.body.isStar ? '#FFE088' : 'var(--color-secondary)')}
				stroke={isSelected ? 'var(--color-accent)' : 'none'}
				stroke-width={isSelected ? 2.5 : 0}
				opacity={bodyOpacity(dp.body.id)}
				class="cursor-pointer"
				onmouseenter={() => handleHover(dp.body, { x: dp.x, y: dp.y })}
				onmouseleave={() => hovered = null}
				onclick={(e) => { e.stopPropagation(); handleSelect(dp.body) }}
			/>

			<!-- Label -->
			{#if showLabel(dp.body, isSelected)}
				<text
					x={dp.x}
					y={dp.y + r + 12}
					text-anchor="middle"
					fill={isSelected ? 'var(--color-accent)' : hovered?.id === dp.body.id ? 'var(--color-heading)' : 'var(--color-dim)'}
					font-size="9"
					font-weight={isSelected ? '600' : '400'}
					font-family="var(--font-body)"
					opacity={bodyOpacity(dp.body.id)}
					class="transition-colors pointer-events-none"
				>{dp.body.name}</text>
			{/if}

			<!-- Satellites rendered as small dots around the parent body -->
			{#each sats as sat, si (sat.id)}
				{@const satR = SAT_BASE_R + si * SAT_STEP}
				{@const satAngle = computeAngle(sat, si, sats.length)}
				{@const satX = dp.x + satR * Math.cos(satAngle)}
				{@const satY = dp.y + satR * Math.sin(satAngle)}
				{@const satIsSelected = sat.id === selectedId}

				<!-- Satellite orbit ring (subtle) -->
				<circle
					cx={dp.x}
					cy={dp.y}
					r={satR}
					fill="none"
					stroke={satIsSelected ? 'var(--color-accent)' : isInFamily(sat.id) ? 'var(--color-accent-light)' : 'color-mix(in srgb, var(--color-secondary) 15%, transparent)'}
					stroke-width={satIsSelected ? 1.5 : 0.5}
					opacity={bodyOpacity(sat.id)}
					class="transition-all duration-150"
				/>

				<!-- Satellite body -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<circle
					cx={satX}
					cy={satY}
					r={2.5}
					fill={resolveColor(sat.color, 'var(--color-dim)')}
					stroke={satIsSelected ? 'var(--color-accent)' : 'none'}
					stroke-width={satIsSelected ? 2 : 0}
					opacity={bodyOpacity(sat.id)}
					class="cursor-pointer"
					onmouseenter={() => handleHover(sat, { x: satX, y: satY })}
					onmouseleave={() => hovered = null}
					onclick={(e) => { e.stopPropagation(); handleSelect(sat) }}
				/>

				<!-- Satellite label (only when selected, hovered, or labels=all) -->
				{#if satIsSelected || hovered?.id === sat.id || labels === 'all'}
					<text
						x={satX}
						y={satY + 8}
						text-anchor="middle"
						fill={satIsSelected ? 'var(--color-accent)' : 'var(--color-dim)'}
						font-size="7"
						font-weight={satIsSelected ? '600' : '400'}
						font-family="var(--font-body)"
						opacity={bodyOpacity(sat.id)}
						class="pointer-events-none"
					>{sat.name}</text>
				{/if}
			{/each}
		{/each}
	</g>

	<!-- Tooltip -->
	{#if hovered}
		<foreignObject x={tipX} y={tipY} width={tipWidth} height={tipHeight}>
			<div class="bg-surface border border-accent/30 px-2.5 py-1.5 shadow-lg">
				<div class="font-semibold text-heading text-xs whitespace-nowrap">
					{hovered.name}
					{#if hovered.spectralType}
						<span class="text-faint font-normal">({hovered.spectralType})</span>
					{/if}
				</div>
				{#if hovered.semiMajorAxisAu}
					<div class="text-faint text-[10px]">{hovered.semiMajorAxisAu.toFixed(3)} AU</div>
				{/if}
			</div>
		</foreignObject>
	{/if}
</svg>
