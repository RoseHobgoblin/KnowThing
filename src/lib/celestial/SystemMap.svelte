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
	}

	const SIZE = 800
	const CENTER = SIZE / 2
	const PADDING = 80
	const DIRECT_MIN_R = 72
	const DIRECT_MIN_GAP = 18
	const SAT_BASE_R = 14
	const SAT_MAX_SPAN = 48
	const FONT_STACK = 'Work Sans, ui-sans-serif, system-ui, sans-serif'
	const DEFAULT_THEME: ThemePalette = {
		page: '#111827',
		surface: '#1f2937',
		accent: '#d97706',
		accentLight: '#f59e0b',
		secondary: '#cbd5e1',
		dim: '#94a3b8',
		heading: '#f8fafc',
		faint: '#64748b',
	}

	let {
		systemName,
		stars,
		bodies,
		currentAbsoluteDay,
		scale = 'all',
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

	let containerEl: HTMLDivElement | null = null
	let canvasEl: HTMLCanvasElement | null = null
	let displaySize = $state({ width: SIZE, height: SIZE })
	let theme = $state<ThemePalette>(DEFAULT_THEME)
	let hoveredId = $state<EntityKey | null>(null)
	let hoveredBody = $state<MapBody | null>(null)

	function keyForBody(body: MapBody, isStar: boolean): EntityKey {
		return `${isStar ? 'star' : 'body'}:${body.id}` as EntityKey
	}

	function readTheme() {
		if (!containerEl) return
		const style = getComputedStyle(containerEl)
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
		if (!containerEl) return

		const updateRect = () => {
			const rect = containerEl?.getBoundingClientRect()
			if (!rect) return
			const width = Math.max(1, Math.round(rect.width))
			displaySize = { width, height: width }
			readTheme()
		}

		updateRect()

		const observer = new ResizeObserver(() => updateRect())
		observer.observe(containerEl)

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
			return orbitalAngle(periodDays, body.epochPhase ?? 0, currentAbsoluteDay)
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
		for (let i = 0; i < orbiters.length - 1; i++) {
			const ratio = orbiters[i + 1].orbitAu / Math.max(orbiters[i].orbitAu, 0.001)
			if (ratio > maxRatio) {
				maxRatio = ratio
				boundaryIndex = i
			}
		}
		if (maxRatio < 3) boundaryIndex = Math.ceil(orbiters.length / 2) - 1
		return orbiters[boundaryIndex].orbitAu * 1.5
	}

	function buildScene(): Scene {
		const primaryStar = stars.find(star => !star.parentStarId) ?? stars[0] ?? null
		const primaryStarId = primaryStar?.id ?? null
		const starIds = new Set(stars.map(star => star.id))
		const companionStars = stars.filter(star => star.parentStarId)
		const directOrbiters: OrbitBody[] = []
		const seen = new Set<EntityKey>()

		for (const star of companionStars) {
			const key = keyForBody(star, true)
			if (star.semiMajorAxisAu && !seen.has(key)) {
				seen.add(key)
				directOrbiters.push({ ...star, orbitAu: star.semiMajorAxisAu, ecc: star.eccentricity ?? 0, isStar: true, renderAsSatellite: false })
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
				directOrbiters.push({ ...body, orbitAu: body.semiMajorAxisAu, ecc: body.eccentricity ?? 0, isStar: false, renderAsSatellite: false })
			}
		}

		directOrbiters.sort((a, b) => a.orbitAu - b.orbitAu)

		const maxAu = Math.max(...directOrbiters.map(body => body.orbitAu), 1)
		const maxEcc = Math.max(...directOrbiters.map(body => body.ecc), 0)
		const maxVisualRadius = (CENTER - PADDING) / (1 + maxEcc * 0.5)
		const selectionFamily = buildSelectionFamily(primaryStar)

		const effectiveMaxAu = scale === 'inner'
			? innerBoundaryAu(directOrbiters)
			: maxAu

		const scaleNormalized = (au: number) => {
			if (effectiveMaxAu <= 0) return 0
			return Math.sqrt(au / effectiveMaxAu)
		}

		const rawDirectPositions: PositionedOrbit[] = []
		const innerCount = scale === 'inner'
			? directOrbiters.filter(body => body.orbitAu <= effectiveMaxAu).length
			: directOrbiters.length
		const n = Math.max(innerCount, 1)
		const minSpaceNeeded = DIRECT_MIN_R + Math.max(0, n - 1) * DIRECT_MIN_GAP
		const gapScale = minSpaceNeeded > maxVisualRadius * 0.6
			? (maxVisualRadius * 0.6) / minSpaceNeeded
			: 1
		const effectiveMinR = DIRECT_MIN_R * gapScale
		const effectiveMinGap = DIRECT_MIN_GAP * gapScale
		const lastFloor = effectiveMinR + Math.max(0, n - 1) * effectiveMinGap
		const remainingSpace = Math.max(0, maxVisualRadius - lastFloor)
		let previousOrbitRadius = effectiveMinR - effectiveMinGap
		for (const [index, body] of directOrbiters.entries()) {
			const floor = effectiveMinR + index * effectiveMinGap
			const a = Math.max(floor + remainingSpace * scaleNormalized(body.orbitAu), previousOrbitRadius + effectiveMinGap)
			previousOrbitRadius = a
			const b = a * Math.sqrt(1 - body.ecc * body.ecc)
			const angle = computeAngle(body, index, directOrbiters.length)
			const pos = ellipsePosition(a, b, body.ecc, angle, CENTER, CENTER)
			rawDirectPositions.push({ body, a, b, angle, rawX: pos.x, rawY: pos.y, x: pos.x, y: pos.y })
		}

		const rawSatellitePositions: PositionedSatellite[] = []
		const anchorRawPositions = new Map<EntityKey, { x: number, y: number }>()
		if (primaryStar) anchorRawPositions.set(keyForBody(primaryStar, true), { x: CENTER, y: CENTER })
		for (const position of rawDirectPositions) {
			anchorRawPositions.set(keyForBody(position.body, position.body.isStar), { x: position.rawX, y: position.rawY })
		}

		const pendingBodies = bodies
			.filter(body => body.semiMajorAxisAu != null && !seen.has(keyForBody(body, false)))
			.map(body => ({ ...body, orbitAu: body.semiMajorAxisAu!, ecc: body.eccentricity ?? 0, isStar: false, renderAsSatellite: true }))

		while (pendingBodies.length > 0) {
			const groups = new Map<EntityKey, OrbitBody[]>()
			const unresolved: OrbitBody[] = []

			for (const body of pendingBodies) {
				const parentKey = parentKeyForBody(body, primaryStarId, starIds)
				if (!parentKey || !anchorRawPositions.has(parentKey)) {
					unresolved.push(body)
					continue
				}
				const existing = groups.get(parentKey) ?? []
				existing.push(body)
				groups.set(parentKey, existing)
			}

			if (groups.size === 0) break
			pendingBodies.length = 0
			pendingBodies.push(...unresolved)

			for (const [parentKey, satellites] of groups.entries()) {
				const parentAnchor = anchorRawPositions.get(parentKey)
				if (!parentAnchor) continue

				satellites.sort((a, b) => a.orbitAu - b.orbitAu)
				const maxSatelliteOrbit = Math.max(...satellites.map(satellite => satellite.orbitAu), 1)
				let previousRadius = SAT_BASE_R - 6

				for (const [index, satellite] of satellites.entries()) {
					const normalized = maxSatelliteOrbit > 0 ? satellite.orbitAu / maxSatelliteOrbit : 0
					const scaled = SAT_BASE_R + Math.sqrt(normalized) * SAT_MAX_SPAN
					const orbitRadius = Math.max(previousRadius + 6, scaled)
					previousRadius = orbitRadius

					const angle = computeAngle(satellite, index, satellites.length)
					const x = parentAnchor.x + orbitRadius * Math.cos(angle)
					const y = parentAnchor.y + orbitRadius * Math.sin(angle)
					const key = keyForBody(satellite, false)

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
				const selectedSatellite = rawSatellitePositions.find(position => keyForBody(position.body, false) === selectedId)
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

		const directPositions: PositionedOrbit[] = rawDirectPositions.map(position => {
			const projected = project(position.rawX, position.rawY)
			return { ...position, ...projected }
		})
		const satellitePositions: PositionedSatellite[] = rawSatellitePositions.map(position => {
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
				id: keyForBody(position.body, false),
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
		if (!canvasEl) return
		const context = canvasEl.getContext('2d')
		if (!context) return

		const dpr = window.devicePixelRatio || 1
		canvasEl.width = Math.round(SIZE * dpr)
		canvasEl.height = Math.round(SIZE * dpr)
		context.setTransform(dpr, 0, 0, dpr, 0, 0)
		context.clearRect(0, 0, SIZE, SIZE)
		context.fillStyle = theme.page
		context.fillRect(0, 0, SIZE, SIZE)

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
					isSelected ? theme.accent : hoveredId === key ? theme.heading : theme.dim,
					9,
					isSelected ? 600 : 400,
					bodyOpacity(key),
				)
			}
		}

		for (const satellite of scene.satellitePositions) {
			const key = keyForBody(satellite.body, false)
			const isSelected = key === selectedId
			context.save()
			context.globalAlpha = bodyOpacity(key)
			context.strokeStyle = isSelected
				? theme.accent
				: isInFamily(key)
					? theme.accentLight
					: theme.secondary
			context.lineWidth = isSelected ? 1.5 : 0.5
			context.beginPath()
			context.arc(satellite.parentX, satellite.parentY, satellite.orbitRadius, 0, Math.PI * 2)
			context.stroke()
			context.restore()

			context.save()
			context.globalAlpha = bodyOpacity(key)
			context.fillStyle = resolveColor(satellite.body.color, theme.dim)
			context.beginPath()
			context.arc(satellite.x, satellite.y, 2.5, 0, Math.PI * 2)
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
	}

	$effect(() => {
		renderMap()
	})

	function eventPoint(event: MouseEvent) {
		const rect = canvasEl?.getBoundingClientRect()
		if (!rect) return null
		const x = ((event.clientX - rect.left) / rect.width) * SIZE
		const y = ((event.clientY - rect.top) / rect.height) * SIZE
		return { x, y }
	}

	function hitTest(point: { x: number, y: number }) {
		let best: HitTarget | null = null
		let bestDistance = Number.POSITIVE_INFINITY

		for (const target of scene.hitTargets) {
			const distance = Math.hypot(point.x - target.x, point.y - target.y)
			if (distance <= target.r && distance < bestDistance) {
				best = target
				bestDistance = distance
			}
		}

		return best
	}

	function handlePointerMove(event: MouseEvent) {
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

	const hoveredTarget = $derived.by(() =>
		hoveredId == null
			? null
			: scene.hitTargets.find(target => target.id === hoveredId) ?? null,
	)

	const tooltipStyle = $derived.by(() => {
		if (!hoveredTarget) return ''
		const x = (hoveredTarget.x / SIZE) * displaySize.width
		const y = (hoveredTarget.y / SIZE) * displaySize.height
		const tipWidth = 160
		const tipHeight = 52
		const placeRight = x + 16 + tipWidth < displaySize.width
		const left = placeRight ? x + 16 : x - tipWidth - 16
		const top = Math.min(Math.max(y - tipHeight / 2, 4), displaySize.height - tipHeight - 4)
		return `left:${left}px;top:${top}px;`
	})
</script>

<div class="relative w-full max-w-2xl mx-auto" bind:this={containerEl}>
	<canvas
		bind:this={canvasEl}
		width={SIZE}
		height={SIZE}
		class="block w-full bg-page"
		style="aspect-ratio: 1 / 1;"
		aria-label="System map of {systemName}"
		onmousemove={handlePointerMove}
		onmouseleave={handlePointerLeave}
		onclick={handleClick}
	></canvas>

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
				<div class="text-[10px] text-faint">{hoveredBody.semiMajorAxisAu.toFixed(3)} AU</div>
			{/if}
		</div>
	{/if}
</div>
