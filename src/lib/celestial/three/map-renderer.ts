import {
	AmbientLight,
	CanvasTexture,
	Color,
	DirectionalLight,
	Group,
	MOUSE,
	OrthographicCamera,
	Scene,
	SphereGeometry,
	SRGBColorSpace,
	TOUCH,
	Vector2,
	Vector3,
	WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import {
	CENTER,
	SIZE,
	blendedSatelliteGeometry,
	buildPhysicalLayout,
	buildSelectionFamily,
	computePositions3D,
	keyForBody,
	orbitPoint3D,
	type DirectOrbitLayout,
	type EntityKey,
	type MapBody,
	type SatelliteLayout,
	type SystemLayout,
	type ThemePalette,
} from '../system-layout.js'
import type {
	MapRendererCallbacks,
	MapSettingsState,
	OffscreenIndicator,
	OverlaySnapshot,
	ProjectedLabel,
	SystemMapRenderer,
} from '../renderer-types.js'
import { createBodyVisual, type BodyVisual } from './body-visual.js'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 1_000_000
const VIEW_TRANSITION_MS = 450
const FLY_TO_MS = 600
const PATH_SEGMENTS = 160
const KEYBOARD_PAN_SPEED = 280
const PAN_KEYS = new Set([
	'KeyW', 'KeyA', 'KeyS', 'KeyD',
	'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
])
const DEFAULT_SETTINGS: MapSettingsState = {
	scale: 'log', labels: 'major', trails: 'off', follow: false, view: 'orrery',
}

type EntityNode = {
	key: EntityKey
	body: MapBody
	isStar: boolean
	isSatellite: boolean
	visual: BodyVisual
}

type OrbitPath = {
	key: EntityKey
	line: Line2
	geometry: LineGeometry
	material: LineMaterial
	direct?: DirectOrbitLayout
	satellite?: SatelliteLayout
}

type FlyState = {
	startedAt: number
	duration: number
	fromTarget: Vector3
	toTarget: Vector3
	fromCamera: Vector3
	toCamera: Vector3
	fromZoom: number
	toZoom: number
}

const ease = (t: number) => 1 - (1 - t) ** 3
const trapWheel = (event: WheelEvent) => event.preventDefault()
const worldPosition = (position: { x: number, y: number, z: number }) =>
	new Vector3(position.x - CENTER, position.y - CENTER, position.z)

function makeGlowTexture(): CanvasTexture {
	const canvas = document.createElement('canvas')
	canvas.width = 128
	canvas.height = 128
	const context = canvas.getContext('2d')!
	const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64)
	gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
	gradient.addColorStop(0.2, 'rgba(255,255,255,0.42)')
	gradient.addColorStop(1, 'rgba(255,255,255,0)')
	context.fillStyle = gradient
	context.fillRect(0, 0, 128, 128)
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	return texture
}

function makeSelectionTexture(): CanvasTexture {
	const canvas = document.createElement('canvas')
	canvas.width = 128
	canvas.height = 128
	const context = canvas.getContext('2d')!
	context.clearRect(0, 0, 128, 128)
	context.strokeStyle = '#FFFFFF'
	context.lineWidth = 2
	context.beginPath()
	context.arc(64, 64, 51, 0, Math.PI * 2)
	context.stroke()
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	return texture
}

function makeMarkerTexture(): CanvasTexture {
	const canvas = document.createElement('canvas')
	canvas.width = 64
	canvas.height = 64
	const context = canvas.getContext('2d')!
	context.fillStyle = '#FFFFFF'
	context.beginPath()
	context.arc(32, 32, 24, 0, Math.PI * 2)
	context.fill()
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	return texture
}

function formatPhysicalDistance(au: number): string {
	if (au >= 0.1) return `${au.toLocaleString(undefined, { maximumSignificantDigits: 3 })} AU`
	const kilometres = au * 149_597_870.7
	if (kilometres >= 1_000_000) {
		return `${(kilometres / 1_000_000).toLocaleString(undefined, { maximumSignificantDigits: 3 })} million km`
	}
	return `${kilometres.toLocaleString(undefined, { maximumSignificantDigits: 3 })} km`
}

function unavailableRenderer(canvas: HTMLCanvasElement, reason: string, callbacks: MapRendererCallbacks): SystemMapRenderer {
	callbacks.onUnavailable?.(reason)
	callbacks.onOverlayChange?.({ labels: [], indicators: [], scaleLabel: '', legend: null, modeLabel: '', status: 'unavailable' })
	return {
		canvas,
		setData() {}, setDay() {}, setSettings() {}, setSelected() {}, setTheme() {}, resize() {}, resetView() {}, destroy() {},
	}
}

export async function createSystemMapRenderer(
	host: HTMLElement,
	initialTheme: ThemePalette,
	callbacks: MapRendererCallbacks,
): Promise<SystemMapRenderer> {
	const canvas = document.createElement('canvas')
	canvas.tabIndex = 0
	let context: WebGL2RenderingContext | null
	try {
		context = canvas.getContext('webgl2', {
			alpha: false,
			antialias: true,
			powerPreference: 'high-performance',
		})
	} catch {
		return unavailableRenderer(canvas, 'This map needs WebGL 2, which is unavailable in this browser.', callbacks)
	}
	if (!context) return unavailableRenderer(canvas, 'This map needs WebGL 2, which is unavailable in this browser.', callbacks)

	let renderer: WebGLRenderer
	try {
		renderer = new WebGLRenderer({ canvas, context, antialias: true, powerPreference: 'high-performance' })
	} catch (error) {
		return unavailableRenderer(canvas, error instanceof Error ? error.message : 'Three.js could not initialize WebGL 2.', callbacks)
	}
	renderer.outputColorSpace = SRGBColorSpace
	renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2))
	renderer.shadowMap.enabled = false

	const scene = new Scene()
	scene.background = new Color(initialTheme.page)
	const mapGroup = new Group()
	const orbitGroup = new Group()
	const trailGroup = new Group()
	const bodyGroup = new Group()
	mapGroup.add(orbitGroup, trailGroup, bodyGroup)
	scene.add(mapGroup)
	scene.add(new AmbientLight(0xFFFFFF, 1.45))
	const fillLight = new DirectionalLight(0xFFF1CF, 2.2)
	fillLight.position.set(-300, -220, 520)
	scene.add(fillLight)

	let width = Math.max(1, Math.round(host.getBoundingClientRect().width))
	let height = Math.max(1, Math.round(host.getBoundingClientRect().height || width))
	let halfWidth = SIZE / 2
	let halfHeight = SIZE / 2
	const camera = new OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, 10_000)
	camera.up.set(0, 0, 1)
	const controls = new OrbitControls(camera, canvas)
	controls.enableDamping = true
	controls.dampingFactor = 0.085
	controls.screenSpacePanning = true
	controls.zoomToCursor = true
	controls.minZoom = MIN_ZOOM
	controls.maxZoom = MAX_ZOOM
	controls.minPolarAngle = 0.015
	controls.maxPolarAngle = Math.PI / 2 - 0.015
	controls.touches.ONE = TOUCH.ROTATE
	controls.touches.TWO = TOUCH.DOLLY_PAN

	const sharedSphere = new SphereGeometry(1, 48, 32)
	sharedSphere.rotateX(Math.PI / 2)
	const glowTexture = makeGlowTexture()
	const markerTexture = makeMarkerTexture()
	const selectionTexture = makeSelectionTexture()
	let theme = initialTheme
	let settings = { ...DEFAULT_SETTINGS }
	let stars: MapBody[] = []
	let bodies: MapBody[] = []
	let selectedId: EntityKey | null = null
	let currentDay: number | null = null
	let dataReceived = false
	let layout: SystemLayout = buildPhysicalLayout([], [])
	const nodes = new Map<EntityKey, EntityNode>()
	let orbitPaths: OrbitPath[] = []
	let trailPaths: OrbitPath[] = []
	let viewBlend = 1
	let viewFrom = 1
	let viewTo = 1
	let viewStartedAt: number | null = null
	let fly: FlyState | null = null
	let lastFollowPosition: Vector3 | null = null
	let destroyed = false
	let visible = !document.hidden
	let intersecting = true
	let frameHandle = 0
	let overlaySignature = ''
	let dragStart: Vector2 | null = null
	let suppressClick = false
	let lastFrameAt = performance.now()
	const pressedPanKeys = new Set<string>()

	function setCameraForView(view: MapSettingsState['view'], preserveTarget = false) {
		const target = preserveTarget ? controls.target.clone() : new Vector3()
		const distance = 1_000
		if (view === 'plan') {
			// A tiny fixed polar offset avoids the Z-up look-at singularity while
			// keeping +X horizontal instead of introducing an arbitrary camera roll.
			const polar = controls.minPolarAngle
			camera.position.set(
				target.x,
				target.y - Math.sin(polar) * distance,
				target.z + Math.cos(polar) * distance,
			)
		} else {
			const polar = 42 * Math.PI / 180
			const azimuth = 35 * Math.PI / 180
			const horizontal = Math.sin(polar) * distance
			camera.position.set(
				target.x + Math.sin(azimuth) * horizontal,
				target.y - Math.cos(azimuth) * horizontal,
				target.z + Math.cos(polar) * distance,
			)
		}
		controls.target.copy(target)
		camera.lookAt(target)
		camera.updateProjectionMatrix()
	}

	function configureControls() {
		const plan = settings.view === 'plan'
		controls.enableRotate = !plan
		controls.mouseButtons.LEFT = plan ? MOUSE.PAN : MOUSE.ROTATE
		controls.mouseButtons.MIDDLE = MOUSE.DOLLY
		controls.mouseButtons.RIGHT = MOUSE.PAN
		controls.touches.ONE = plan ? TOUCH.PAN : TOUCH.ROTATE
	}

	setCameraForView('orrery')
	configureControls()

	function resizeLineMaterials() {
		for (const path of [...orbitPaths, ...trailPaths]) path.material.resolution.set(width, height)
	}

	function resize(nextWidth: number, nextHeight: number) {
		width = Math.max(1, Math.round(nextWidth))
		height = Math.max(1, Math.round(nextHeight))
		if (width >= height) {
			halfHeight = SIZE / 2
			halfWidth = halfHeight * width / height
		} else {
			halfWidth = SIZE / 2
			halfHeight = halfWidth * height / width
		}
		camera.left = -halfWidth
		camera.right = halfWidth
		camera.top = halfHeight
		camera.bottom = -halfHeight
		camera.updateProjectionMatrix()
		renderer.setSize(width, height, false)
		resizeLineMaterials()
		schedule()
	}

	function makeLine(color: string, widthPx: number, opacity: number, dashed = false): OrbitPath {
		const geometry = new LineGeometry()
		const material = new LineMaterial({
			color: new Color(color).getHex(),
			linewidth: widthPx,
			transparent: true,
			opacity,
			dashed,
			dashSize: 5,
			gapSize: 4,
			depthWrite: false,
		})
		material.resolution.set(width, height)
		const line = new Line2(geometry, material)
		return { key: 'body:0', geometry, material, line }
	}

	function disposePath(path: OrbitPath) {
		path.line.removeFromParent()
		path.geometry.dispose()
		path.material.dispose()
	}

	function clearSceneContent() {
		for (const node of nodes.values()) {
			node.visual.anchor.removeFromParent()
			node.visual.dispose()
		}
		for (const path of orbitPaths) disposePath(path)
		for (const path of trailPaths) disposePath(path)
		nodes.clear()
		orbitPaths = []
		trailPaths = []
	}

	function addNode(body: MapBody, isStar: boolean, isSatellite: boolean) {
		const key = keyForBody(body, isStar)
		const visual = createBodyVisual({
			body,
			isStar,
			isSatellite,
			sphereGeometry: sharedSphere,
			glowTexture,
			markerTexture,
			selectionTexture,
			selectionColor: theme.accent,
			worldUnitsPerAu: layout.worldUnitsPerAu ?? 1,
		})
		visual.anchor.userData.entityKey = key
		bodyGroup.add(visual.anchor)
		nodes.set(key, { key, body, isStar, isSatellite, visual })
	}

	function rebuild() {
		clearSceneContent()
		layout = buildPhysicalLayout(stars, bodies)
		if (layout.primaryStar) addNode(layout.primaryStar, true, false)
		for (const direct of layout.directOrbits) addNode(direct.body, direct.body.isStar, false)
		for (const satellite of layout.satellites) addNode(satellite.body, satellite.body.isStar, true)

		for (const direct of layout.directOrbits) {
			const path = makeLine(theme.faint, direct.outOfRange ? 1 : 1.25, direct.outOfRange ? 0.35 : 0.62, direct.outOfRange)
			path.key = keyForBody(direct.body, direct.body.isStar)
			path.direct = direct
			orbitGroup.add(path.line)
			orbitPaths.push(path)
		}
		for (const satellite of layout.satellites) {
			const path = makeLine(theme.faint, 1, 0.42, true)
			path.key = keyForBody(satellite.body, satellite.body.isStar)
			path.satellite = satellite
			orbitGroup.add(path.line)
			orbitPaths.push(path)
		}
		applyPositions()
		applySelection()
		schedule()
	}

	function updateOrbitPaths() {
		const positions = computePositions3D(layout, currentDay, viewBlend)
		for (const path of orbitPaths) {
			const points: number[] = []
			if (path.direct) {
				const orbit = path.direct
				for (let index = 0; index <= PATH_SEGMENTS; index++) {
					const angle = index / PATH_SEGMENTS * Math.PI * 2
					const point = orbitPoint3D(
						orbit.body, orbit.a, orbit.b, angle,
						orbit.outOfRange ? 0 : viewBlend, orbit.binaryFactor ?? 1,
					)
					points.push(point.x, point.y, point.z)
				}
				path.line.position.set(0, 0, 0)
			} else if (path.satellite) {
				const satellite = path.satellite
				const parent = positions.get(satellite.parentKey)
				if (!parent) continue
				const geometry = blendedSatelliteGeometry(satellite, 0)
				for (let index = 0; index <= PATH_SEGMENTS; index++) {
					const angle = index / PATH_SEGMENTS * Math.PI * 2
					const point = orbitPoint3D(satellite.body, geometry.radius, geometry.semiMinor, angle, viewBlend)
					points.push(point.x, point.y, point.z)
				}
				path.line.position.copy(worldPosition(parent))
			}
			path.geometry.setPositions(points)
			path.line.computeLineDistances()
		}
	}

	function rebuildTrails() {
		for (const path of trailPaths) disposePath(path)
		trailPaths = []
		if (settings.trails === 'off' || currentDay == null) return
		const sampleCount = settings.trails === 'short' ? 28 : 90
		for (const node of nodes.values()) {
			const points: number[] = []
			const period = node.body.orbitalPeriodDays
			if (period == null || period <= 0) continue
			const span = settings.trails === 'short' ? period * 0.08 : period
			for (let index = 0; index <= sampleCount; index++) {
				const day = currentDay - span + span * index / sampleCount
				const position = computePositions3D(layout, day, viewBlend).get(node.key)
				if (position) {
					const world = worldPosition(position)
					points.push(world.x, world.y, world.z)
				}
			}
			if (points.length < 6) continue
			const path = makeLine(theme.accentLight, 1.6, 0.34)
			path.key = node.key
			path.geometry.setPositions(points)
			path.line.computeLineDistances()
			trailGroup.add(path.line)
			trailPaths.push(path)
		}
	}

	function applyPositions() {
		const positions = computePositions3D(layout, currentDay, viewBlend)
		for (const [key, node] of nodes) {
			const position = positions.get(key)
			if (!position) continue
			node.visual.anchor.position.copy(worldPosition(position))
			node.visual.setDay(currentDay)
		}
		if (settings.follow && selectedId) {
			const next = positions.get(selectedId)
			if (next) {
				const world = worldPosition(next)
				if (lastFollowPosition) {
					const delta = world.clone().sub(lastFollowPosition)
					camera.position.add(delta)
					controls.target.add(delta)
				}
				lastFollowPosition = world
			}
		} else {
			lastFollowPosition = null
		}
		updateOrbitPaths()
		rebuildTrails()
	}

	function applySelection() {
		const family = buildSelectionFamily(stars, bodies, selectedId, layout.primaryStar)
		for (const [key, node] of nodes) node.visual.setSelected(key === selectedId, family.has(key))
	}

	function projectNode(node: EntityNode) {
		const projected = node.visual.anchor.getWorldPosition(new Vector3()).project(camera)
		return {
			x: (projected.x + 1) * width / 2,
			y: (1 - projected.y) * height / 2,
			inside: projected.z >= -1 && projected.z <= 1 && projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1,
		}
	}

	function worldUnitsPerPixel(): number {
		return halfHeight * 2 / (height * camera.zoom)
	}

	function updateVisualScales() {
		const scale = worldUnitsPerPixel()
		for (const node of nodes.values()) node.visual.setWorldUnitsPerPixel(scale)
	}

	function publishOverlay() {
		const labels: ProjectedLabel[] = []
		const indicators: OffscreenIndicator[] = []
		for (const node of nodes.values()) {
			const point = projectNode(node)
			const major = node.isStar || !node.isSatellite || (node.body.moonCount ?? 0) > 0
			const requested = settings.labels === 'all'
				|| (settings.labels === 'major' && major)
				|| (settings.labels === 'hovered' && node.key === selectedId)
			const crowded = settings.labels === 'major'
				&& node.key !== selectedId
				&& labels.some(label => Math.hypot(label.anchorX - point.x, label.anchorY - point.y) < 18)
			const show = requested && !crowded
			if (show && point.inside) {
				let labelY = point.y + node.visual.getScreenExtentPx() + 6
				while (labels.some(label => Math.abs(label.x - point.x) < 54 && Math.abs(label.y - labelY) < 14)) labelY += 14
				labels.push({
					key: node.key,
					name: node.body.name,
					x: point.x,
					y: labelY,
					anchorX: point.x,
					anchorY: point.y,
					selected: node.key === selectedId,
					major,
				})
			}
			if (node.key === selectedId && !point.inside) {
				const dx = point.x - width / 2
				const dy = point.y - height / 2
				const inset = 22
				const factor = Math.min(
					(width / 2 - inset) / Math.max(Math.abs(dx), 0.001),
					(height / 2 - inset) / Math.max(Math.abs(dy), 0.001),
				)
				indicators.push({
					key: node.key, name: node.body.name,
					x: width / 2 + dx * factor,
					y: height / 2 + dy * factor,
					angle: Math.atan2(dy, dx),
				})
			}
		}
		const scaleBarPixels = 80
		const scaleBarAu = layout.worldUnitsPerAu == null
			? null
			: scaleBarPixels * worldUnitsPerPixel() / layout.worldUnitsPerAu
		const snapshot: OverlaySnapshot = {
			labels,
			indicators,
			scaleLabel: 'Physical distance',
			legend: scaleBarAu == null
				? null
				: {
					pixels: scaleBarPixels,
					label: formatPhysicalDistance(scaleBarAu),
				},
			modeLabel: settings.view === 'plan' ? 'Plan' : 'Orrery',
			status: dataReceived ? 'ready' : 'initializing',
		}
		const signature = JSON.stringify(snapshot, (_key, value) => typeof value === 'number' ? Math.round(value * 2) / 2 : value)
		if (signature !== overlaySignature) {
			overlaySignature = signature
			callbacks.onOverlayChange?.(snapshot)
		}
	}

	function notifyView() {
		callbacks.onViewChange({ zoomLevel: camera.zoom, isMoved: Math.abs(camera.zoom - 1) > 0.001 || controls.target.lengthSq() > 0.01 })
	}

	function applyKeyboardPan(deltaSeconds: number): boolean {
		const horizontal = Number(pressedPanKeys.has('KeyD') || pressedPanKeys.has('ArrowRight'))
			- Number(pressedPanKeys.has('KeyA') || pressedPanKeys.has('ArrowLeft'))
		const vertical = Number(pressedPanKeys.has('KeyW') || pressedPanKeys.has('ArrowUp'))
			- Number(pressedPanKeys.has('KeyS') || pressedPanKeys.has('ArrowDown'))
		if (horizontal === 0 && vertical === 0) return false
		camera.updateMatrixWorld()
		const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
		const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
		const direction = right.multiplyScalar(horizontal).add(up.multiplyScalar(vertical)).normalize()
		const distance = KEYBOARD_PAN_SPEED * deltaSeconds / camera.zoom
		camera.position.addScaledVector(direction, distance)
		controls.target.addScaledVector(direction, distance)
		fly = null
		return true
	}

	function frame(now: number) {
		frameHandle = 0
		if (destroyed || !visible || !intersecting) return
		const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastFrameAt) / 1_000))
		lastFrameAt = now
		let animate = applyKeyboardPan(deltaSeconds)
		animate = controls.update() || animate
		if (viewStartedAt != null) {
			const progress = Math.min(1, (now - viewStartedAt) / VIEW_TRANSITION_MS)
			viewBlend = viewFrom + (viewTo - viewFrom) * ease(progress)
			applyPositions()
			if (progress >= 1) viewStartedAt = null
			else animate = true
		}
		if (fly) {
			const progress = Math.min(1, (now - fly.startedAt) / fly.duration)
			const t = ease(progress)
			controls.target.lerpVectors(fly.fromTarget, fly.toTarget, t)
			camera.position.lerpVectors(fly.fromCamera, fly.toCamera, t)
			camera.zoom = fly.fromZoom + (fly.toZoom - fly.fromZoom) * t
			camera.updateProjectionMatrix()
			if (progress >= 1) fly = null
			else animate = true
		}
		updateVisualScales()
		renderer.render(scene, camera)
		publishOverlay()
		notifyView()
		if (animate) schedule()
	}

	function schedule() {
		if (destroyed || frameHandle || !visible || !intersecting) return
		frameHandle = requestAnimationFrame(frame)
	}

	function closestNode(event: PointerEvent): { node: EntityNode, position: { x: number, y: number } } | null {
		const rect = canvas.getBoundingClientRect()
		const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
		let nearest: { node: EntityNode, position: { x: number, y: number }, distance: number } | null = null
		for (const node of nodes.values()) {
			const point = projectNode(node)
			if (!point.inside) continue
			const distance = Math.hypot(pointer.x - point.x, pointer.y - point.y)
			const pickRadius = Math.max(8, node.visual.getScreenExtentPx() + 3)
			if (distance <= pickRadius && (!nearest || distance < nearest.distance)) nearest = { node, position: pointer, distance }
		}
		return nearest
	}

	function handlePointerMove(event: PointerEvent) {
		if (dragStart && Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 4) suppressClick = true
		const hit = closestNode(event)
		callbacks.onHover(hit?.node.body ?? null, hit?.position ?? null)
		canvas.style.cursor = hit ? 'pointer' : ''
	}
	function handlePointerLeave() {
		callbacks.onHover(null, null)
	}
	function handlePointerDown(event: PointerEvent) {
		canvas.focus({ preventScroll: true })
		dragStart = new Vector2(event.clientX, event.clientY)
		suppressClick = false
	}
	function handlePointerUp() {
		dragStart = null
	}
	function handleClick(event: MouseEvent) {
		if (suppressClick) return
		const hit = closestNode(event as PointerEvent)
		callbacks.onSelect(hit?.node.key ?? null)
	}
	function handleDoubleClick(event: MouseEvent) {
		const hit = closestNode(event as PointerEvent)
		if (!hit) return
		callbacks.onHover(null, null)
		canvas.style.cursor = ''
		const target = hit.node.visual.anchor.position.clone()
		const offset = camera.position.clone().sub(controls.target)
		const targetZoom = Math.min(
			MAX_ZOOM,
			Math.max(camera.zoom, 60 * worldUnitsPerPixel() * camera.zoom / Math.max(hit.node.visual.radius, Number.EPSILON)),
		)
		if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			controls.target.copy(target)
			camera.position.copy(target).add(offset)
			camera.zoom = targetZoom
			camera.updateProjectionMatrix()
			fly = null
		} else {
			fly = {
				startedAt: performance.now(),
				duration: FLY_TO_MS,
				fromTarget: controls.target.clone(), toTarget: target,
				fromCamera: camera.position.clone(), toCamera: target.clone().add(offset),
				fromZoom: camera.zoom, toZoom: targetZoom,
			}
		}
		schedule()
	}
	function handleContextLost(event: Event) {
		event.preventDefault()
		callbacks.onUnavailable?.('The graphics context was lost. Reload the page to restore the interactive map.')
		callbacks.onOverlayChange?.({ labels: [], indicators: [], scaleLabel: '', legend: null, modeLabel: '', status: 'unavailable' })
	}
	function handleKeyDown(event: KeyboardEvent) {
		if (!PAN_KEYS.has(event.code) || event.altKey || event.ctrlKey || event.metaKey) return
		event.preventDefault()
		pressedPanKeys.add(event.code)
		lastFrameAt = performance.now()
		schedule()
	}
	function handleKeyUp(event: KeyboardEvent) {
		if (!PAN_KEYS.has(event.code)) return
		event.preventDefault()
		pressedPanKeys.delete(event.code)
	}
	function handleCanvasBlur() {
		pressedPanKeys.clear()
	}
	function handleVisibility() {
		visible = !document.hidden
		pressedPanKeys.clear()
		lastFrameAt = performance.now()
		if (visible) schedule()
	}

	canvas.addEventListener('pointermove', handlePointerMove)
	canvas.addEventListener('pointerleave', handlePointerLeave)
	canvas.addEventListener('pointerdown', handlePointerDown)
	canvas.addEventListener('pointerup', handlePointerUp)
	canvas.addEventListener('click', handleClick)
	canvas.addEventListener('dblclick', handleDoubleClick)
	canvas.addEventListener('wheel', trapWheel, { passive: false })
	canvas.addEventListener('webglcontextlost', handleContextLost)
	canvas.addEventListener('keydown', handleKeyDown)
	canvas.addEventListener('keyup', handleKeyUp)
	canvas.addEventListener('blur', handleCanvasBlur)
	controls.addEventListener('change', schedule)
	document.addEventListener('visibilitychange', handleVisibility)
	const intersectionObserver = new IntersectionObserver((entries) => {
		intersecting = entries.at(-1)?.isIntersecting ?? true
		if (intersecting) schedule()
	})
	intersectionObserver.observe(host)

	resize(width, height)
	callbacks.onOverlayChange?.({ labels: [], indicators: [], scaleLabel: '', legend: null, modeLabel: 'Orrery', status: 'initializing' })
	rebuild()

	return {
		canvas,
		setData(nextStars, nextBodies) {
			stars = nextStars
			bodies = nextBodies
			dataReceived = true
			rebuild()
		},
		setDay(day) {
			currentDay = day
			applyPositions()
			schedule()
		},
		setSettings(next) {
			const rebuildTrail = next.trails !== settings.trails
			const viewChanged = next.view !== settings.view
			settings = { ...next }
			configureControls()
			if (rebuildTrail) rebuildTrails()
			if (viewChanged) {
				viewFrom = viewBlend
				viewTo = settings.view === 'orrery' ? 1 : 0
				if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
					viewBlend = viewTo
					viewStartedAt = null
					setCameraForView(settings.view, true)
					applyPositions()
				} else {
					viewStartedAt = performance.now()
					const fromCamera = camera.position.clone()
					const fromTarget = controls.target.clone()
					setCameraForView(settings.view, true)
					fly = {
						startedAt: viewStartedAt,
						duration: VIEW_TRANSITION_MS,
						fromCamera,
						fromTarget,
						toCamera: camera.position.clone(),
						toTarget: controls.target.clone(),
						fromZoom: camera.zoom,
						toZoom: camera.zoom,
					}
					camera.position.copy(fromCamera)
					controls.target.copy(fromTarget)
				}
			}
			if (!settings.follow) lastFollowPosition = null
			schedule()
		},
		setSelected(id) {
			selectedId = id
			lastFollowPosition = null
			applySelection()
			schedule()
		},
		setTheme(nextTheme) {
			theme = nextTheme
			scene.background = new Color(theme.page)
			rebuild()
		},
		resize,
		resetView() {
			camera.zoom = 1
			controls.target.set(0, 0, 0)
			setCameraForView(settings.view)
			lastFollowPosition = null
			controls.update()
			schedule()
		},
		destroy() {
			if (destroyed) return
			destroyed = true
			if (frameHandle) cancelAnimationFrame(frameHandle)
			intersectionObserver.disconnect()
			document.removeEventListener('visibilitychange', handleVisibility)
			canvas.removeEventListener('pointermove', handlePointerMove)
			canvas.removeEventListener('pointerleave', handlePointerLeave)
			canvas.removeEventListener('pointerdown', handlePointerDown)
			canvas.removeEventListener('pointerup', handlePointerUp)
			canvas.removeEventListener('click', handleClick)
			canvas.removeEventListener('dblclick', handleDoubleClick)
			canvas.removeEventListener('wheel', trapWheel)
			canvas.removeEventListener('webglcontextlost', handleContextLost)
			canvas.removeEventListener('keydown', handleKeyDown)
			canvas.removeEventListener('keyup', handleKeyUp)
			canvas.removeEventListener('blur', handleCanvasBlur)
			controls.removeEventListener('change', schedule)
			controls.dispose()
			clearSceneContent()
			sharedSphere.dispose()
			glowTexture.dispose()
			markerTexture.dispose()
			selectionTexture.dispose()
			renderer.dispose()
			renderer.forceContextLoss()
		},
	}
}

export type { MapRendererCallbacks, MapSettingsState, SystemMapRenderer } from '../renderer-types.js'
