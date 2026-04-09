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
	import { meanAnomaly, solveKeplerE } from './orbit.js'
	import type { ScaleMode, LabelMode, TrailMode } from './map-settings.js'

	type EntityKey = `star:${number}` | `body:${number}`
	type OrbitBody = MapBody & { orbitAu: number, ecc: number, isStar: boolean, renderAsSatellite: boolean }
	type PositionedOrbit = {
		body: OrbitBody
		a: number
		b: number
		angle: number
		rawX: number
		rawY: number
		x: number
		y: number
	}
	type PositionedSatellite = {
		body: OrbitBody
		parentKey: EntityKey
		orbitRadius: number
		parentRawX: number
		parentRawY: number
		rawX: number
		rawY: number
		parentX: number
		parentY: number
		x: number
		y: number
	}
	type HitTarget = {
		id: EntityKey
		body: MapBody
		x: number
		y: number
		r: number
	}
	type ThemePalette = {
		page: string
		surface: string
		accent: string
		accentLight: string
		secondary: string
		dim: string
		heading: string
		faint: string
	}
	type Scene = {
		primaryStar: MapBody | null
		directPositions: PositionedOrbit[]
		satellitePositions: PositionedSatellite[]
		cameraOffset: { x: number, y: number }
		selectionFamily: Set<EntityKey>
		hitTargets: HitTarget[]
		effectiveMaxAu: number
		auMin: number
		maxVisualRadius: number
	}

	const SIZE = 800
	const CENTER = SIZE / 2
	const PADDING = 80
	const MIN_FIRST_ORBIT = 36
	const MIN_ADJACENT_GAP = 14
	const R_GUARD = 30
	const COMPACT_EXPONENT = 0.4
	const SAT_INNER_MARGIN = 10
	const SAT_MIN_ZONE = 20
	const SAT_MAX_ZONE = 80
	const SAT_ZONE_FRACTION = 0.4
	const LOG_RING_DECADES = [0.01, 0.1, 1, 10, 100, 1000]
	const FONT_STACK = 'Work Sans, ui-sans-serif, system-ui, sans-serif'
	const DEFAULT_THEME: ThemePalette = {
		page: '#12131D',
		surface: '#1A1B26',
		accent: '#FFE088',
		accentLight: '#E9C349',
		secondary: '#A09882',
		dim: '#7A7264',
		heading: '#F0E6D0',
		faint: '#55504A',
	}

	let {
		systemName,
		stars,
		bodies,
		currentAbsoluteDay,
		scale = 'log',
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
		selectedId?: EntityKey | null
	} = $props()

	let containerElement: HTMLDivElement | null = null
	let canvasElement: HTMLCanvasElement | null = null
	let displaySize = $state({ width: SIZE, height: SIZE })
	let theme = $state<ThemePalette>(DEFAULT_THEME)
	let hoveredId = $state<EntityKey | null>(null)
	let hoveredBody = $state<MapBody | null>(null)
	let zoomLevel = $state(1)
	let panOffset = $state({ x: 0, y: 0 })
	let isDragging = $state(false)
	let dragStart: { x: number, y: number, panX: number, panY: number } | null = null
	const isViewMoved = $derived(zoomLevel !== 1 || panOffset.x !== 0 || panOffset.y !== 0)

	function keyForBody(body: MapBody, isStar: boolean): EntityKey {
		return `${isStar ? 'star' : 'body'}:${body.id}` as EntityKey
	}

	function readTheme() {
		if (!containerElement) return
		const style = getComputedStyle(containerElement)
		theme = {
			page: style.getPropertyValue('--color-page').trim() || DEFAULT_THEME.page,
			surface: style.getPropertyValue('--color-surface').trim() || DEFAULT_THEME.surface,
			accent: style.getPropertyValue('--color-accent').trim() || DEFAULT_THEME.accent,
			accentLight: style.getPropertyValue('--color-accent-light').trim() || DEFAULT_THEME.accentLight,
			secondary: style.getPropertyValue('--color-secondary').trim() || DEFAULT_THEME.secondary,
			dim: style.getPropertyValue('--color-dim').trim() || DEFAULT_THEME.dim,
			heading: style.getPropertyValue('--color-heading').trim() || DEFAULT_THEME.heading,
			faint: style.getPropertyValue('--color-faint').trim() || DEFAULT_THEME.faint,
		}
	}

	$effect(() => {
		if (!containerElement) return

		const updateRect = () => {
			const rect = containerElement?.getBoundingClientRect()
			if (!rect) return
			const width = Math.max(1, Math.round(rect.width))
			displaySize = { width, height: width }
			readTheme()
		}

		updateRect()

		const observer = new ResizeObserver(() => updateRect())
		observer.observe(containerElement)

		return () => observer.disconnect()
	})

	function bodyRadius(body: { isStar: boolean, renderAsSatellite?: boolean }) {
		if (body.isStar) return 6
		if (body.renderAsSatellite) return 2.5
		return 4
	}

	function computeAngle(body: OrbitBody, index: number, total: number) {
		if (currentAbsoluteDay != null && body.orbitAu > 0) {
			const periodDays = body.orbitalPeriodDays ?? (body.orbitAu * 365.25)
			const M = meanAnomaly(periodDays, body.epochPhase ?? 0, currentAbsoluteDay)
			return solveKeplerE(M, body.ecc)
		}
		return (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2
	}

	function ellipsePosition(a: number, b: number, ecc: number, angle: number, cx: number, cy: number) {
		const offset = a * ecc
		return { x: cx - offset + a * Math.cos(angle), y: cy + b * Math.sin(angle) }
	}

	function parentKeyForBody(body: MapBody, primaryStarId: number | null, starIds: Set<number>): EntityKey | null {
		if (body.parentId != null) {
			if (starIds.has(body.parentId)) return `star:${body.parentId}` as EntityKey
			return `body:${body.parentId}` as EntityKey
		}
		if (body.starId != null && body.starId !== primaryStarId) return `star:${body.starId}` as EntityKey
		return null
	}

	function buildSelectionFamily(primaryStar: MapBody | null) {
		if (selectedId == null) return new Set<EntityKey>()

		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const ids = new Set<EntityKey>([selectedId])
		const [selectedKind, rawId] = selectedId.split(':')
		const selectedNumericId = Number(rawId)
		const selectedStar = selectedKind === 'star'
			? stars.find(star => star.id === selectedNumericId)
			: null
		const selectedBody = selectedKind === 'body'
			? bodies.find(body => body.id === selectedNumericId)
			: null

		if (selectedStar) {
			for (const body of bodies) {
				if (body.starId === selectedStar.id) {
					ids.add(keyForBody(body, false))
					for (const moon of bodies) {
						if (moon.parentId === body.id) ids.add(keyForBody(moon, false))
					}
				}
			}
			if (!selectedStar.parentStarId && primaryStar) ids.add(keyForBody(primaryStar, true))
			if (selectedStar.parentStarId) {
				const parentStar = stars.find(star => star.id === selectedStar.parentStarId)
				if (parentStar) ids.add(keyForBody(parentStar, true))
			}
			return ids
		}

		if (selectedBody) {
			if (selectedBody.starId) {
				const parentStar = stars.find(star => star.id === selectedBody.starId)
				if (parentStar) ids.add(keyForBody(parentStar, true))
			}
			if (selectedBody.parentId) {
				const parentBody = bodies.find(body => body.id === selectedBody.parentId)
				if (parentBody) ids.add(keyForBody(parentBody, false))
				const parentStar = stars.find(star => star.id === selectedBody.parentId)
				if (parentStar) ids.add(keyForBody(parentStar, true))
			}
			for (const child of bodies) {
				if (child.parentId === selectedBody.id) ids.add(keyForBody(child, false))
			}
		}

		return ids
	}

	function innerBoundaryAu(orbiters: OrbitBody[]): number {
		if (orbiters.length <= 1) return orbiters[0]?.orbitAu ?? 1
		let maxRatio = 0
		let boundaryIndex = Math.ceil(orbiters.length / 2) - 1
		for (let index = 0; index < orbiters.length - 1; index++) {
			const ratio = orbiters[index + 1].orbitAu / Math.max(orbiters[index].orbitAu, 0.001)
			if (ratio > maxRatio) {
				maxRatio = ratio
				boundaryIndex = index
			}
		}
		if (maxRatio < 3) boundaryIndex = Math.ceil(orbiters.length / 2) - 1
		return orbiters[boundaryIndex].orbitAu * 1.5
	}

	function scaleAuToPixel(au: number, auMin: number, auMax: number, rMax: number): number {
		switch (scale) {
			case 'log': {
				if (auMin >= auMax) return (MIN_FIRST_ORBIT + rMax) / 2
				const logMin = Math.log(auMin)
				const logRange = Math.log(auMax) - logMin
				const t = (Math.log(au) - logMin) / logRange
				return MIN_FIRST_ORBIT + t * (rMax - MIN_FIRST_ORBIT)
			}
			case 'proportional':
			case 'inner':
				return R_GUARD + (au / auMax) * (rMax - R_GUARD)
			case 'compact': {
				const t = (au / auMax) ** COMPACT_EXPONENT
				return MIN_FIRST_ORBIT + t * (rMax - MIN_FIRST_ORBIT)
			}
		}
	}

	function enforceMinGaps(radii: number[], rMax: number): number[] {
		const result = [...radii]
		if (result.length === 0) return result

		result[0] = Math.max(result[0], MIN_FIRST_ORBIT)

		for (let index = 1; index < result.length; index++) {
			result[index] = Math.max(result[index], result[index - 1] + MIN_ADJACENT_GAP)
		}

		if (result.at(-1)! > rMax) {
			const factor = rMax / result.at(-1)!
			for (let index = 0; index < result.length; index++) result[index] *= factor
			const reducedGap = MIN_ADJACENT_GAP * factor
			for (let index = 1; index < result.length; index++) {
				result[index] = Math.max(result[index], result[index - 1] + reducedGap)
			}
		}

		return result
	}

	function buildScene(): Scene {
		const primaryStar = stars.find(star => !star.parentStarId) ?? stars[0] ?? null
		const primaryStarId = primaryStar?.id ?? null
		const starIds = new Set(stars.map(star => star.id))
		const companionStars = stars.filter(star => star.parentStarId)
		const directOrbiters: OrbitBody[] = []
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const seen = new Set<EntityKey>()

		const deepCompanionStars: OrbitBody[] = []
		for (const star of companionStars) {
			const key = keyForBody(star, true)
			if (!star.semiMajorAxisAu || seen.has(key)) continue
			if (star.parentStarId === primaryStarId) {
				seen.add(key)
				directOrbiters.push({ ...star, orbitAu: star.semiMajorAxisAu, ecc: star.eccentricity ?? 0, isStar: true, renderAsSatellite: false })
			} else {
				deepCompanionStars.push({ ...star, orbitAu: star.semiMajorAxisAu, ecc: star.eccentricity ?? 0, isStar: true, renderAsSatellite: true })
			}
		}

		for (const body of bodies) {
			const key = keyForBody(body, false)
			const orbitsPrimaryStarDirectly =
				body.semiMajorAxisAu != null
				&& (
					(body.starId != null && body.starId === primaryStarId && body.parentId == null)
					|| body.parentId === primaryStarId
					|| (body.starId == null && body.parentId == null)
				)
			if (orbitsPrimaryStarDirectly && !seen.has(key)) {
				seen.add(key)
				directOrbiters.push({ ...body, orbitAu: body.semiMajorAxisAu!, ecc: body.eccentricity ?? 0, isStar: false, renderAsSatellite: false })
			}
		}

		directOrbiters.sort((a, b) => a.orbitAu - b.orbitAu)

		const maxAu = Math.max(...directOrbiters.map(body => body.orbitAu), 1)
		const outermostEcc = directOrbiters.at(-1)?.ecc ?? 0
		const maxVisualRadius = (CENTER - PADDING) / (1 + outermostEcc)
		const selectionFamily = buildSelectionFamily(primaryStar)

		const effectiveMaxAu = scale === 'inner'
			? innerBoundaryAu(directOrbiters)
			: maxAu

		const visibleOrbiters = scale === 'inner'
			? directOrbiters.filter(body => body.orbitAu <= effectiveMaxAu)
			: directOrbiters

		const auMin = visibleOrbiters[0]?.orbitAu ?? 1
		const rawRadii = visibleOrbiters.map(body =>
			scaleAuToPixel(body.orbitAu, auMin, effectiveMaxAu, maxVisualRadius),
		)
		const finalRadii = enforceMinGaps(rawRadii, maxVisualRadius)

		const rawDirectPositions: PositionedOrbit[] = []
		for (const [index, body] of visibleOrbiters.entries()) {
			const a = finalRadii[index]
			const b = a * Math.sqrt(1 - body.ecc * body.ecc)
			const angle = computeAngle(body, index, visibleOrbiters.length)
			const pos = ellipsePosition(a, b, body.ecc, angle, CENTER, CENTER)
			rawDirectPositions.push({ body, a, b, angle, rawX: pos.x, rawY: pos.y, x: pos.x, y: pos.y })
		}

		if (scale === 'inner') {
			for (const body of directOrbiters) {
				if (body.orbitAu > effectiveMaxAu) {
					const a = maxVisualRadius * 2
					const b = a
					const angle = computeAngle(body, 0, 1)
					const pos = ellipsePosition(a, b, 0, angle, CENTER, CENTER)
					rawDirectPositions.push({ body, a, b, angle, rawX: pos.x, rawY: pos.y, x: pos.x, y: pos.y })
				}
			}
		}

		const rawSatellitePositions: PositionedSatellite[] = []
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const anchorRawPositions = new Map<EntityKey, { x: number, y: number }>()
		if (primaryStar) anchorRawPositions.set(keyForBody(primaryStar, true), { x: CENTER, y: CENTER })
		for (const position of rawDirectPositions) {
			anchorRawPositions.set(keyForBody(position.body, position.body.isStar), { x: position.rawX, y: position.rawY })
		}

		// Build a lookup from entity key to finalRadii index for satellite zone sizing
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const orbiterRadiiByKey = new Map<EntityKey, number>()
		for (const [index, body] of visibleOrbiters.entries()) {
			orbiterRadiiByKey.set(keyForBody(body, body.isStar), finalRadii[index])
		}

		const pendingItems: OrbitBody[] = [
			...deepCompanionStars,
			...bodies
				.filter(body => body.semiMajorAxisAu != null && !seen.has(keyForBody(body, false)))
				.map(body => ({ ...body, orbitAu: body.semiMajorAxisAu!, ecc: body.eccentricity ?? 0, isStar: false, renderAsSatellite: true })),
		]

		while (pendingItems.length > 0) {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const groups = new Map<EntityKey, OrbitBody[]>()
			const unresolved: OrbitBody[] = []

			for (const item of pendingItems) {
				let parentKey: EntityKey | null
				if (item.isStar && item.parentStarId != null) {
					parentKey = `star:${item.parentStarId}` as EntityKey
				} else {
					parentKey = parentKeyForBody(item, primaryStarId, starIds)
				}
				if (!parentKey || !anchorRawPositions.has(parentKey)) {
					unresolved.push(item)
					continue
				}
				const existing = groups.get(parentKey) ?? []
				existing.push(item)
				groups.set(parentKey, existing)
			}

			if (groups.size === 0) break
			pendingItems.length = 0
			pendingItems.push(...unresolved)

			for (const [parentKey, satellites] of groups.entries()) {
				const parentAnchor = anchorRawPositions.get(parentKey)
				if (!parentAnchor) continue

				satellites.sort((a, b) => a.orbitAu - b.orbitAu)

				// Dynamic zone sizing based on gap to nearest neighbour
				const parentR = orbiterRadiiByKey.get(parentKey)
				let zone = SAT_MIN_ZONE
				if (parentR != null) {
					let gapBelow = parentR
					let gapAbove = Infinity
					for (let radiiIndex = 0; radiiIndex < finalRadii.length; radiiIndex++) {
						if (Math.abs(finalRadii[radiiIndex] - parentR) < 0.1) {
							if (radiiIndex > 0) gapBelow = finalRadii[radiiIndex] - finalRadii[radiiIndex - 1]
							if (radiiIndex < finalRadii.length - 1) gapAbove = finalRadii[radiiIndex + 1] - finalRadii[radiiIndex]
							break
						}
					}
					const halfGap = Math.min(gapBelow, gapAbove) * SAT_ZONE_FRACTION
					const minZone = Math.max(SAT_MIN_ZONE, satellites.length * 6)
					zone = Math.min(Math.max(halfGap, minZone), SAT_MAX_ZONE)
				}

				for (const [index, satellite] of satellites.entries()) {
					const t = satellites.length === 1 ? 0.5 : index / (satellites.length - 1)
					const orbitRadius = SAT_INNER_MARGIN + t * (zone - SAT_INNER_MARGIN)

					const angle = computeAngle(satellite, index, satellites.length)
					const x = parentAnchor.x + orbitRadius * Math.cos(angle)
					const y = parentAnchor.y + orbitRadius * Math.sin(angle)
					const key = keyForBody(satellite, satellite.isStar)

					rawSatellitePositions.push({
						body: satellite,
						parentKey,
						orbitRadius,
						parentRawX: parentAnchor.x,
						parentRawY: parentAnchor.y,
						rawX: x,
						rawY: y,
						parentX: parentAnchor.x,
						parentY: parentAnchor.y,
						x,
						y,
					})
					anchorRawPositions.set(key, { x, y })
					seen.add(key)
				}
			}
		}

		let cameraOffset = { x: 0, y: 0 }
		if (follow && selectedId != null) {
			if (primaryStar && keyForBody(primaryStar, true) === selectedId) {
				cameraOffset = { x: 0, y: 0 }
			} else {
				const selectedDirect = rawDirectPositions.find(position => keyForBody(position.body, position.body.isStar) === selectedId)
				const selectedSatellite = rawSatellitePositions.find(position => keyForBody(position.body, position.body.isStar) === selectedId)
				const target = selectedDirect ?? selectedSatellite ?? null
				if (target) {
					cameraOffset = { x: CENTER - target.rawX, y: CENTER - target.rawY }
				}
			}
		}

		const project = (x: number, y: number) => ({
			x: x + cameraOffset.x,
			y: y + cameraOffset.y,
		})

		const directPositions: PositionedOrbit[] = rawDirectPositions.map((position) => {
			const projected = project(position.rawX, position.rawY)
			return { ...position, ...projected }
		})
		const satellitePositions: PositionedSatellite[] = rawSatellitePositions.map((position) => {
			const projected = project(position.rawX, position.rawY)
			const projectedParent = project(position.parentRawX, position.parentRawY)
			return { ...position, ...projected, parentX: projectedParent.x, parentY: projectedParent.y }
		})

		const hitTargets: HitTarget[] = []
		if (primaryStar) {
			const projected = project(CENTER, CENTER)
			hitTargets.push({
				id: keyForBody(primaryStar, true),
				body: primaryStar,
				x: projected.x,
				y: projected.y,
				r: 12,
			})
		}

		for (const position of directPositions) {
			hitTargets.push({
				id: keyForBody(position.body, position.body.isStar),
				body: position.body,
				x: position.x,
				y: position.y,
				r: Math.max(8, bodyRadius(position.body) + 5),
			})
		}

		for (const position of satellitePositions) {
			hitTargets.push({
				id: keyForBody(position.body, position.body.isStar),
				body: position.body,
				x: position.x,
				y: position.y,
				r: 8,
			})
		}

		return {
			primaryStar,
			directPositions,
			satellitePositions,
			cameraOffset,
			selectionFamily,
			hitTargets,
			effectiveMaxAu,
			auMin,
			maxVisualRadius,
		}
	}

	const scene = $derived.by(() => buildScene())

	function isInFamily(id: EntityKey) {
		return scene.selectionFamily.has(id)
	}

	function showLabel(body: MapBody & { isStar: boolean }, isSelected: boolean) {
		const key = keyForBody(body, body.isStar)
		switch (labels) {
			case 'off':
				return false
			case 'hovered':
				return hoveredId === key
			case 'major':
				if (body.isStar) return true
				if (!(body as OrbitBody).renderAsSatellite) return true
				if (isSelected) return true
				if (hoveredId === key) return true
				return false
			case 'all':
				return true
		}
	}

	function bodyOpacity(bodyId: EntityKey) {
		if (selectedId == null) return 1
		if (bodyId === selectedId || isInFamily(bodyId)) return 1
		return 0.35
	}

	function orbitStroke(bodyId: EntityKey, isSelected: boolean) {
		if (isSelected) return { color: theme.accent, width: 2.5, alpha: 1 }
		if (selectedId != null && isInFamily(bodyId)) return { color: theme.accentLight, width: 1.5, alpha: 0.9 }
		if (hoveredId === bodyId) return { color: theme.accent, width: 1.5, alpha: 0.85 }
		return { color: theme.accentLight, width: 1, alpha: 0.22 }
	}

	function drawFullOrbit(ctx: CanvasRenderingContext2D, cx: number, cy: number, a: number, b: number) {
		ctx.beginPath()
		ctx.ellipse(cx, cy, a, b, 0, 0, Math.PI * 2)
		ctx.stroke()
	}

	function drawShortTrail(
		ctx: CanvasRenderingContext2D,
		cx: number,
		cy: number,
		a: number,
		b: number,
		angle: number,
	) {
		const steps = 32
		const span = Math.PI * 0.5
		ctx.beginPath()
		for (let index = 0; index <= steps; index += 1) {
			const theta = angle - (index / steps) * span
			const x = cx + a * Math.cos(theta)
			const y = cy + b * Math.sin(theta)
			if (index === 0) ctx.moveTo(x, y)
			else ctx.lineTo(x, y)
		}
		ctx.stroke()
	}

	function drawLabel(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		text: string,
		color: string,
		fontSize: number,
		fontWeight: number,
		alpha = 1,
	) {
		ctx.save()
		ctx.globalAlpha *= alpha
		ctx.fillStyle = color
		ctx.font = `${fontWeight} ${fontSize}px ${FONT_STACK}`
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(text, x, y)
		ctx.restore()
	}

	function renderMap() {
		if (!canvasElement) return
		const context = canvasElement.getContext('2d')
		if (!context) return

		const dpr = window.devicePixelRatio || 1
		canvasElement.width = Math.round(SIZE * dpr)
		canvasElement.height = Math.round(SIZE * dpr)
		context.setTransform(dpr, 0, 0, dpr, 0, 0)
		context.clearRect(0, 0, SIZE, SIZE)
		context.fillStyle = theme.page
		context.fillRect(0, 0, SIZE, SIZE)

		// Apply zoom/pan transform — all world-space drawing happens inside this block
		context.save()
		context.translate(CENTER, CENTER)
		context.scale(zoomLevel, zoomLevel)
		context.translate(-CENTER + panOffset.x, -CENTER + panOffset.y)

		// Grid of + marks
		{
			const spacing = 80
			const armLength = 3
			const worldLeft = (0 - CENTER) / zoomLevel + CENTER - panOffset.x
			const worldRight = (SIZE - CENTER) / zoomLevel + CENTER - panOffset.x
			const worldTop = (0 - CENTER) / zoomLevel + CENTER - panOffset.y
			const worldBottom = (SIZE - CENTER) / zoomLevel + CENTER - panOffset.y

			context.save()
			context.strokeStyle = theme.faint
			context.lineWidth = 0.5
			context.globalAlpha = 0.15

			const startX = Math.floor(worldLeft / spacing) * spacing
			const startY = Math.floor(worldTop / spacing) * spacing

			for (let gx = startX; gx <= worldRight; gx += spacing) {
				for (let gy = startY; gy <= worldBottom; gy += spacing) {
					context.beginPath()
					context.moveTo(gx - armLength, gy)
					context.lineTo(gx + armLength, gy)
					context.moveTo(gx, gy - armLength)
					context.lineTo(gx, gy + armLength)
					context.stroke()
				}
			}
			context.restore()
		}

		const primaryColor = resolveColor(scene.primaryStar?.color, '#FFE088')

		for (const position of scene.directPositions) {
			const offset = position.a * position.body.ecc
			const key = keyForBody(position.body, position.body.isStar)
			const stroke = orbitStroke(key, key === selectedId)
			context.save()
			context.strokeStyle = stroke.color
			context.lineWidth = stroke.width
			context.globalAlpha = stroke.alpha * bodyOpacity(key)
			if (position.body.isStar) context.setLineDash([4, 3])
			drawFullOrbit(context, CENTER + scene.cameraOffset.x - offset, CENTER + scene.cameraOffset.y, position.a, position.b)
			context.restore()
		}

		if (trails !== 'off' && currentAbsoluteDay != null) {
			for (const position of scene.directPositions) {
				const key = keyForBody(position.body, position.body.isStar)
				context.save()
				context.strokeStyle = resolveColor(position.body.color, position.body.isStar ? '#FFE088' : theme.accentLight)
				context.lineWidth = 1
				context.lineCap = 'round'
				context.globalAlpha = 0.4 * bodyOpacity(key)
				const cx = CENTER + scene.cameraOffset.x - position.a * position.body.ecc
				const cy = CENTER + scene.cameraOffset.y
				if (trails === 'full') drawFullOrbit(context, cx, cy, position.a, position.b)
				else drawShortTrail(context, cx, cy, position.a, position.b, position.angle)
				context.restore()
			}
		}

		if (scene.primaryStar) {
			const centerX = CENTER + scene.cameraOffset.x
			const centerY = CENTER + scene.cameraOffset.y

			const ambient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, CENTER * 0.85)
			ambient.addColorStop(0, `${primaryColor}10`)
			ambient.addColorStop(0.4, `${primaryColor}05`)
			ambient.addColorStop(1, `${primaryColor}00`)
			context.fillStyle = ambient
			context.beginPath()
			context.arc(centerX, centerY, CENTER * 0.85, 0, Math.PI * 2)
			context.fill()

			const inner = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, 40)
			inner.addColorStop(0, `${primaryColor}66`)
			inner.addColorStop(0.3, `${primaryColor}26`)
			inner.addColorStop(1, `${primaryColor}00`)
			context.fillStyle = inner
			context.beginPath()
			context.arc(centerX, centerY, 40, 0, Math.PI * 2)
			context.fill()
		}

		if (scene.primaryStar) {
			const key = keyForBody(scene.primaryStar, true)
			const projected = {
				x: CENTER + scene.cameraOffset.x,
				y: CENTER + scene.cameraOffset.y,
			}
			const isSelected = key === selectedId
			context.save()
			context.globalAlpha = bodyOpacity(key)
			context.fillStyle = primaryColor
			context.beginPath()
			context.arc(projected.x, projected.y, 10, 0, Math.PI * 2)
			context.fill()
			if (isSelected) {
				context.strokeStyle = theme.accent
				context.lineWidth = 2.5
				context.stroke()
			}
			context.restore()

			if (showLabel({ ...scene.primaryStar, isStar: true }, isSelected)) {
				drawLabel(
					context,
					projected.x,
					projected.y + 22,
					scene.primaryStar.name,
					isSelected ? theme.accent : theme.secondary,
					10,
					isSelected ? 600 : 400,
					bodyOpacity(key),
				)
			}
		}

		for (const position of scene.directPositions) {
			const key = keyForBody(position.body, position.body.isStar)
			if (position.body.isStar) {
				const glow = context.createRadialGradient(position.x, position.y, 0, position.x, position.y, 30)
				const color = resolveColor(position.body.color, '#FFE088')
				glow.addColorStop(0, `${color}4d`)
				glow.addColorStop(0.3, `${color}1a`)
				glow.addColorStop(1, `${color}00`)
				context.save()
				context.globalAlpha = bodyOpacity(key)
				context.fillStyle = glow
				context.beginPath()
				context.arc(position.x, position.y, 30, 0, Math.PI * 2)
				context.fill()
				context.restore()
			}

			const isSelected = key === selectedId
			const radius = bodyRadius(position.body)
			context.save()
			context.globalAlpha = bodyOpacity(key)
			context.fillStyle = resolveColor(position.body.color, position.body.isStar ? '#FFE088' : theme.secondary)
			context.beginPath()
			context.arc(position.x, position.y, radius, 0, Math.PI * 2)
			context.fill()
			if (isSelected) {
				context.strokeStyle = theme.accent
				context.lineWidth = 2.5
				context.stroke()
			}
			context.restore()

			if (showLabel(position.body, isSelected)) {
				drawLabel(
					context,
					position.x,
					position.y + radius + 12,
					position.body.name,
					isSelected ? theme.accent : (hoveredId === key ? theme.heading : theme.dim),
					9,
					isSelected ? 600 : 400,
					bodyOpacity(key),
				)
			}
		}

		for (const satellite of scene.satellitePositions) {
			const key = keyForBody(satellite.body, satellite.body.isStar)
			const isSelected = key === selectedId
			context.save()
			context.globalAlpha = bodyOpacity(key)
			context.strokeStyle = isSelected
				? theme.accent
				: (isInFamily(key) ? theme.accentLight : theme.secondary)
			context.lineWidth = isSelected ? 1.5 : 0.5
			if (satellite.body.isStar) context.setLineDash([4, 3])
			context.beginPath()
			context.arc(satellite.parentX, satellite.parentY, satellite.orbitRadius, 0, Math.PI * 2)
			context.stroke()
			context.restore()

			if (satellite.body.isStar) {
				const starColor = resolveColor(satellite.body.color, '#FFE088')
				const glow = context.createRadialGradient(satellite.x, satellite.y, 0, satellite.x, satellite.y, 20)
				glow.addColorStop(0, `${starColor}4d`)
				glow.addColorStop(0.3, `${starColor}1a`)
				glow.addColorStop(1, `${starColor}00`)
				context.save()
				context.globalAlpha = bodyOpacity(key)
				context.fillStyle = glow
				context.beginPath()
				context.arc(satellite.x, satellite.y, 20, 0, Math.PI * 2)
				context.fill()
				context.restore()
			}

			const satRadius = satellite.body.isStar ? 5 : 2.5
			context.save()
			context.globalAlpha = bodyOpacity(key)
			context.fillStyle = resolveColor(satellite.body.color, satellite.body.isStar ? '#FFE088' : theme.dim)
			context.beginPath()
			context.arc(satellite.x, satellite.y, satRadius, 0, Math.PI * 2)
			context.fill()
			if (isSelected) {
				context.strokeStyle = theme.accent
				context.lineWidth = 2
				context.stroke()
			}
			context.restore()

			if (labels === 'all' || hoveredId === key || isSelected) {
				drawLabel(
					context,
					satellite.x,
					satellite.y + 8,
					satellite.body.name,
					isSelected ? theme.accent : theme.dim,
					7,
					isSelected ? 600 : 400,
					bodyOpacity(key),
				)
			}
		}
		// Reference rings for log/compact modes (world-space)
		if ((scale === 'log' || scale === 'compact') && scene.directPositions.length > 0) {
			const cx = CENTER + scene.cameraOffset.x
			const cy = CENTER + scene.cameraOffset.y
			for (const au of LOG_RING_DECADES) {
				if (au < scene.auMin * 0.5 || au > scene.effectiveMaxAu * 1.5) continue
				const r = scaleAuToPixel(au, scene.auMin, scene.effectiveMaxAu, scene.maxVisualRadius)
				if (r < 20 || r > scene.maxVisualRadius + 10) continue
				context.save()
				context.setLineDash([2, 6])
				context.strokeStyle = theme.faint
				context.lineWidth = 0.5
				context.globalAlpha = 0.2
				context.beginPath()
				context.arc(cx, cy, r, 0, Math.PI * 2)
				context.stroke()
				context.restore()
				context.save()
				context.fillStyle = theme.faint
				context.font = `400 7px ${FONT_STACK}`
				context.textAlign = 'left'
				context.textBaseline = 'middle'
				context.globalAlpha = 0.35
				context.fillText(`${au} AU`, cx + r + 4, cy)
				context.restore()
			}
		}

		// End world-space transform
		context.restore()

		// --- HUD overlays (screen space) ---

		// Distance legend (linear bar for proportional/inner modes)
		if (scale === 'proportional' || scale === 'inner') {
			const positions = scene.directPositions
			if (positions.length > 0) {
				const maxA = Math.max(...positions.map(p => p.a))
				const maxAu = scene.effectiveMaxAu
				if (maxAu > 0 && maxA > 0) {
					const pxPerAu = ((maxA - R_GUARD) / maxAu) * zoomLevel
					const niceValues = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 50, 100]
					let bestAu = 1
					let bestBarPx = pxPerAu
					for (const v of niceValues) {
						const barPx = v * pxPerAu
						if (barPx >= 40 && barPx <= 150) {
							bestAu = v
							bestBarPx = barPx
							break
						}
					}

					if (bestBarPx >= 20 && bestBarPx <= 200) {
						const x0 = 20
						const y0 = SIZE - 20
						const capH = 4

						context.save()
						context.strokeStyle = theme.faint
						context.lineWidth = 1
						context.globalAlpha = 0.6
						context.beginPath()
						context.moveTo(x0, y0 - capH)
						context.lineTo(x0, y0 + capH)
						context.moveTo(x0, y0)
						context.lineTo(x0 + bestBarPx, y0)
						context.moveTo(x0 + bestBarPx, y0 - capH)
						context.lineTo(x0 + bestBarPx, y0 + capH)
						context.stroke()

						context.fillStyle = theme.faint
						context.font = `400 9px ${FONT_STACK}`
						context.textAlign = 'center'
						context.textBaseline = 'bottom'
						context.fillText(`${bestAu} AU`, x0 + bestBarPx / 2, y0 - 6)
						context.restore()
					}
				}
			}
		}

		// Scale mode label
		{
			const modeLabels: Record<ScaleMode, string> = {
				log: 'Log scale',
				proportional: 'Linear scale',
				compact: 'Compact scale',
				inner: 'Inner system',
			}
			context.save()
			context.fillStyle = theme.faint
			context.font = `400 8px ${FONT_STACK}`
			context.textAlign = 'right'
			context.textBaseline = 'top'
			context.globalAlpha = 0.5
			context.fillText(modeLabels[scale], SIZE - 12, 12)
			context.restore()
		}

		// Off-screen body indicators
		{
			const margin = 16
			for (const target of scene.hitTargets) {
				const screen = worldToScreen(target.x, target.y)
				if (screen.x >= margin && screen.x <= SIZE - margin && screen.y >= margin && screen.y <= SIZE - margin) continue

				const angle = Math.atan2(screen.y - CENTER, screen.x - CENTER)
				const clampedX = Math.min(SIZE - margin, Math.max(margin, screen.x))
				const clampedY = Math.min(SIZE - margin, Math.max(margin, screen.y))

				const triSize = 5
				const alpha = 0.7 * bodyOpacity(target.id)

				context.save()
				context.translate(clampedX, clampedY)
				context.rotate(angle)
				context.fillStyle = theme.dim
				context.globalAlpha = alpha
				context.beginPath()
				context.moveTo(triSize, 0)
				context.lineTo(-triSize, -triSize * 0.6)
				context.lineTo(-triSize, triSize * 0.6)
				context.closePath()
				context.fill()
				context.restore()

				const labelX = clampedX - Math.cos(angle) * 14
				const labelY = clampedY - Math.sin(angle) * 14
				drawLabel(context, labelX, labelY, target.body.name, theme.dim, 8, 400, alpha)
			}
		}
	}

	$effect(() => {
		renderMap()
	})

	// --- Coordinate transforms ---

	/** Convert screen pixel coords to world (scene) coords */
	function screenToWorld(sx: number, sy: number) {
		return {
			x: (sx - CENTER) / zoomLevel + CENTER - panOffset.x,
			y: (sy - CENTER) / zoomLevel + CENTER - panOffset.y,
		}
	}

	/** Convert world (scene) coords to screen pixel coords */
	function worldToScreen(wx: number, wy: number) {
		return {
			x: CENTER + (wx - CENTER + panOffset.x) * zoomLevel,
			y: CENTER + (wy - CENTER + panOffset.y) * zoomLevel,
		}
	}

	function eventToScreen(event: MouseEvent) {
		const rect = canvasElement?.getBoundingClientRect()
		if (!rect) return null
		return {
			x: ((event.clientX - rect.left) / rect.width) * SIZE,
			y: ((event.clientY - rect.top) / rect.height) * SIZE,
		}
	}

	function eventPoint(event: MouseEvent) {
		const screen = eventToScreen(event)
		if (!screen) return null
		return screenToWorld(screen.x, screen.y)
	}

	function hitTest(point: { x: number, y: number }) {
		let best: HitTarget | null = null
		let bestDistance = Number.POSITIVE_INFINITY

		for (const target of scene.hitTargets) {
			const distance = Math.hypot(point.x - target.x, point.y - target.y)
			if (distance <= target.r / zoomLevel && distance < bestDistance) {
				best = target
				bestDistance = distance
			}
		}

		return best
	}

	// --- Interaction handlers ---

	function handlePointerMove(event: MouseEvent) {
		if (isDragging && dragStart) {
			const rect = canvasElement?.getBoundingClientRect()
			if (!rect) return
			const pxScale = SIZE / rect.width
			panOffset = {
				x: dragStart.panX + (event.clientX - dragStart.x) * pxScale / zoomLevel,
				y: dragStart.panY + (event.clientY - dragStart.y) * pxScale / zoomLevel,
			}
			return
		}
		const point = eventPoint(event)
		if (!point) return
		const target = hitTest(point)
		hoveredId = target?.id ?? null
		hoveredBody = target?.body ?? null
	}

	function handlePointerLeave() {
		hoveredId = null
		hoveredBody = null
	}

	function handleMouseDown(event: MouseEvent) {
		if (event.button !== 0) return
		const point = eventPoint(event)
		if (point && hitTest(point)) return
		isDragging = true
		dragStart = {
			x: event.clientX,
			y: event.clientY,
			panX: panOffset.x,
			panY: panOffset.y,
		}
	}

	function handleMouseUp() {
		isDragging = false
		dragStart = null
	}

	function handleClick(event: MouseEvent) {
		const point = eventPoint(event)
		if (!point) return
		const target = hitTest(point)

		if (!target) {
			selectedId = null
			return
		}

		selectedId = selectedId === target.id ? null : target.id
	}

	function resetView() {
		zoomLevel = 1
		panOffset = { x: 0, y: 0 }
	}

	// Wheel zoom + global mouseup listener
	$effect(() => {
		const canvas = canvasElement
		if (!canvas) return

		const onWheel = (event: WheelEvent) => {
			event.preventDefault()
			const rect = canvas.getBoundingClientRect()
			const sx = ((event.clientX - rect.left) / rect.width) * SIZE
			const sy = ((event.clientY - rect.top) / rect.height) * SIZE

			const worldBefore = screenToWorld(sx, sy)
			const factor = event.deltaY > 0 ? 0.9 : 1.1
			const newZoom = Math.min(10, Math.max(0.5, zoomLevel * factor))

			panOffset = {
				x: CENTER - worldBefore.x + (sx - CENTER) / newZoom,
				y: CENTER - worldBefore.y + (sy - CENTER) / newZoom,
			}
			zoomLevel = newZoom
		}

		canvas.addEventListener('wheel', onWheel, { passive: false })
		globalThis.addEventListener('mouseup', handleMouseUp)

		return () => {
			canvas.removeEventListener('wheel', onWheel)
			globalThis.removeEventListener('mouseup', handleMouseUp)
		}
	})

	const hoveredTarget = $derived.by(() =>
		hoveredId == null
			? null
			: scene.hitTargets.find(target => target.id === hoveredId) ?? null,
	)

	const tooltipStyle = $derived.by(() => {
		if (!hoveredTarget) return ''
		const screen = worldToScreen(hoveredTarget.x, hoveredTarget.y)
		const x = (screen.x / SIZE) * displaySize.width
		const y = (screen.y / SIZE) * displaySize.height
		const tipWidth = 160
		const tipHeight = 52
		const placeRight = x + 16 + tipWidth < displaySize.width
		const left = placeRight ? x + 16 : x - tipWidth - 16
		const top = Math.min(Math.max(y - tipHeight / 2, 4), displaySize.height - tipHeight - 4)
		return `left:${left}px;top:${top}px;`
	})
</script>

<div class="relative w-full" bind:this={containerElement}>
	<canvas
		bind:this={canvasElement}
		width={SIZE}
		height={SIZE}
		class="block w-full bg-page"
		style="aspect-ratio: 1 / 1; cursor: {isDragging ? 'grabbing' : 'grab'};"
		aria-label="System map of {systemName}"
		onmousemove={handlePointerMove}
		onmouseleave={handlePointerLeave}
		onmousedown={handleMouseDown}
		onclick={handleClick}
	></canvas>

	{#if isViewMoved}
		<button
			class="absolute top-2 right-2 px-1.5 py-0.5 text-xs font-medium text-dim bg-surface/80 border border-border-subtle transition-colors hover:text-accent"
			onclick={resetView}
		>
			{zoomLevel.toFixed(1)}x
		</button>
	{/if}

	{#if hoveredBody && hoveredTarget}
		<div
			class="pointer-events-none absolute border px-2.5 py-1.5 shadow-lg"
			style="{tooltipStyle}background:{theme.surface};border-color:{theme.accentLight};"
		>
			<div class="text-xs font-semibold text-heading whitespace-nowrap">
				{hoveredBody.name}
				{#if hoveredBody.spectralType}
					<span class="font-normal text-faint">({hoveredBody.spectralType})</span>
				{/if}
			</div>
			{#if hoveredBody.semiMajorAxisAu}
				<div class="text-xs text-faint">{hoveredBody.semiMajorAxisAu.toFixed(3)} AU</div>
			{/if}
		</div>
	{/if}
</div>
