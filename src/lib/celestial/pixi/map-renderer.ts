/**
 * PixiJS renderer for the system map. Browser-only — the ONLY module graph
 * that may import pixi.js / pixi-viewport, reached exclusively via a dynamic
 * import inside SystemMap.svelte's onMount.
 *
 * Three update paths keep per-frame work minimal:
 *   rebuild()        — data/scale/theme changed: rebuild geometry and nodes.
 *   applyPositions() — the in-world day changed: move containers, redraw
 *                      trails. Never rebuilds orbit geometry (orrery path).
 *   applyStyles()    — selection/hover/mode changed: restroke + retint.
 * Zoom changes additionally counter-scale bodies/labels and restroke lines so
 * everything except orbit geometry stays a constant screen size.
 */
import { Application, Circle, Container, Graphics, Sprite, Text, TilingSprite, Texture } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import {
	SIZE,
	CENTER,
	R_GUARD,
	keyForBody,
	bodyRadius,
	scaleAuToPixel,
	buildLayout,
	computePositions,
	computeCameraOffset,
	buildSelectionFamily,
	blendedSatelliteGeometry,
} from '../system-layout.js'
import type {
	MapBody,
	EntityKey,
	SystemLayout,
	SatelliteLayout,
	BodyPosition,
	ThemePalette,
} from '../system-layout.js'
import type { MapRendererCallbacks, MapSettingsState, SystemMapRenderer } from '../renderer-types.js'
export type { MapRendererCallbacks, MapSettingsState, SystemMapRenderer } from '../renderer-types.js'
import { resolveColor } from '../colors.js'
import { dashedEllipsePath, trailPath, makeRadialGlowTexture, cssToTint } from './draw-helpers.js'
import { createHud, FONT_STACK } from './hud.js'
import type { HudTarget } from './hud.js'

const STAR_GOLD = '#FFE088'
const LOG_RING_DECADES = [0.01, 0.1, 1, 10, 100, 1000]
const MIN_ZOOM = 0.25
const MAX_ZOOM = 40
const GLOW_TEXTURE_SIZE = 128
// Moon-LOD unfold: a subsystem starts migrating from its schematic zone layout
// to proportional orbits when the zone spans this many screen px, and is fully
// unfolded at the second threshold.
const UNFOLD_START_SCREEN_PX = 120
const UNFOLD_END_SCREEN_PX = 300

function smoothstep(edgeStart: number, edgeEnd: number, value: number): number {
	const t = Math.min(1, Math.max(0, (value - edgeStart) / (edgeEnd - edgeStart)))
	return t * t * (3 - 2 * t)
}

function dotRadiusFor(kind: EntityKind, isStar: boolean): number {
	if (kind === 'primary') return 10
	if (kind === 'satellite') return isStar ? 5 : 2.5
	return bodyRadius({ isStar, renderAsSatellite: false })
}

function hitRadiusFor(kind: EntityKind, isStar: boolean): number {
	if (kind === 'primary') return 12
	if (kind === 'satellite') return 8
	return Math.max(8, bodyRadius({ isStar, renderAsSatellite: false }) + 5)
}

function labelSpecFor(kind: EntityKind, dotRadius: number): { size: number, offsetY: number } {
	if (kind === 'primary') return { size: 10, offsetY: 22 }
	if (kind === 'satellite') return { size: 7, offsetY: 8 }
	return { size: 9, offsetY: dotRadius + 12 }
}

function trapWheel(event: WheelEvent): void {
	event.preventDefault()
}

type EntityKind = 'primary' | 'direct' | 'satellite'

type EntityNode = {
	key: EntityKey
	body: MapBody
	kind: EntityKind
	isStar: boolean
	color: string
	container: Container
	dot: Graphics
	ring: Graphics
	label: Text
	glow?: Sprite
	angle: number
	orbit?: {
		container: Container
		graphics: Graphics
		a: number
		b: number
		dashed: boolean
	}
	trail?: {
		container: Container
		graphics: Graphics
	}
	sat?: {
		container: Container
		graphics: Graphics
		layout: SatelliteLayout
		/** Geometry at the current unfold blend; refreshed in applyPositions. */
		display: { radius: number, semiMinor: number, focusOffset: number }
		dashed: boolean
	}
}

export async function createSystemMapRenderer(
	host: HTMLElement,
	initialTheme: ThemePalette,
	callbacks: MapRendererCallbacks,
): Promise<SystemMapRenderer> {
	// Bake real Work Sans into text rasterization — a Text created against the
	// fallback font never re-renders when the web font lands later.
	try {
		await Promise.race([
			Promise.all([
				document.fonts.load('400 16px "Work Sans"'),
				document.fonts.load('600 16px "Work Sans"'),
			]),
			new Promise(resolve => setTimeout(resolve, 2000)),
		])
	} catch {
		// Fallback fonts are acceptable; never block the map on typography.
	}

	let screenSize = Math.max(1, Math.round(host.getBoundingClientRect().width)) || SIZE
	let theme = initialTheme

	const app = new Application()
	await app.init({
		width: screenSize,
		height: screenSize,
		preference: 'webgl',
		antialias: true,
		autoDensity: true,
		resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
		background: theme.page,
	})

	/** World-units-per-screen fit factor: zoomLevel 1 shows the full 800 square. */
	let base = screenSize / SIZE
	let zoomLevel = 1

	const viewport = new Viewport({
		screenWidth: screenSize,
		screenHeight: screenSize,
		worldWidth: SIZE,
		worldHeight: SIZE,
		events: app.renderer.events,
		ticker: app.ticker,
		disableOnContextMenu: true,
	})
	viewport
		.drag()
		.pinch()
		.wheel()
		.decelerate({ friction: 0.93 })
		.clampZoom({ minScale: base * MIN_ZOOM, maxScale: base * MAX_ZOOM })
	viewport.setZoom(base)
	viewport.moveCenter(CENTER, CENTER)

	// Grid + HUD draw in the classic 800-unit space, scaled to the canvas.
	const gridRoot = new Container()
	const hudRoot = new Container()
	gridRoot.scale.set(base)
	hudRoot.scale.set(base)
	gridRoot.eventMode = 'none'
	hudRoot.eventMode = 'none'

	const worldRoot = new Container()
	const ambientLayer = new Container()
	const orbitLayer = new Container()
	const satOrbitLayer = new Container()
	const trailLayer = new Container()
	const bodyLayer = new Container()
	const ringLayer = new Container()
	worldRoot.addChild(ambientLayer, orbitLayer, satOrbitLayer, trailLayer, bodyLayer, ringLayer)
	viewport.addChild(worldRoot)
	app.stage.addChild(gridRoot, viewport, hudRoot)

	const gridTexture = makeGridTexture()
	const gridSprite = new TilingSprite({ texture: gridTexture, width: SIZE, height: SIZE })
	gridSprite.alpha = 0.15
	gridRoot.addChild(gridSprite)

	const hud = createHud(hudRoot)

	const glowTextures = {
		ambient: makeRadialGlowTexture(GLOW_TEXTURE_SIZE, [[0, 0.06], [0.4, 0.02], [1, 0]]),
		primary: makeRadialGlowTexture(GLOW_TEXTURE_SIZE, [[0, 0.4], [0.3, 0.15], [1, 0]]),
		star: makeRadialGlowTexture(GLOW_TEXTURE_SIZE, [[0, 0.3], [0.3, 0.1], [1, 0]]),
	}
	const ambientSprite = new Sprite({ texture: glowTextures.ambient })
	ambientSprite.anchor.set(0.5)
	ambientSprite.position.set(CENTER, CENTER)
	ambientSprite.visible = false
	ambientLayer.addChild(ambientSprite)

	app.renderer.events.cursorStyles.default = 'grab'
	app.renderer.events.cursorStyles.grabbing = 'grabbing'

	// Pixi v8 attaches its own wheel listener as passive, so pixi-viewport can't
	// stop the page from scrolling while the user zooms. Trap wheel on the canvas
	// with a non-passive listener (as the old canvas renderer did).
	app.canvas.addEventListener('wheel', trapWheel, { passive: false })

	// --- Renderer state ---
	let stars: MapBody[] = []
	let bodies: MapBody[] = []
	let day: number | null = null
	let settings: MapSettingsState = { scale: 'log', labels: 'major', trails: 'off', follow: false, view: 'plan' }
	let selectedId: EntityKey | null = null
	let hoveredKey: EntityKey | null = null
	let layout: SystemLayout | null = null
	let positions = new Map<EntityKey, BodyPosition>()
	let family = new Set<EntityKey>()
	const nodes = new Map<EntityKey, EntityNode>()
	const ringLabels: Text[] = []
	const ringGraphics = new Graphics()
	ringLayer.addChild(ringGraphics)
	let viewDirty = true
	let lastBodyTapAt = 0
	let destroyed = false

	function makeGridTexture(): Texture {
		const cell = 160
		const arm = 6
		const canvas = document.createElement('canvas')
		canvas.width = cell
		canvas.height = cell
		const context = canvas.getContext('2d')!
		context.strokeStyle = 'rgba(255,255,255,1)'
		context.lineWidth = 1
		const mid = cell / 2
		context.beginPath()
		context.moveTo(mid - arm, mid)
		context.lineTo(mid + arm, mid)
		context.moveTo(mid, mid - arm)
		context.lineTo(mid, mid + arm)
		context.stroke()
		return Texture.from(canvas)
	}

	function entityColor(body: MapBody, kind: EntityKind, isStar: boolean): string {
		if (kind === 'primary' || isStar) return resolveColor(body.color, STAR_GOLD)
		if (kind === 'satellite') return resolveColor(body.color, theme.dim)
		return resolveColor(body.color, theme.secondary)
	}

	function destroyNodes(): void {
		for (const node of nodes.values()) {
			node.container.destroy({ children: true })
			node.orbit?.container.destroy({ children: true })
			node.trail?.container.destroy({ children: true })
			node.sat?.container.destroy({ children: true })
		}
		nodes.clear()
		for (const label of ringLabels) label.parent?.destroy({ children: true })
		ringLabels.length = 0
		ringGraphics.clear()
	}

	function makeEntityNode(body: MapBody, kind: EntityKind, isStar: boolean): EntityNode {
		const key = keyForBody(body, isStar)
		const color = entityColor(body, kind, isStar)
		const dotRadius = dotRadiusFor(kind, isStar)
		const { size, offsetY } = labelSpecFor(kind, dotRadius)

		const container = new Container()
		container.eventMode = 'static'
		container.cursor = 'pointer'
		container.hitArea = new Circle(0, 0, hitRadiusFor(kind, isStar))

		let glow: Sprite | undefined
		if (kind === 'primary' || isStar) {
			const glowRadius = kind === 'primary' ? 40 : (kind === 'satellite' ? 20 : 30)
			glow = new Sprite({ texture: kind === 'primary' ? glowTextures.primary : glowTextures.star })
			glow.anchor.set(0.5)
			glow.width = glowRadius * 2
			glow.height = glowRadius * 2
			glow.tint = cssToTint(color).tint
			container.addChild(glow)
		}

		const dot = new Graphics()
		dot.circle(0, 0, dotRadius).fill(cssToTint(color).tint)
		container.addChild(dot)

		const ring = new Graphics()
		ring.circle(0, 0, dotRadius).stroke({ width: kind === 'satellite' ? 2 : 2.5, color: cssToTint(theme.accent).tint })
		ring.visible = false
		container.addChild(ring)

		const label = new Text({
			text: body.name,
			style: { fontFamily: FONT_STACK, fontSize: size, fontWeight: '400', fill: 0xFFFFFF },
		})
		label.anchor.set(0.5)
		label.position.set(0, offsetY)
		container.addChild(label)

		container.on('pointerover', () => {
			hoveredKey = key
			applyStyles()
			emitHover()
		})
		container.on('pointerout', () => {
			if (hoveredKey === key) {
				hoveredKey = null
				applyStyles()
				emitHover()
			}
		})
		container.on('pointertap', () => {
			lastBodyTapAt = performance.now()
			callbacks.onSelect(selectedId === key ? null : key)
		})

		bodyLayer.addChild(container)
		return { key, body, kind, isStar, color, container, dot, ring, label, glow, angle: 0 }
	}

	function rebuild(): void {
		destroyNodes()
		hoveredKey = null
		layout = buildLayout(stars, bodies, settings.scale)

		ambientSprite.visible = layout.primaryStar != null
		if (layout.primaryStar) {
			const primaryColor = resolveColor(layout.primaryStar.color, STAR_GOLD)
			ambientSprite.tint = cssToTint(primaryColor).tint
			ambientSprite.width = CENTER * 0.85 * 2
			ambientSprite.height = CENTER * 0.85 * 2
			const node = makeEntityNode(layout.primaryStar, 'primary', true)
			node.container.position.set(CENTER, CENTER)
			nodes.set(node.key, node)
		}

		for (const orbit of layout.directOrbits) {
			const body = orbit.body
			const node = makeEntityNode(body, 'direct', body.isStar)
			const focusOffset = Math.sqrt(Math.max(orbit.a * orbit.a - orbit.b * orbit.b, 0))
			const apseRad = orbit.outOfRange ? 0 : body.apseRad
			const orbitContainer = new Container()
			orbitContainer.position.set(
				CENTER - focusOffset * Math.cos(apseRad),
				CENTER - focusOffset * Math.sin(apseRad),
			)
			orbitContainer.rotation = apseRad
			const orbitGraphics = new Graphics()
			orbitContainer.addChild(orbitGraphics)
			orbitLayer.addChild(orbitContainer)
			node.orbit = { container: orbitContainer, graphics: orbitGraphics, a: orbit.a, b: orbit.b, dashed: body.isStar }

			const trailContainer = new Container()
			trailContainer.position.copyFrom(orbitContainer.position)
			trailContainer.rotation = apseRad
			const trailGraphics = new Graphics()
			trailContainer.addChild(trailGraphics)
			trailLayer.addChild(trailContainer)
			node.trail = { container: trailContainer, graphics: trailGraphics }

			nodes.set(node.key, node)
		}

		for (const satellite of layout.satellites) {
			const body = satellite.body
			const node = makeEntityNode(body, 'satellite', body.isStar)
			const satContainer = new Container()
			const satGraphics = new Graphics()
			satContainer.addChild(satGraphics)
			satOrbitLayer.addChild(satContainer)
			node.sat = {
				container: satContainer,
				graphics: satGraphics,
				layout: satellite,
				display: blendedSatelliteGeometry(satellite, 0),
				dashed: body.isStar,
			}
			nodes.set(node.key, node)
		}

		rebuildRings()
		applyZoomScales()
		applyPositions()
		applyStyles()
	}

	function rebuildRings(): void {
		for (const label of ringLabels) label.parent?.destroy({ children: true })
		ringLabels.length = 0
		ringGraphics.clear()
		if (!layout || layout.directOrbits.length === 0) return
		if (settings.scale !== 'log' && settings.scale !== 'compact') return

		const secondary = cssToTint(theme.secondary).tint
		for (const au of LOG_RING_DECADES) {
			if (au < layout.auMin * 0.5 || au > layout.effectiveMaxAu * 1.5) continue
			const radius = scaleAuToPixel(au, settings.scale, layout.auMin, layout.effectiveMaxAu, layout.maxVisualRadius)
			if (radius < 20 || radius > layout.maxVisualRadius + 10) continue
			dashedEllipsePath(ringGraphics, radius, radius, 2 / zoomLevel, 6 / zoomLevel)

			const labelContainer = new Container()
			labelContainer.position.set(CENTER + radius, CENTER)
			const label = new Text({
				text: `${au} AU`,
				style: { fontFamily: FONT_STACK, fontSize: 9, fontWeight: '400', fill: 0xFFFFFF },
			})
			label.anchor.set(0, 0.5)
			label.position.set(4, 0)
			label.tint = secondary
			label.alpha = 0.6
			labelContainer.addChild(label)
			labelContainer.scale.set(1 / zoomLevel)
			ringLayer.addChild(labelContainer)
			ringLabels.push(label)
		}
		ringGraphics.position.set(CENTER, CENTER)
		ringGraphics.stroke({ width: 0.5 / zoomLevel, color: secondary })
		ringGraphics.alpha = 0.3
	}

	function opacityOf(key: EntityKey): number {
		if (selectedId == null) return 1
		if (key === selectedId || family.has(key)) return 1
		return 0.35
	}

	function unfoldBlend(satellite: SatelliteLayout): number {
		return smoothstep(UNFOLD_START_SCREEN_PX, UNFOLD_END_SCREEN_PX, satellite.zone * viewport.scale.x)
	}

	function applyPositions(): void {
		if (!layout) return
		positions = computePositions(layout, day, unfoldBlend)
		const camera = computeCameraOffset(layout, positions, selectedId, settings.follow)
		worldRoot.position.set(camera.x, camera.y)

		for (const node of nodes.values()) {
			const position = positions.get(node.key)
			if (!position) continue
			node.container.position.set(position.x, position.y)
			node.angle = position.angle
			if (node.sat) {
				node.sat.display = blendedSatelliteGeometry(node.sat.layout, unfoldBlend(node.sat.layout))
				const parent = positions.get(node.sat.layout.parentKey)
				if (parent) node.sat.container.position.set(parent.x - node.sat.display.focusOffset, parent.y)
			}
		}

		redrawTrails()
		refreshHud()
		emitHover()
	}

	function redrawTrails(): void {
		const show = settings.trails !== 'off' && day != null
		for (const node of nodes.values()) {
			if (!node.trail || !node.orbit) continue
			node.trail.container.visible = show
			if (!show) continue
			const color = cssToTint(resolveColor(node.body.color, node.isStar ? STAR_GOLD : theme.accentLight)).tint
			node.trail.graphics.clear()
			if (settings.trails === 'full') {
				node.trail.graphics.ellipse(0, 0, node.orbit.a, node.orbit.b)
			} else {
				trailPath(node.trail.graphics, node.orbit.a, node.orbit.b, node.angle)
			}
			node.trail.graphics.stroke({ width: 1 / zoomLevel, color, cap: 'round' })
			node.trail.graphics.alpha = 0.4 * opacityOf(node.key)
		}
	}

	function strokeOrbit(node: EntityNode): void {
		if (!node.orbit) return
		const key = node.key
		let color = theme.accentLight
		let width = 1
		let alpha = 0.22
		if (key === selectedId) {
			color = theme.accent
			width = 2.5
			alpha = 1
		} else if (selectedId != null && family.has(key)) {
			color = theme.accentLight
			width = 1.5
			alpha = 0.9
		} else if (hoveredKey === key) {
			color = theme.accent
			width = 1.5
			alpha = 0.85
		}
		node.orbit.graphics.clear()
		if (node.orbit.dashed) {
			dashedEllipsePath(node.orbit.graphics, node.orbit.a, node.orbit.b, 4 / zoomLevel, 3 / zoomLevel)
		} else {
			node.orbit.graphics.ellipse(0, 0, node.orbit.a, node.orbit.b)
		}
		node.orbit.graphics.stroke({ width: width / zoomLevel, color: cssToTint(color).tint })
		node.orbit.graphics.alpha = alpha * opacityOf(key)
	}

	function strokeSatelliteOrbit(node: EntityNode): void {
		if (!node.sat) return
		const key = node.key
		const isSelected = key === selectedId
		const color = isSelected
			? theme.accent
			: (selectedId != null && family.has(key) ? theme.accentLight : theme.secondary)
		const width = isSelected ? 1.5 : 0.5
		node.sat.graphics.clear()
		if (node.sat.dashed) {
			dashedEllipsePath(node.sat.graphics, node.sat.display.radius, node.sat.display.semiMinor, 4 / zoomLevel, 3 / zoomLevel)
		} else {
			node.sat.graphics.ellipse(0, 0, node.sat.display.radius, node.sat.display.semiMinor)
		}
		node.sat.graphics.stroke({ width: width / zoomLevel, color: cssToTint(color).tint })
		node.sat.graphics.alpha = opacityOf(key)
	}

	function labelVisible(node: EntityNode): boolean {
		const isSelected = node.key === selectedId
		const isHovered = hoveredKey === node.key
		if (node.kind === 'satellite') {
			if (settings.labels === 'all' || isHovered || isSelected) return true
			// Once a subsystem is unfolded, its moons are the subject of the view —
			// surface their names in 'major' mode too.
			return settings.labels === 'major' && node.sat != null && unfoldBlend(node.sat.layout) > 0.5
		}
		switch (settings.labels) {
			case 'off': return false
			case 'hovered': return isHovered
			case 'major': return true
			case 'all': return true
		}
	}

	function labelColor(node: EntityNode, isSelected: boolean, isHovered: boolean): string {
		if (isSelected) return theme.accent
		if (node.kind === 'primary') return theme.secondary
		if (node.kind === 'satellite') return theme.dim
		return isHovered ? theme.heading : theme.dim
	}

	function applyStyles(): void {
		if (!layout) return
		family = buildSelectionFamily(stars, bodies, selectedId, layout.primaryStar)

		for (const node of nodes.values()) {
			const isSelected = node.key === selectedId
			const isHovered = hoveredKey === node.key
			const opacity = opacityOf(node.key)

			node.container.alpha = opacity
			node.ring.visible = isSelected

			node.label.visible = labelVisible(node)
			if (node.label.visible) {
				node.label.tint = cssToTint(labelColor(node, isSelected, isHovered)).tint
				const weight = isSelected ? '600' : '400'
				if (node.label.style.fontWeight !== weight) node.label.style.fontWeight = weight
			}

			strokeOrbit(node)
			strokeSatelliteOrbit(node)
		}

		redrawTrails()
		refreshHud()
	}

	function applyZoomScales(): void {
		const counterScale = 1 / zoomLevel
		for (const node of nodes.values()) {
			node.container.scale.set(counterScale)
		}
		for (const label of ringLabels) label.parent?.scale.set(counterScale)
	}

	function refreshHud(): void {
		if (!layout) return
		const targets: HudTarget[] = []
		for (const node of nodes.values()) {
			const global = node.container.getGlobalPosition()
			targets.push({
				name: node.body.name,
				x: global.x / base,
				y: global.y / base,
				alpha: opacityOf(node.key),
			})
		}

		let pxPerAu = 0
		if (settings.scale === 'proportional' || settings.scale === 'inner') {
			const inRange = layout.directOrbits.filter(orbit => !orbit.outOfRange)
			const maxA = Math.max(...inRange.map(orbit => orbit.a), 0)
			if (maxA > 0 && layout.effectiveMaxAu > 0) {
				pxPerAu = ((maxA - R_GUARD) / layout.effectiveMaxAu) * zoomLevel
			}
		}

		hud.update({ scale: settings.scale, pxPerAu, targets, theme })
	}

	function emitHover(): void {
		if (hoveredKey == null) {
			callbacks.onHover(null, null)
			return
		}
		const node = nodes.get(hoveredKey)
		if (!node) {
			callbacks.onHover(null, null)
			return
		}
		const global = node.container.getGlobalPosition()
		callbacks.onHover(node.body, { x: global.x, y: global.y })
	}

	function syncView(): void {
		const newZoomLevel = viewport.scale.x / base
		const zoomChanged = Math.abs(newZoomLevel - zoomLevel) > 1e-6
		zoomLevel = newZoomLevel
		if (zoomChanged) {
			applyZoomScales()
			// Zoom drives the moon-LOD unfold blend, so satellite geometry and
			// positions shift with it — recompute before restroking.
			applyPositions()
			applyStyles()
			rebuildRings()
		}

		gridSprite.tilePosition.set(viewport.x / base, viewport.y / base)
		gridSprite.tileScale.set(zoomLevel / 2)
		gridSprite.tint = cssToTint(theme.faint).tint

		refreshHud()
		emitHover()

		const center = viewport.center
		const isMoved = Math.abs(zoomLevel - 1) > 0.001
			|| Math.abs(center.x - CENTER) > 0.5
			|| Math.abs(center.y - CENTER) > 0.5
		callbacks.onViewChange({ zoomLevel, isMoved })
	}

	function markViewDirty(): void {
		viewDirty = true
	}
	viewport.on('moved', markViewDirty)
	viewport.on('zoomed', markViewDirty)
	viewport.on('drag-start', () => {
		app.canvas.style.cursor = 'grabbing'
	})
	viewport.on('drag-end', () => {
		app.canvas.style.cursor = ''
	})
	viewport.on('clicked', () => {
		// A tap on a body fires pointertap first; don't let the viewport's
		// trailing click clear the selection it just made.
		if (performance.now() - lastBodyTapAt < 100) return
		callbacks.onSelect(null)
	})

	app.ticker.add(() => {
		if (viewDirty) {
			viewDirty = false
			syncView()
		}
	})

	// Pause rendering when the tab is hidden or the map is scrolled offscreen.
	let pageVisible = document.visibilityState !== 'hidden'
	let hostVisible = true
	function updateRunning(): void {
		if (destroyed) return
		if (pageVisible && hostVisible) app.start()
		else app.stop()
	}
	const onVisibilityChange = () => {
		pageVisible = document.visibilityState !== 'hidden'
		updateRunning()
	}
	document.addEventListener('visibilitychange', onVisibilityChange)
	const intersectionObserver = new IntersectionObserver((entries) => {
		for (const entry of entries) hostVisible = entry.isIntersecting
		updateRunning()
	})
	intersectionObserver.observe(host)

	syncView()

	return {
		canvas: app.canvas,

		setData(newStars, newBodies) {
			stars = newStars
			bodies = newBodies
			rebuild()
		},

		setDay(newDay) {
			day = newDay
			applyPositions()
		},

		setSettings(newSettings) {
			const scaleChanged = newSettings.scale !== settings.scale
			const followChanged = newSettings.follow !== settings.follow
			settings = newSettings
			if (scaleChanged) {
				rebuild()
				return
			}
			if (followChanged) applyPositions()
			applyStyles()
		},

		setSelected(id) {
			if (id === selectedId) return
			selectedId = id
			if (settings.follow) applyPositions()
			applyStyles()
		},

		setTheme(newTheme) {
			theme = newTheme
			app.renderer.background.color = theme.page
			rebuild()
			viewDirty = true
		},

		resize(newScreenSize, _newScreenHeight) {
			if (newScreenSize <= 0 || newScreenSize === screenSize) return
			const keptZoomLevel = zoomLevel
			const center = { x: viewport.center.x, y: viewport.center.y }
			screenSize = newScreenSize
			base = screenSize / SIZE
			app.renderer.resize(screenSize, screenSize)
			viewport.resize(screenSize, screenSize, SIZE, SIZE)
			viewport.clampZoom({ minScale: base * MIN_ZOOM, maxScale: base * MAX_ZOOM })
			viewport.setZoom(base * keptZoomLevel)
			viewport.moveCenter(center.x, center.y)
			gridRoot.scale.set(base)
			hudRoot.scale.set(base)
			viewDirty = true
		},

		resetView() {
			viewport.setZoom(base)
			viewport.moveCenter(CENTER, CENTER)
			viewDirty = true
		},

		destroy() {
			destroyed = true
			app.canvas.removeEventListener('wheel', trapWheel)
			document.removeEventListener('visibilitychange', onVisibilityChange)
			intersectionObserver.disconnect()
			hud.destroy()
			app.destroy(
				{ removeView: true, releaseGlobalResources: true },
				{ children: true, texture: true, textureSource: true },
			)
		},
	}
}
