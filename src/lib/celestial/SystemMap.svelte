<script lang="ts">
	import { resolveColor, colorWithAlpha } from './colors.js'
	import type { ScaleMode, LabelMode, TrailMode } from './map-settings.js'
	import {
		SIZE,
		CENTER,
		R_GUARD,
		keyForBody,
		bodyRadius,
		scaleAuToPixel,
		buildScene,
	} from './system-layout.js'
	import type { MapBody, EntityKey, OrbitBody, HitTarget, ThemePalette } from './system-layout.js'

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
	// Tracks whether the current press turned into a pan, so the trailing click that
	// fires on mouseup doesn't clear the selection after a drag on empty space.
	let pointerMoved = false
	const isViewMoved = $derived(zoomLevel !== 1 || panOffset.x !== 0 || panOffset.y !== 0)

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

	const scene = $derived.by(() => buildScene({ stars, bodies, scale, selectedId, follow, currentAbsoluteDay }))

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

	// Draw the full orbit as a rigid ellipse rotated about its focus (fx, fy) by
	// `apseRad`, matching how `ellipsePosition` places the body on it.
	function drawFullOrbit(
		ctx: CanvasRenderingContext2D,
		fx: number,
		fy: number,
		a: number,
		b: number,
		focusOffset: number,
		apseRad: number,
	) {
		const cos = Math.cos(apseRad), sin = Math.sin(apseRad)
		ctx.beginPath()
		ctx.ellipse(fx - focusOffset * cos, fy - focusOffset * sin, a, b, apseRad, 0, Math.PI * 2)
		ctx.stroke()
	}

	function drawShortTrail(
		ctx: CanvasRenderingContext2D,
		fx: number,
		fy: number,
		a: number,
		b: number,
		focusOffset: number,
		angle: number,
		apseRad: number,
	) {
		const steps = 32
		const span = Math.PI * 0.5
		const cos = Math.cos(apseRad), sin = Math.sin(apseRad)
		ctx.beginPath()
		for (let index = 0; index <= steps; index += 1) {
			const theta = angle - (index / steps) * span
			const relativeX = a * Math.cos(theta) - focusOffset
			const relativeY = b * Math.sin(theta)
			const x = fx + relativeX * cos - relativeY * sin
			const y = fy + relativeX * sin + relativeY * cos
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
			const focusOffset = Math.sqrt(Math.max(position.a * position.a - position.b * position.b, 0))
			const key = keyForBody(position.body, position.body.isStar)
			const stroke = orbitStroke(key, key === selectedId)
			context.save()
			context.strokeStyle = stroke.color
			context.lineWidth = stroke.width
			context.globalAlpha = stroke.alpha * bodyOpacity(key)
			if (position.body.isStar) context.setLineDash([4, 3])
			drawFullOrbit(context, CENTER + scene.cameraOffset.x, CENTER + scene.cameraOffset.y, position.a, position.b, focusOffset, position.body.apseRad)
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
				const focusOffset = Math.sqrt(Math.max(position.a * position.a - position.b * position.b, 0))
				const fx = CENTER + scene.cameraOffset.x
				const fy = CENTER + scene.cameraOffset.y
				if (trails === 'full') drawFullOrbit(context, fx, fy, position.a, position.b, focusOffset, position.body.apseRad)
				else drawShortTrail(context, fx, fy, position.a, position.b, focusOffset, position.angle, position.body.apseRad)
				context.restore()
			}
		}

		if (scene.primaryStar) {
			const centerX = CENTER + scene.cameraOffset.x
			const centerY = CENTER + scene.cameraOffset.y

			const ambient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, CENTER * 0.85)
			ambient.addColorStop(0, colorWithAlpha(primaryColor, 0.06))
			ambient.addColorStop(0.4, colorWithAlpha(primaryColor, 0.02))
			ambient.addColorStop(1, colorWithAlpha(primaryColor, 0))
			context.fillStyle = ambient
			context.beginPath()
			context.arc(centerX, centerY, CENTER * 0.85, 0, Math.PI * 2)
			context.fill()

			const inner = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, 40)
			inner.addColorStop(0, colorWithAlpha(primaryColor, 0.4))
			inner.addColorStop(0.3, colorWithAlpha(primaryColor, 0.15))
			inner.addColorStop(1, colorWithAlpha(primaryColor, 0))
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
				glow.addColorStop(0, colorWithAlpha(color, 0.3))
				glow.addColorStop(0.3, colorWithAlpha(color, 0.1))
				glow.addColorStop(1, colorWithAlpha(color, 0))
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
			context.ellipse(
				satellite.parentX - satellite.focusOffset,
				satellite.parentY,
				satellite.orbitRadius,
				satellite.orbitSemiMinor,
				0,
				0,
				Math.PI * 2,
			)
			context.stroke()
			context.restore()

			if (satellite.body.isStar) {
				const starColor = resolveColor(satellite.body.color, '#FFE088')
				const glow = context.createRadialGradient(satellite.x, satellite.y, 0, satellite.x, satellite.y, 20)
				glow.addColorStop(0, colorWithAlpha(starColor, 0.3))
				glow.addColorStop(0.3, colorWithAlpha(starColor, 0.1))
				glow.addColorStop(1, colorWithAlpha(starColor, 0))
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
				const r = scaleAuToPixel(au, scale, scene.auMin, scene.effectiveMaxAu, scene.maxVisualRadius)
				if (r < 20 || r > scene.maxVisualRadius + 10) continue
				context.save()
				context.setLineDash([2, 6])
				context.strokeStyle = theme.secondary
				context.lineWidth = 0.5
				context.globalAlpha = 0.3
				context.beginPath()
				context.arc(cx, cy, r, 0, Math.PI * 2)
				context.stroke()
				context.restore()
				context.save()
				context.fillStyle = theme.secondary
				context.font = `400 9px ${FONT_STACK}`
				context.textAlign = 'left'
				context.textBaseline = 'middle'
				context.globalAlpha = 0.6
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

				const triSize = 8
				const alpha = 0.85 * bodyOpacity(target.id)

				context.save()
				context.translate(clampedX, clampedY)
				context.rotate(angle)
				context.fillStyle = theme.secondary
				context.globalAlpha = alpha
				context.beginPath()
				context.moveTo(triSize, 0)
				context.lineTo(-triSize, -triSize * 0.6)
				context.lineTo(-triSize, triSize * 0.6)
				context.closePath()
				context.fill()
				context.restore()

				const labelX = clampedX - Math.cos(angle) * 18
				const labelY = clampedY - Math.sin(angle) * 18
				drawLabel(context, labelX, labelY, target.body.name, theme.secondary, 9, 500, alpha)
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
			if (Math.abs(event.clientX - dragStart.x) + Math.abs(event.clientY - dragStart.y) > 3) pointerMoved = true
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
		pointerMoved = false
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
		// A drag on empty space ends with a click event — don't treat it as a deselect.
		if (pointerMoved) {
			pointerMoved = false
			return
		}
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
			class="absolute top-2 right-2 px-1.5 py-0.5 text-xs font-medium text-dim bg-surface/80 transition-colors hover:text-accent"
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
					<span class="font-normal text-secondary">({hoveredBody.spectralType})</span>
				{/if}
			</div>
			{#if hoveredBody.semiMajorAxisAu}
				<div class="text-xs text-secondary">{hoveredBody.semiMajorAxisAu.toFixed(3)} AU</div>
			{/if}
		</div>
	{/if}
</div>
