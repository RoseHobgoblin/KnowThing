import {
	ACESFilmicToneMapping,
	AdditiveBlending,
	CanvasTexture,
	Color,
	Group,
	MOUSE,
	OrthographicCamera,
	PerspectiveCamera,
	Scene,
	SphereGeometry,
	Sprite,
	SpriteMaterial,
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
	type RootLayout,
	type ThemePalette,
} from '../root-layout.js'
import { resolveHostStarTemperatureK } from '../stellar-surface-model.js'
import {
	apparentSkyDirectionForRenderer,
	resolveApparentSkyVisual,
	type ApparentSkyResult,
	type ApparentSkySource,
	type RootSelectionKey,
} from '../apparent-sky.js'
import type {
	MapRendererCallbacks,
	MapSettingsState,
	OffscreenIndicator,
	OverlaySnapshot,
	ProjectedLabel,
	RootMapRenderer,
} from '../renderer-types.js'
import { placeRootLabel } from '../root-label-layout.js'
import { createBodyVisual, type BodyVisual } from './body-visual.js'
import {
	constrainPointOutsideSphere,
	orthographicZoomForWorldUnitsPerPixel,
	perspectiveDistanceForWorldUnitsPerPixel,
	perspectiveDistanceToFrameSphere,
	perspectiveWorldUnitsPerPixel,
} from './camera-math.js'
import {
	DASH_GAP_PX,
	DASH_SIZE_PX,
	ORBIT_SEGMENTS,
	closedOrbitAngles,
	screenDashScale,
} from './orbit-path-policy.js'
import {
	DEFAULT_STARLIGHT_EXPOSURE,
	StarlightController,
	focusedStarlightTarget,
	resolveStarlightExposure,
} from './starlight-controller.js'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 1_000_000
const ORRERY_FOV_DEG = 50
const VIEW_TRANSITION_MS = 450
const FLY_TO_MS = 600
const KEYBOARD_PAN_SPEED_PX = 210
const CAMERA_ZOOM_SPEED = 1.8
const CAMERA_SURFACE_CLEARANCE = 1.03
const PLAN_CAMERA_DISTANCE = 1_000
const FOCUS_RADIUS_PX = 60
const SKY_RADIUS = 5_000
const PAN_KEYS = new Set([
	'KeyW', 'KeyA', 'KeyS', 'KeyD',
	'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
])
const DEFAULT_SETTINGS: MapSettingsState = {
	scale: 'log', labels: 'major', skyLabels: 'off', trails: 'off', follow: false, view: 'orrery', visibility: 'enhanced',
}

type EntityNode = {
	key: EntityKey
	body: MapBody
	isStar: boolean
	isSatellite: boolean
	visual: BodyVisual
}

type SkyNode = {
	key: RootSelectionKey
	source: ApparentSkySource
	sprite: Sprite
	selection: Sprite
	visual: ReturnType<typeof resolveApparentSkyVisual>
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

/** A compact point-spread profile: unresolved light, not a map pin. */
function makeSkyPointTexture(): CanvasTexture {
	const canvas = document.createElement('canvas')
	canvas.width = 128
	canvas.height = 128
	const context = canvas.getContext('2d')!
	const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
	gradient.addColorStop(0, 'rgba(255,255,255,1)')
	gradient.addColorStop(0.06, 'rgba(255,255,255,1)')
	gradient.addColorStop(0.18, 'rgba(255,255,255,0.58)')
	gradient.addColorStop(0.48, 'rgba(255,255,255,0.1)')
	gradient.addColorStop(1, 'rgba(255,255,255,0)')
	context.fillStyle = gradient
	context.fillRect(0, 0, 128, 128)
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

function unavailableRenderer(canvas: HTMLCanvasElement, reason: string, callbacks: MapRendererCallbacks): RootMapRenderer {
	callbacks.onUnavailable?.(reason)
	callbacks.onOverlayChange?.({ labels: [], indicators: [], legend: null, projection: null, status: 'unavailable' })
	return {
		canvas,
		setData() {}, setDay() {}, setSettings() {}, setSelected() {}, setTheme() {}, resize() {}, resetView() {},
		getCameraState() { return null }, setCameraState() {}, destroy() {},
	}
}

export async function createRootMapRenderer(
	host: HTMLElement,
	initialTheme: ThemePalette,
	callbacks: MapRendererCallbacks,
): Promise<RootMapRenderer> {
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
		renderer = new WebGLRenderer({
			canvas,
			context,
			antialias: true,
			powerPreference: 'high-performance',
			logarithmicDepthBuffer: true,
		})
	} catch (error) {
		return unavailableRenderer(canvas, error instanceof Error ? error.message : 'Three.js could not initialize WebGL 2.', callbacks)
	}
	renderer.outputColorSpace = SRGBColorSpace
	renderer.toneMapping = ACESFilmicToneMapping
	renderer.toneMappingExposure = DEFAULT_STARLIGHT_EXPOSURE
	renderer.setClearColor(0x000000, 1)
	renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2))
	renderer.shadowMap.enabled = false

	const scene = new Scene()
	scene.background = new Color(0x000000)
	const skyGroup = new Group()
	skyGroup.name = 'authored-apparent-sky'
	const mapGroup = new Group()
	const orbitGroup = new Group()
	const trailGroup = new Group()
	const bodyGroup = new Group()
	const starlight = new StarlightController()
	starlight.setVisibilityMode(DEFAULT_SETTINGS.visibility)
	mapGroup.add(orbitGroup, trailGroup, bodyGroup, starlight.group)
	scene.add(skyGroup, mapGroup)

	let width = Math.max(1, Math.round(host.getBoundingClientRect().width))
	let height = Math.max(1, Math.round(host.getBoundingClientRect().height || width))
	let halfWidth = SIZE / 2
	let halfHeight = SIZE / 2
	const planCamera = new OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, 10_000)
	const orreryCamera = new PerspectiveCamera(ORRERY_FOV_DEG, width / height, 0.001, 10_000)
	planCamera.up.set(0, 0, 1)
	orreryCamera.up.set(0, 0, 1)
	let camera: OrthographicCamera | PerspectiveCamera = orreryCamera
	const controls = new OrbitControls<OrthographicCamera | PerspectiveCamera>(camera, canvas)
	controls.enableDamping = true
	controls.dampingFactor = 0.085
	controls.screenSpacePanning = true
	controls.zoomToCursor = true
	controls.zoomSpeed = CAMERA_ZOOM_SPEED
	controls.minZoom = MIN_ZOOM
	controls.maxZoom = MAX_ZOOM
	controls.minDistance = 0.001
	controls.maxDistance = 10_000
	controls.minPolarAngle = 0.015
	controls.maxPolarAngle = Math.PI / 2 - 0.015
	controls.touches.ONE = TOUCH.ROTATE
	controls.touches.TWO = TOUCH.DOLLY_PAN

	// Shared geometry is cheap compared with per-body materials and remains
	// smooth when a 1024×512 plate is inspected at close zoom.
	const sharedSphere = new SphereGeometry(1, 96, 64)
	sharedSphere.rotateX(Math.PI / 2)
	const glowTexture = makeGlowTexture()
	const markerTexture = makeMarkerTexture()
	const selectionTexture = makeSelectionTexture()
	const skyPointTexture = makeSkyPointTexture()
	let theme = initialTheme
	let settings = { ...DEFAULT_SETTINGS }
	let stars: MapBody[] = []
	let bodies: MapBody[] = []
	let apparentSky: ApparentSkyResult = {
		status: 'unavailable', reason: 'Apparent-sky data has not loaded.', sector: null, sources: [],
		diagnostics: {
			observerRoot: 0, incompatibleSectorRoots: 0, unpositionedRoots: 0,
			starlessRoots: 0, coincidentRoots: 0, incompleteBrightnessSources: 0,
		},
	}
	let selectedId: RootSelectionKey | null = null
	let hoveredId: RootSelectionKey | null = null
	let currentDay: number | null = null
	let dataReceived = false
	let visualsReady = false
	let visualGeneration = 0
	let lodGeneration = 0
	let layout: RootLayout = buildPhysicalLayout([], [])
	const nodes = new Map<EntityKey, EntityNode>()
	const skyNodes = new Map<RootSelectionKey, SkyNode>()
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
	const scratchWorld = new Vector3()
	const scratchView = new Vector3()
	const previousCameraPosition = new Vector3()

	function defaultCameraDirection(view: MapSettingsState['view']): Vector3 {
		if (view === 'plan') {
			// The tiny Y component avoids the Z-up look-at singularity without
			// introducing a visible roll in the top-down Plan view.
			const polar = 0.015
			return new Vector3(0, -Math.sin(polar), Math.cos(polar)).normalize()
		}
		const polar = 42 * Math.PI / 180
		const azimuth = 35 * Math.PI / 180
		return new Vector3(
			Math.sin(azimuth) * Math.sin(polar),
			-Math.cos(azimuth) * Math.sin(polar),
			Math.cos(polar),
		).normalize()
	}

	function orreryFrameDistance(): number {
		return perspectiveDistanceToFrameSphere(
			Math.max(layout.maxVisualRadius, SIZE * 0.45),
			width / height,
			orreryCamera.fov,
		)
	}

	function updateControlDistanceLimits() {
		const frameDistance = orreryFrameDistance()
		controls.minDistance = frameDistance / MAX_ZOOM
		controls.maxDistance = frameDistance / MIN_ZOOM
	}

	function resetCameraForView(view: MapSettingsState['view'], target = new Vector3()) {
		camera = view === 'plan' ? planCamera : orreryCamera
		controls.object = camera
		controls.target.copy(target)
		camera.zoom = 1
		const distance = view === 'plan' ? PLAN_CAMERA_DISTANCE : orreryFrameDistance()
		camera.position.copy(target).addScaledVector(defaultCameraDirection(view), distance)
		camera.lookAt(target)
		camera.updateProjectionMatrix()
		updateControlDistanceLimits()
	}

	function switchCameraForView(view: MapSettingsState['view'], immediate: boolean) {
		const activeView = camera === planCamera ? 'plan' : 'orrery'
		const activeZoom = camera === planCamera
			? camera.zoom
			: orreryFrameDistance() / Math.max(camera.position.distanceTo(controls.target), Number.EPSILON)
		const activeDirection = camera.position.clone().sub(controls.target).normalize()
		const sourceWasDefault = controls.target.lengthSq() <= 0.01
			&& Math.abs(activeZoom - 1) <= 0.001
			&& activeDirection.dot(defaultCameraDirection(activeView)) >= 0.9999
		const target = sourceWasDefault ? new Vector3() : controls.target.clone()
		const matchedScale = worldUnitsPerPixelAt(target)
		const sourceDirection = camera.position.clone().sub(controls.target)
		if (sourceDirection.lengthSq() < Number.EPSILON) sourceDirection.copy(defaultCameraDirection(view))
		else sourceDirection.normalize()

		camera = view === 'plan' ? planCamera : orreryCamera
		controls.object = camera
		controls.target.copy(target)

		let distance = PLAN_CAMERA_DISTANCE
		if (camera === planCamera) {
			camera.zoom = sourceWasDefault
				? 1
				: Math.min(
					MAX_ZOOM,
					Math.max(MIN_ZOOM, orthographicZoomForWorldUnitsPerPixel(halfHeight * 2, height, matchedScale)),
				)
		} else {
			camera.zoom = 1
			distance = sourceWasDefault
				? orreryFrameDistance()
				: perspectiveDistanceForWorldUnitsPerPixel(matchedScale, height, orreryCamera.fov)
		}
		camera.updateProjectionMatrix()
		updateControlDistanceLimits()

		const fromCamera = target.clone().addScaledVector(sourceDirection, distance)
		const toCamera = target.clone().addScaledVector(defaultCameraDirection(view), distance)
		camera.position.copy(immediate ? toCamera : fromCamera)
		camera.lookAt(target)
		configureControls()

		if (immediate) {
			fly = null
			controls.update()
		} else {
			fly = {
				startedAt: performance.now(),
				duration: VIEW_TRANSITION_MS,
				fromCamera,
				toCamera,
				fromTarget: target.clone(),
				toTarget: target,
				fromZoom: camera.zoom,
				toZoom: camera.zoom,
			}
		}
	}

	function configureControls() {
		const plan = settings.view === 'plan'
		controls.enableRotate = !plan
		controls.mouseButtons.LEFT = plan ? MOUSE.PAN : MOUSE.ROTATE
		controls.mouseButtons.MIDDLE = MOUSE.DOLLY
		controls.mouseButtons.RIGHT = MOUSE.PAN
		controls.touches.ONE = plan ? TOUCH.PAN : TOUCH.ROTATE
	}

	resetCameraForView('orrery')
	configureControls()

	function resizeLineMaterials() {
		for (const path of [...orbitPaths, ...trailPaths]) path.material.resolution.set(width, height)
	}

	function clearSky() {
		for (const node of skyNodes.values()) {
			node.sprite.removeFromParent()
			node.selection.removeFromParent()
			;(node.sprite.material as SpriteMaterial).dispose()
			;(node.selection.material as SpriteMaterial).dispose()
		}
		skyNodes.clear()
	}

	function updateSkyVisuals() {
		skyGroup.visible = settings.view === 'orrery'
		const unitsPerPixel = perspectiveWorldUnitsPerPixel(SKY_RADIUS, height, orreryCamera.fov)
		for (const node of skyNodes.values()) {
			node.visual = resolveApparentSkyVisual(node.source, settings.visibility)
			const diameter = Math.max(1, node.visual.sizePx * 3.2) * unitsPerPixel
			node.sprite.scale.setScalar(diameter)
			node.sprite.visible = node.visual.visible
			;(node.sprite.material as SpriteMaterial).opacity = node.visual.opacity
			node.selection.scale.setScalar(diameter + 10 * unitsPerPixel)
			node.selection.visible = node.visual.visible && node.key === selectedId
		}
	}

	function rebuildSky() {
		clearSky()
		for (const source of apparentSky.sources) {
			const material = new SpriteMaterial({
				map: skyPointTexture,
				color: new Color(source.displayColor),
				transparent: true,
				blending: AdditiveBlending,
				depthTest: true,
				depthWrite: false,
				toneMapped: false,
			})
			const sprite = new Sprite(material)
			const rendererDirection = apparentSkyDirectionForRenderer(
				source.direction,
				apparentSky.sector?.handedness ?? 'right-handed',
			)
			sprite.position.fromArray(rendererDirection).multiplyScalar(SKY_RADIUS)
			sprite.renderOrder = -100

			const selection = new Sprite(new SpriteMaterial({
				map: selectionTexture,
				color: new Color(theme.accent),
				transparent: true,
				depthTest: true,
				depthWrite: false,
				toneMapped: false,
			}))
			selection.position.copy(sprite.position)
			selection.renderOrder = -99
			skyGroup.add(sprite, selection)
			skyNodes.set(source.key, {
				key: source.key,
				source,
				sprite,
				selection,
				visual: resolveApparentSkyVisual(source, settings.visibility),
			})
		}
		updateSkyVisuals()
	}

	function resize(nextWidth: number, nextHeight: number) {
		const previousOrreryZoom = camera === orreryCamera
			? orreryFrameDistance() / Math.max(camera.position.distanceTo(controls.target), Number.EPSILON)
			: null
		width = Math.max(1, Math.round(nextWidth))
		height = Math.max(1, Math.round(nextHeight))
		if (width >= height) {
			halfHeight = SIZE / 2
			halfWidth = halfHeight * width / height
		} else {
			halfWidth = SIZE / 2
			halfHeight = halfWidth * height / width
		}
		planCamera.left = -halfWidth
		planCamera.right = halfWidth
		planCamera.top = halfHeight
		planCamera.bottom = -halfHeight
		planCamera.updateProjectionMatrix()
		orreryCamera.aspect = width / height
		orreryCamera.updateProjectionMatrix()
		if (previousOrreryZoom != null) {
			const direction = camera.position.clone().sub(controls.target).normalize()
			camera.position.copy(controls.target).addScaledVector(direction, orreryFrameDistance() / previousOrreryZoom)
			fly = null
		}
		updateControlDistanceLimits()
		renderer.setSize(width, height, false)
		resizeLineMaterials()
		updateSkyVisuals()
		schedule()
		queueMicrotask(settleTextureLods)
	}

	function makeLine(color: string, widthPx: number, opacity: number, dashed = false): OrbitPath {
		const geometry = new LineGeometry()
		const material = new LineMaterial({
			color: new Color(color).getHex(),
			linewidth: widthPx,
			transparent: true,
			opacity,
			dashed,
			dashSize: DASH_SIZE_PX,
			gapSize: DASH_GAP_PX,
			depthTest: true,
			depthWrite: false,
			alphaToCoverage: true,
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1,
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
		starlight.clearStarLights()
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
		let renderBody = body.isStar === isStar ? body : { ...body, isStar }
		if (!isStar) {
			renderBody = {
				...renderBody,
				hostStarTemperatureK: resolveHostStarTemperatureK(stars, {
					starId: renderBody.starId,
					systemId: renderBody.parentSystemId,
				}),
			}
		}
		const key = keyForBody(renderBody, isStar)
		const visual = createBodyVisual({
			body: renderBody,
			isStar,
			isSatellite,
			sphereGeometry: sharedSphere,
			glowTexture,
			markerTexture,
			selectionTexture,
			selectionColor: theme.accent,
			worldUnitsPerAu: layout.worldUnitsPerAu ?? 1,
			onTextureChange: schedule,
		})
		visual.anchor.userData.entityKey = key
		bodyGroup.add(visual.anchor)
		nodes.set(key, { key, body: renderBody, isStar, isSatellite, visual })
	}

	function rebuild() {
		const generation = ++visualGeneration
		visualsReady = false
		clearSceneContent()
		rebuildSky()
		layout = buildPhysicalLayout(stars, bodies)
		if (layout.primaryStar) addNode(layout.primaryStar, true, false)
		if (layout.rootBody) addNode(layout.rootBody, false, false)
		for (const direct of layout.directOrbits) addNode(direct.body, direct.body.isStar, false)
		for (const satellite of layout.satellites) addNode(satellite.body, satellite.body.isStar, true)
		publishTextureLodDiagnostics()
		starlight.rebuild(
			[...nodes.values()].filter(node => node.isStar).map(node => node.body),
			layout.worldUnitsPerAu ?? 1,
		)

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
		void Promise.allSettled([...nodes.values()].map(node => node.visual.ready)).then(() => {
			if (destroyed || generation !== visualGeneration) return
			visualsReady = true
			settleTextureLods()
			schedule()
		})
	}

	function updateOrbitPaths() {
		const positions = computePositions3D(layout, currentDay, viewBlend)
		for (const path of orbitPaths) {
			const points: number[] = []
			const bodyPosition = positions.get(path.key)
			if (path.direct) {
				const orbit = path.direct
				const factor = orbit.binaryFactor ?? 1
				for (const angle of closedOrbitAngles(ORBIT_SEGMENTS, bodyPosition ? [bodyPosition.angle] : [])) {
					const point = orbitPoint3D(
						orbit.body, orbit.a, orbit.b, angle,
						orbit.outOfRange ? 0 : viewBlend, factor,
					)
					points.push(point.x, point.y, point.z)
				}
				path.line.position.set(0, 0, 0)
			} else if (path.satellite) {
				const satellite = path.satellite
				const parent = positions.get(satellite.parentKey)
				if (!parent) continue
				const geometry = blendedSatelliteGeometry(satellite, 0)
				for (const angle of closedOrbitAngles(ORBIT_SEGMENTS, bodyPosition ? [bodyPosition.angle] : [])) {
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
			const world = worldPosition(position)
			node.visual.anchor.position.copy(world)
			if (node.isStar) starlight.setPosition(key, world)
			node.visual.setDay(currentDay)
		}
		const followedId = selectedId?.startsWith('sky-root:') ? null : selectedId as EntityKey | null
		if (settings.follow && followedId) {
			const next = positions.get(followedId)
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
		const localSelection = selectedId?.startsWith('sky-root:') ? null : selectedId as EntityKey | null
		const family = buildSelectionFamily(stars, bodies, localSelection, layout.primaryStar)
		for (const [key, node] of nodes) node.visual.setSelected(key === selectedId, family.has(key))
		for (const node of skyNodes.values()) {
			node.selection.visible = skyGroup.visible && node.visual.visible && node.key === selectedId
		}
	}

	function projectNode(node: EntityNode) {
		const projected = node.visual.anchor.getWorldPosition(new Vector3()).project(camera)
		return {
			x: (projected.x + 1) * width / 2,
			y: (1 - projected.y) * height / 2,
			inside: projected.z >= -1 && projected.z <= 1 && projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1,
		}
	}

	function projectSkyNode(node: SkyNode) {
		const projected = node.sprite.getWorldPosition(new Vector3()).project(camera)
		return {
			x: (projected.x + 1) * width / 2,
			y: (1 - projected.y) * height / 2,
			inside: skyGroup.visible && node.visual.visible
				&& projected.z >= -1 && projected.z <= 1
				&& projected.x >= -1 && projected.x <= 1
				&& projected.y >= -1 && projected.y <= 1,
		}
	}

	function worldUnitsPerPixelAt(position: Vector3): number {
		if (camera === planCamera) return halfHeight * 2 / (height * camera.zoom)
		camera.updateMatrixWorld()
		scratchView.copy(position).applyMatrix4(camera.matrixWorldInverse)
		return perspectiveWorldUnitsPerPixel(Math.max(-scratchView.z, Number.EPSILON), height, orreryCamera.fov)
	}

	function textureWorldUnitsPerPixelAt(position: Vector3): number {
		if (camera === planCamera) return worldUnitsPerPixelAt(position)
		camera.updateMatrixWorld()
		scratchView.copy(position).applyMatrix4(camera.matrixWorldInverse)
		if (scratchView.z >= -camera.near) return Number.POSITIVE_INFINITY
		return perspectiveWorldUnitsPerPixel(-scratchView.z, height, orreryCamera.fov)
	}

	function updateVisualScales() {
		camera.updateMatrixWorld()
		for (const node of nodes.values()) {
			node.visual.anchor.getWorldPosition(scratchWorld)
			node.visual.setVisibility(settings.visibility, worldUnitsPerPixelAt(scratchWorld))
		}
		for (const path of orbitPaths) {
			if (!path.material.dashed) continue
			const node = nodes.get(path.key)
			const representative = node
				? node.visual.anchor.getWorldPosition(scratchWorld)
				: controls.target
			path.material.dashScale = screenDashScale(worldUnitsPerPixelAt(representative))
		}
	}

	function publishTextureLodDiagnostics() {
		const desiredCounts = { 256: 0, 512: 0, 1024: 0 }
		const settledCounts = { 256: 0, 512: 0, 1024: 0 }
		let pending = 0
		for (const node of nodes.values()) {
			const lod = node.visual.getProceduralLod()
			desiredCounts[lod.desired]++
			if (lod.settled == null) pending++
			else settledCounts[lod.settled]++
		}
		const desiredSizes = ([256, 512, 1024] as const).filter(size => desiredCounts[size] > 0)
		canvas.dataset.textureLodInitial = '256'
		canvas.dataset.textureLodTotal = String(nodes.size)
		canvas.dataset.textureLodDesired = JSON.stringify(desiredCounts)
		canvas.dataset.textureLodSettled = JSON.stringify(settledCounts)
		canvas.dataset.textureLodDesiredMax = String(desiredSizes.at(-1) ?? 256)
		canvas.dataset.textureLodPending = String(pending)
	}

	function settleTextureLods() {
		if (destroyed || nodes.size === 0) return
		camera.updateMatrixWorld()
		const tasks: Promise<void>[] = []
		for (const node of nodes.values()) {
			node.visual.anchor.getWorldPosition(scratchWorld)
			const before = node.visual.getProceduralLod()
			const task = node.visual.settleProceduralLod(textureWorldUnitsPerPixelAt(scratchWorld))
			const after = node.visual.getProceduralLod()
			node.visual.anchor.userData.textureLod = after
			if (before.desired !== after.desired || after.settled !== after.desired) tasks.push(task)
		}
		publishTextureLodDiagnostics()
		if (tasks.length === 0) return
		const generation = visualGeneration
		const lodRun = ++lodGeneration
		visualsReady = false
		schedule()
		void Promise.allSettled(tasks).then(() => {
			if (destroyed || generation !== visualGeneration || lodRun !== lodGeneration) return
			for (const node of nodes.values()) {
				node.visual.anchor.userData.textureLod = node.visual.getProceduralLod()
			}
			visualsReady = [...nodes.values()].every((node) => {
				const lod = node.visual.getProceduralLod()
				return lod.settled === lod.desired
			})
			publishTextureLodDiagnostics()
			schedule()
		})
	}

	function updatePerspectiveClipping() {
		if (camera !== orreryCamera) return
		const distance = Math.max(camera.position.distanceTo(controls.target), Number.EPSILON)
		const frameDistance = orreryFrameDistance()
		const near = Math.max(1e-9, distance / 1_000)
		const far = Math.max(frameDistance * 4, distance + SIZE * 2, SKY_RADIUS * 1.1)
		if (Math.abs(camera.near - near) / near > 0.001 || Math.abs(camera.far - far) / far > 0.001) {
			camera.near = near
			camera.far = far
			camera.updateProjectionMatrix()
		}
	}

	function constrainCameraOutsideBodies(): boolean {
		if (camera !== orreryCamera) return false
		let constrained = false
		for (const node of nodes.values()) {
			node.visual.anchor.getWorldPosition(scratchWorld)
			constrained = constrainPointOutsideSphere(
				camera.position,
				previousCameraPosition,
				scratchWorld,
				node.visual.radius * CAMERA_SURFACE_CLEARANCE,
			) || constrained
		}
		return constrained
	}

	function publishOverlay() {
		const labels: ProjectedLabel[] = []
		const indicators: OffscreenIndicator[] = []
		for (const node of nodes.values()) {
			const point = projectNode(node)
			const major = node.isStar || !node.isSatellite || (node.body.moonCount ?? 0) > 0
			const requested = settings.labels === 'all'
				|| (settings.labels === 'major' && major)
				|| (settings.labels === 'hovered' && (node.key === hoveredId || node.key === selectedId))
			if (requested && point.inside) {
				const placement = placeRootLabel(
					point.x,
					point.y,
					node.visual.getScreenExtentPx(),
					height,
					labels,
				)
				labels.push({
					key: node.key,
					name: node.body.name,
					x: placement.x,
					y: placement.y,
					anchorX: point.x,
					anchorY: point.y,
					selected: node.key === selectedId,
					major,
					pillar: placement.pillar,
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
		for (const node of skyNodes.values()) {
			if (!skyGroup.visible || !node.visual.visible) continue
			const point = projectSkyNode(node)
			const requested = settings.skyLabels === 'all'
				|| (settings.skyLabels === 'major' && node.visual.major)
				|| (settings.skyLabels === 'hovered' && (node.key === hoveredId || node.key === selectedId))
			const crowded = settings.skyLabels === 'major'
				&& node.key !== selectedId
				&& labels.some(label => Math.hypot(label.anchorX - point.x, label.anchorY - point.y) < 18)
			if (requested && !crowded && point.inside) {
				let labelY = point.y + node.visual.sizePx * 1.6 + 6
				while (labels.some(label => Math.abs(label.x - point.x) < 54 && Math.abs(label.y - labelY) < 14)) labelY += 14
				labels.push({
					key: node.key,
					name: node.source.rootName,
					x: point.x,
					y: labelY,
					anchorX: point.x,
					anchorY: point.y,
					selected: node.key === selectedId,
					major: node.visual.major,
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
					key: node.key,
					name: node.source.rootName,
					x: width / 2 + dx * factor,
					y: height / 2 + dy * factor,
					angle: Math.atan2(dy, dx),
				})
			}
		}
		const scaleBarPixels = 80
		const scaleBarAu = layout.worldUnitsPerAu == null
			? null
			: scaleBarPixels * worldUnitsPerPixelAt(controls.target) / layout.worldUnitsPerAu
		const snapshot: OverlaySnapshot = {
			labels,
			indicators,
			legend: scaleBarAu == null
				? null
				: {
					pixels: scaleBarPixels,
					label: formatPhysicalDistance(scaleBarAu),
				},
			projection: camera === orreryCamera ? 'perspective' : 'orthographic',
			status: dataReceived && visualsReady ? 'ready' : 'initializing',
		}
		const signature = JSON.stringify(snapshot, (_key, value) => typeof value === 'number' ? Math.round(value * 2) / 2 : value)
		if (signature !== overlaySignature) {
			overlaySignature = signature
			callbacks.onOverlayChange?.(snapshot)
		}
	}

	function cameraZoomLevel(): number {
		if (camera === planCamera) return camera.zoom
		return orreryFrameDistance() / Math.max(camera.position.distanceTo(controls.target), Number.EPSILON)
	}

	function updateToneMappingExposure() {
		const automatic = settings.visibility !== 'physical'
		const zoomLevel = cameraZoomLevel()
		const focusedKey = !automatic || zoomLevel < 4
			? null
			: focusedStarlightTarget(
				[...nodes.values()].map((node) => {
					const projected = projectNode(node)
					node.visual.anchor.getWorldPosition(scratchWorld)
					return {
						key: node.key,
						isStar: node.isStar,
						inside: projected.inside,
						x: projected.x,
						y: projected.y,
						physicalRadiusPx: node.visual.radius / worldUnitsPerPixelAt(scratchWorld),
					}
				}),
				width,
				height,
				zoomLevel,
			)
		const focusedNode = focusedKey == null ? null : nodes.get(focusedKey)
		let irradiance: number | null = null
		if (automatic && focusedNode) {
			focusedNode.visual.anchor.getWorldPosition(scratchWorld)
			irradiance = starlight.irradianceAt(scratchWorld)
		}
		const exposure = resolveStarlightExposure(settings.visibility, irradiance)
		renderer.toneMappingExposure = exposure.exposure
		starlight.compensateFillForExposure(exposure.exposure)
	}

	function notifyView() {
		const zoomLevel = cameraZoomLevel()
		const direction = camera.position.clone().sub(controls.target).normalize()
		const orientationMoved = direction.dot(defaultCameraDirection(settings.view)) < 0.9999
		callbacks.onViewChange({
			zoomLevel,
			isMoved: Math.abs(zoomLevel - 1) > 0.001 || controls.target.lengthSq() > 0.01 || orientationMoved,
		})
	}

	function getCameraState() {
		const direction = camera.position.clone().sub(controls.target)
		const distance = Math.max(direction.length(), Number.EPSILON)
		direction.normalize()
		return {
			projection: camera === planCamera ? 'orthographic' as const : 'perspective' as const,
			target: controls.target.toArray() as [number, number, number],
			direction: direction.toArray() as [number, number, number],
			distance,
			zoom: camera === planCamera ? camera.zoom : cameraZoomLevel(),
			fieldOfView: orreryCamera.fov,
		}
	}

	function setCameraState(state: ReturnType<typeof getCameraState>) {
		const expectedProjection = settings.view === 'plan' ? 'orthographic' : 'perspective'
		if (state.projection !== expectedProjection) return
		if (![...state.target, ...state.direction, state.distance, state.zoom, state.fieldOfView].every(Number.isFinite)) return
		if (state.distance <= 0 || state.zoom <= 0 || state.fieldOfView <= 0 || state.fieldOfView >= 180) return
		const target = new Vector3().fromArray(state.target)
		const direction = new Vector3().fromArray(state.direction)
		if (direction.lengthSq() <= Number.EPSILON) return
		direction.normalize()

		fly = null
		viewStartedAt = null
		viewBlend = settings.view === 'orrery' ? 1 : 0
		viewFrom = viewBlend
		viewTo = viewBlend
		orreryCamera.fov = state.fieldOfView
		orreryCamera.updateProjectionMatrix()
		camera = settings.view === 'plan' ? planCamera : orreryCamera
		controls.object = camera
		controls.target.copy(target)
		if (camera === planCamera) {
			camera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom))
			camera.position.copy(target).addScaledVector(direction, PLAN_CAMERA_DISTANCE)
		} else {
			camera.zoom = 1
			camera.position.copy(target).addScaledVector(
				direction,
				Math.min(controls.maxDistance, Math.max(controls.minDistance, state.distance)),
			)
		}
		camera.lookAt(target)
		camera.updateProjectionMatrix()
		configureControls()
		lastFollowPosition = null
		applyPositions()
		controls.update()
		notifyView()
		queueMicrotask(settleTextureLods)
		schedule()
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
		const distance = KEYBOARD_PAN_SPEED_PX * deltaSeconds * worldUnitsPerPixelAt(controls.target)
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
		let cameraSettled = false
		let animate = applyKeyboardPan(deltaSeconds)
		previousCameraPosition.copy(camera.position)
		animate = controls.update() || animate
		if (viewStartedAt != null) {
			const progress = Math.min(1, (now - viewStartedAt) / VIEW_TRANSITION_MS)
			viewBlend = viewFrom + (viewTo - viewFrom) * ease(progress)
			applyPositions()
			if (progress >= 1) {
				viewStartedAt = null
				cameraSettled = true
			} else animate = true
		}
		if (fly) {
			const progress = Math.min(1, (now - fly.startedAt) / fly.duration)
			const t = ease(progress)
			controls.target.lerpVectors(fly.fromTarget, fly.toTarget, t)
			camera.position.lerpVectors(fly.fromCamera, fly.toCamera, t)
			camera.zoom = fly.fromZoom + (fly.toZoom - fly.fromZoom) * t
			camera.updateProjectionMatrix()
			if (progress >= 1) {
				fly = null
				cameraSettled = true
			} else animate = true
		}
		animate = constrainCameraOutsideBodies() || animate
		updatePerspectiveClipping()
		updateVisualScales()
		updateToneMappingExposure()
		skyGroup.position.copy(camera.position)
		renderer.render(scene, camera)
		publishOverlay()
		notifyView()
		if (cameraSettled) settleTextureLods()
		if (animate) schedule()
	}

	function schedule() {
		if (destroyed || frameHandle || !visible || !intersecting) return
		frameHandle = requestAnimationFrame(frame)
	}

	type PointerHit =
		| { kind: 'local', node: EntityNode, position: { x: number, y: number }, distance: number }
		| { kind: 'sky', node: SkyNode, position: { x: number, y: number }, distance: number }

	function closestTarget(event: PointerEvent): PointerHit | null {
		const rect = canvas.getBoundingClientRect()
		const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
		let nearest: PointerHit | null = null
		for (const node of nodes.values()) {
			const point = projectNode(node)
			if (!point.inside) continue
			const distance = Math.hypot(pointer.x - point.x, pointer.y - point.y)
			const pickRadius = node.visual.getPickRadiusPx()
			if (distance <= pickRadius && (!nearest || distance < nearest.distance)) {
				nearest = { kind: 'local', node, position: pointer, distance }
			}
		}
		for (const node of skyNodes.values()) {
			const point = projectSkyNode(node)
			if (!point.inside) continue
			const distance = Math.hypot(pointer.x - point.x, pointer.y - point.y)
			const pickRadius = Math.max(7, node.visual.sizePx * 1.8)
			if (distance <= pickRadius && (!nearest || distance < nearest.distance)) {
				nearest = { kind: 'sky', node, position: pointer, distance }
			}
		}
		return nearest
	}

	function handlePointerMove(event: PointerEvent) {
		if (dragStart && Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 4) suppressClick = true
		const hit = closestTarget(event)
		hoveredId = hit?.node.key ?? null
		let hoverTarget: Parameters<MapRendererCallbacks['onHover']>[0] = null
		if (hit?.kind === 'local') hoverTarget = { kind: 'local', body: hit.node.body }
		else if (hit?.kind === 'sky') hoverTarget = { kind: 'sky', source: hit.node.source }
		callbacks.onHover(hoverTarget, hit?.position ?? null)
		canvas.style.cursor = hit ? 'pointer' : ''
		schedule()
	}
	function handlePointerLeave() {
		hoveredId = null
		callbacks.onHover(null, null)
		schedule()
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
		const hit = closestTarget(event as PointerEvent)
		callbacks.onSelect(hit?.node.key ?? null)
	}
	function handleDoubleClick(event: MouseEvent) {
		const hit = closestTarget(event as PointerEvent)
		if (!hit) return
		if (hit.kind === 'sky') {
			callbacks.onActivateSkySource(hit.node.source.rootSlug)
			callbacks.onHover(null, null)
			hoveredId = null
			canvas.style.cursor = ''
			return
		}
		callbacks.onFocusChange(hit.node.key)
		callbacks.onHover(null, null)
		canvas.style.cursor = ''
		const target = hit.node.visual.anchor.position.clone()
		const offsetDirection = camera.position.clone().sub(controls.target).normalize()
		let targetZoom = camera.zoom
		let targetDistance = camera.position.distanceTo(controls.target)
		if (camera === planCamera) {
			targetZoom = Math.min(
				MAX_ZOOM,
				Math.max(
					camera.zoom,
					FOCUS_RADIUS_PX * worldUnitsPerPixelAt(target) * camera.zoom
						/ Math.max(hit.node.visual.radius, Number.EPSILON),
				),
			)
		} else {
			const focusDistance = perspectiveDistanceForWorldUnitsPerPixel(
				Math.max(hit.node.visual.radius, Number.EPSILON) / FOCUS_RADIUS_PX,
				height,
				orreryCamera.fov,
			)
			targetDistance = Math.min(
				targetDistance,
				Math.max(controls.minDistance, hit.node.visual.extent * 2.5, focusDistance),
			)
		}
		const targetCamera = target.clone().addScaledVector(offsetDirection, targetDistance)
		if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			controls.target.copy(target)
			camera.position.copy(targetCamera)
			camera.zoom = targetZoom
			camera.updateProjectionMatrix()
			fly = null
			queueMicrotask(settleTextureLods)
		} else {
			fly = {
				startedAt: performance.now(),
				duration: FLY_TO_MS,
				fromTarget: controls.target.clone(), toTarget: target,
				fromCamera: camera.position.clone(), toCamera: targetCamera,
				fromZoom: camera.zoom, toZoom: targetZoom,
			}
		}
		schedule()
	}
	function handleContextLost(event: Event) {
		event.preventDefault()
		callbacks.onUnavailable?.('The graphics context was lost. Reload the page to restore the interactive map.')
		callbacks.onOverlayChange?.({ labels: [], indicators: [], legend: null, projection: null, status: 'unavailable' })
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
		if (pressedPanKeys.size === 0) queueMicrotask(settleTextureLods)
	}
	function handleCanvasBlur() {
		pressedPanKeys.clear()
		queueMicrotask(settleTextureLods)
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
	controls.addEventListener('end', settleTextureLods)
	document.addEventListener('visibilitychange', handleVisibility)
	const intersectionObserver = new IntersectionObserver((entries) => {
		intersecting = entries.at(-1)?.isIntersecting ?? true
		if (intersecting) schedule()
	})
	intersectionObserver.observe(host)

	resize(width, height)
	callbacks.onOverlayChange?.({
		labels: [], indicators: [], legend: null, projection: 'perspective', status: 'initializing',
	})
	rebuild()

	return {
		canvas,
		setData(nextStars, nextBodies, nextApparentSky) {
			stars = nextStars
			bodies = nextBodies
			apparentSky = nextApparentSky
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
			if (settings.follow && selectedId?.startsWith('sky-root:')) settings.follow = false
			starlight.setVisibilityMode(settings.visibility)
			updateSkyVisuals()
			configureControls()
			if (rebuildTrail) rebuildTrails()
			if (viewChanged) {
				viewFrom = viewBlend
				viewTo = settings.view === 'orrery' ? 1 : 0
				const reducedMotion = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
				if (reducedMotion) {
					viewBlend = viewTo
					viewStartedAt = null
					switchCameraForView(settings.view, true)
					applyPositions()
					queueMicrotask(settleTextureLods)
				} else {
					viewStartedAt = performance.now()
					switchCameraForView(settings.view, false)
				}
			}
			if (!settings.follow) lastFollowPosition = null
			schedule()
		},
		setSelected(id) {
			selectedId = id
			if (selectedId?.startsWith('sky-root:')) settings.follow = false
			lastFollowPosition = null
			applySelection()
			schedule()
		},
		setTheme(nextTheme) {
			theme = nextTheme
			rebuild()
		},
		resize,
		resetView() {
			fly = null
			viewStartedAt = null
			viewBlend = settings.view === 'orrery' ? 1 : 0
			viewFrom = viewBlend
			viewTo = viewBlend
			resetCameraForView(settings.view)
			callbacks.onFocusChange(null)
			lastFollowPosition = null
			applyPositions()
			controls.update()
			queueMicrotask(settleTextureLods)
			schedule()
		},
		getCameraState,
		setCameraState,
		destroy() {
			if (destroyed) return
			destroyed = true
			visualGeneration++
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
			controls.removeEventListener('end', settleTextureLods)
			controls.dispose()
			clearSceneContent()
			clearSky()
			sharedSphere.dispose()
			glowTexture.dispose()
			markerTexture.dispose()
			selectionTexture.dispose()
			skyPointTexture.dispose()
			starlight.dispose()
			renderer.dispose()
			renderer.forceContextLoss()
		},
	}
}

export type { MapRendererCallbacks, MapSettingsState, RootMapRenderer } from '../renderer-types.js'
