import {
	ACESFilmicToneMapping,
	CanvasTexture,
	Color,
	Group,
	OrthographicCamera,
	PerspectiveCamera,
	Raycaster,
	Scene,
	Sphere,
	SphereGeometry,
	Sprite,
	SpriteMaterial,
	SRGBColorSpace,
	Vector2,
	Vector3,
	WebGLRenderer,
} from 'three'
import { RodderCameraControls } from './camera-controls.js'
import { FULL_VIEW_INTERACTION } from '../consumer-contract.js'
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
import { createApparentSkyPointMaterial } from './annotation-material.js'
import type { RingSystemProjection } from '../ring-system.js'

const MIN_VIEW_SCALE = 0.1
const MAX_VIEW_SCALE = 1_000_000
const ORRERY_FOV_DEG = 50
const VIEW_TRANSITION_SECONDS = 0.45
const FLY_TO_SECONDS = 0.6
const VIEW_TRANSITION_MS = VIEW_TRANSITION_SECONDS * 1_000
const KEYBOARD_PAN_SPEED_PX = 210
const CAMERA_TRAVEL_SPEED = 1.8
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

const ease = (t: number) => 1 - (1 - t) ** 3
const worldPosition = (position: { x: number, y: number, z: number }) =>
	new Vector3(position.x - CENTER, position.y - CENTER, position.z)

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
		setData() {}, setDay() {}, setSettings() {}, setSelected() {}, setFocus() {}, setInteraction() {}, setTheme() {}, resize() {}, resetView() {},
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
	const controls = new RodderCameraControls(camera, {
		domElement: canvas,
		input: 'orbit',
		smoothTime: VIEW_TRANSITION_SECONDS,
		dollySpeed: CAMERA_TRAVEL_SPEED,
	})
	controls.minZoom = MIN_VIEW_SCALE
	controls.maxZoom = MAX_VIEW_SCALE
	controls.minDistance = 0.001
	controls.maxDistance = 10_000
	controls.minPolarAngle = 0.015
	controls.maxPolarAngle = Math.PI / 2 - 0.015
	let interaction = { ...FULL_VIEW_INTERACTION }
	const handleWheel = (event: WheelEvent) => {
		if (interaction.cameraMovement) event.preventDefault()
	}

	// Shared geometry is cheap compared with per-body materials and remains
	// smooth when a 1024×512 plate is inspected at close range.
	const sharedSphere = new SphereGeometry(1, 96, 64)
	sharedSphere.rotateX(Math.PI / 2)
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
	let focusedId: EntityKey | null = null
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
	let lastFocusPosition: Vector3 | null = null
	let destroyed = false
	let contextLost = false
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
	const scratchTarget = new Vector3()
	const previousCameraPosition = new Vector3()
	const raycaster = new Raycaster()

	function currentTarget(out = scratchTarget): Vector3 {
		return controls.getTarget(out, false)
	}

	function applyCameraPose(position: Vector3, target: Vector3, zoom: number, transition: boolean, smoothTime: number) {
		const completion = controls.setPose({
			position,
			target,
			zoom: camera === planCamera ? zoom : undefined,
			transition,
			smoothTime,
		})
		if (transition) {
			void completion.then((isCurrent) => {
				if (isCurrent && !destroyed) settleTextureLods()
			})
		}
	}

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
			orreryFrameRadius(),
			width / height,
			orreryCamera.fov,
		)
	}

	function orreryFrameRadius(): number {
		return Math.max(layout.maxVisualRadius, SIZE * 0.45)
	}

	function updateControlDistanceLimits() {
		const frameDistance = orreryFrameDistance()
		controls.minDistance = frameDistance / MAX_VIEW_SCALE
		controls.maxDistance = frameDistance / MIN_VIEW_SCALE
	}

	function resetCameraForView(view: MapSettingsState['view'], target = new Vector3()) {
		camera = view === 'plan' ? planCamera : orreryCamera
		controls.camera = camera
		camera.zoom = 1
		const distance = view === 'plan' ? PLAN_CAMERA_DISTANCE : 1
		const position = target.clone().addScaledVector(defaultCameraDirection(view), distance)
		if (view === 'orrery') {
			void controls.frameSphere(
				position,
				new Sphere(target, orreryFrameRadius() * 1.08),
				{ smoothTime: VIEW_TRANSITION_SECONDS },
			)
		} else {
			applyCameraPose(position, target, 1, false, VIEW_TRANSITION_SECONDS)
		}
		controls.update(0)
		updateControlDistanceLimits()
	}

	function switchCameraForView(view: MapSettingsState['view'], immediate: boolean) {
		const targetNow = currentTarget(new Vector3())
		const activeView = camera === planCamera ? 'plan' : 'orrery'
		const activeZoom = camera === planCamera
			? camera.zoom
			: orreryFrameDistance() / Math.max(camera.position.distanceTo(targetNow), Number.EPSILON)
		const activeDirection = camera.position.clone().sub(targetNow).normalize()
		const sourceWasDefault = targetNow.lengthSq() <= 0.01
			&& Math.abs(activeZoom - 1) <= 0.001
			&& activeDirection.dot(defaultCameraDirection(activeView)) >= 0.9999
		const target = sourceWasDefault ? new Vector3() : targetNow
		const matchedScale = worldUnitsPerPixelAt(target)
		const sourceDirection = camera.position.clone().sub(targetNow)
		if (sourceDirection.lengthSq() < Number.EPSILON) sourceDirection.copy(defaultCameraDirection(view))
		else sourceDirection.normalize()

		camera = view === 'plan' ? planCamera : orreryCamera
		controls.camera = camera

		let distance = PLAN_CAMERA_DISTANCE
		if (camera === planCamera) {
			camera.zoom = sourceWasDefault
				? 1
				: Math.min(
					MAX_VIEW_SCALE,
					Math.max(MIN_VIEW_SCALE, orthographicZoomForWorldUnitsPerPixel(halfHeight * 2, height, matchedScale)),
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
		applyCameraPose(fromCamera, target, camera.zoom, false, VIEW_TRANSITION_SECONDS)
		controls.update(0)
		configureControls()
		applyCameraPose(toCamera, target, camera.zoom, !immediate, VIEW_TRANSITION_SECONDS)
	}

	function configureControls() {
		const plan = settings.view === 'plan'
		controls.enabled = interaction.cameraMovement
		controls.setInputProfile(plan ? 'plan' : 'orbit')
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
			const material = createApparentSkyPointMaterial(skyPointTexture, source.displayColor)
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
		const previousOrreryScale = camera === orreryCamera
			? orreryFrameDistance() / Math.max(camera.position.distanceTo(currentTarget()), Number.EPSILON)
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
		if (previousOrreryScale != null) {
			const target = currentTarget(new Vector3())
			const direction = camera.position.clone().sub(target).normalize()
			const position = target.clone().addScaledVector(direction, orreryFrameDistance() / previousOrreryScale)
			applyCameraPose(position, target, camera.zoom, false, VIEW_TRANSITION_SECONDS)
			controls.update(0)
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
		const boundaryRadius = orreryFrameRadius() * 1.25
		controls.setBoundaryRadius(boundaryRadius)
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
		if (focusedId && !nodes.has(focusedId)) releaseFocus()
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
		if (focusedId) {
			const next = positions.get(focusedId)
			if (next) {
				const world = worldPosition(next)
				if (lastFocusPosition) {
					const delta = world.clone().sub(lastFocusPosition)
					const target = currentTarget(new Vector3()).add(delta)
					// Keep both the camera and its anchor in the body's moving frame.
					// Do not interrupt an approach/orbit intent merely because time advanced.
					void controls.moveTo(target.x, target.y, target.z, false)
					controls.update(0)
				}
				lastFocusPosition = world
			}
		} else {
			lastFocusPosition = null
		}
		updateOrbitPaths()
		rebuildTrails()
	}

	function applySelection() {
		const localSelection = selectedId?.startsWith('sky-root:') ? null : selectedId as EntityKey | null
		const family = buildSelectionFamily(stars, bodies, localSelection, layout.primaryStar)
		for (const [key, node] of nodes) {
			const ownsSelectedRing = node.body.ringSystems?.some(system => `body:${system.id}` === selectedId) ?? false
			node.visual.setSelected(key === selectedId || ownsSelectedRing, family.has(key))
		}
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
				: currentTarget()
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

	function handleControlsRest() {
		if (!controls.intentActive) settleTextureLods()
	}

	function updatePerspectiveClipping() {
		if (camera !== orreryCamera) return
		const distance = Math.max(camera.position.distanceTo(currentTarget()), Number.EPSILON)
		const frameDistance = orreryFrameDistance()
		const near = Math.max(1e-9, distance / 1_000)
		const far = Math.max(frameDistance * 4, distance + SIZE * 2, SKY_RADIUS * 1.1)
		if (Math.abs(camera.near - near) / near > 0.001 || Math.abs(camera.far - far) / far > 0.001) {
			camera.near = near
			camera.far = far
			camera.updateProjectionMatrix()
		}
	}

	function constrainCameraOutsideFocus(): boolean {
		if (camera !== orreryCamera || !focusedId) return false
		const node = nodes.get(focusedId)
		if (!node) return false
		node.visual.anchor.getWorldPosition(scratchWorld)
		return constrainPointOutsideSphere(
			camera.position,
			previousCameraPosition,
			scratchWorld,
			node.visual.radius * CAMERA_SURFACE_CLEARANCE,
		)
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
			for (const ringSystem of node.body.ringSystems ?? []) {
				const key = `body:${ringSystem.id}` as EntityKey
				const selected = key === selectedId
				const requested = selected || key === hoveredId || settings.labels === 'all'
				if (requested && point.inside) {
					const placement = placeRootLabel(
						point.x,
						point.y,
						node.visual.getScreenExtentPx(),
						height,
						labels,
					)
					labels.push({
						key,
						name: ringSystem.name,
						x: placement.x,
						y: placement.y,
						anchorX: point.x,
						anchorY: point.y,
						selected,
						major: false,
						pillar: placement.pillar,
					})
				}
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
			: scaleBarPixels * worldUnitsPerPixelAt(currentTarget()) / layout.worldUnitsPerAu
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

	function cameraScaleRatio(): number {
		if (camera === planCamera) return camera.zoom
		return orreryFrameDistance() / Math.max(camera.position.distanceTo(currentTarget()), Number.EPSILON)
	}

	function updateToneMappingExposure() {
		const automatic = settings.visibility !== 'physical'
		const scaleRatio = cameraScaleRatio()
		const focusedKey = !automatic || scaleRatio < 4
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
				scaleRatio,
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
		const scaleRatio = cameraScaleRatio()
		const target = currentTarget(new Vector3())
		const direction = camera.position.clone().sub(target).normalize()
		const orientationMoved = direction.dot(defaultCameraDirection(settings.view)) < 0.9999
		callbacks.onViewChange({
			isMoved: Math.abs(scaleRatio - 1) > 0.001 || target.lengthSq() > 0.01 || orientationMoved,
		})
	}

	function getCameraState() {
		const target = currentTarget(new Vector3())
		const direction = camera.position.clone().sub(target)
		const distance = Math.max(direction.length(), Number.EPSILON)
		direction.normalize()
		return {
			projection: camera === planCamera ? 'orthographic' as const : 'perspective' as const,
			target: target.toArray() as [number, number, number],
			direction: direction.toArray() as [number, number, number],
			distance,
			// Retained for v1 link compatibility. Perspective views use physical
			// camera distance and never an optical zoom value.
			zoom: camera === planCamera ? camera.zoom : 1,
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

		viewStartedAt = null
		viewBlend = settings.view === 'orrery' ? 1 : 0
		viewFrom = viewBlend
		viewTo = viewBlend
		orreryCamera.fov = state.fieldOfView
		orreryCamera.updateProjectionMatrix()
		camera = settings.view === 'plan' ? planCamera : orreryCamera
		controls.camera = camera
		let position: Vector3
		let zoom = 1
		if (camera === planCamera) {
			zoom = Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, state.zoom))
			position = target.clone().addScaledVector(direction, PLAN_CAMERA_DISTANCE)
		} else {
			position = target.clone().addScaledVector(
				direction,
				Math.min(controls.maxDistance, Math.max(controls.minDistance, state.distance)),
			)
		}
		applyCameraPose(position, target, zoom, false, VIEW_TRANSITION_SECONDS)
		controls.update(0)
		configureControls()
		lastFocusPosition = focusedId ? nodes.get(focusedId)?.visual.anchor.position.clone() ?? null : null
		applyPositions()
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
		const distance = KEYBOARD_PAN_SPEED_PX * deltaSeconds * worldUnitsPerPixelAt(currentTarget())
		releaseFocus()
		controls.interrupt()
		void controls.truck(horizontal * distance, -vertical * distance, false)
		controls.update(0)
		return true
	}

	function frame(now: number) {
		frameHandle = 0
		if (destroyed || contextLost || !visible || !intersecting) return
		const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastFrameAt) / 1_000))
		lastFrameAt = now
		let cameraSettled = false
		let animate = applyKeyboardPan(deltaSeconds)
		previousCameraPosition.copy(camera.position)
		animate = controls.update(deltaSeconds) || animate
		if (viewStartedAt != null) {
			const progress = Math.min(1, (now - viewStartedAt) / VIEW_TRANSITION_MS)
			viewBlend = viewFrom + (viewTo - viewFrom) * ease(progress)
			applyPositions()
			if (progress >= 1) {
				viewStartedAt = null
				cameraSettled = true
			} else animate = true
		}
		if (constrainCameraOutsideFocus()) {
			applyCameraPose(camera.position, currentTarget(new Vector3()), camera.zoom, false, VIEW_TRANSITION_SECONDS)
			controls.update(0)
			animate = true
		}
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
		if (destroyed || contextLost || frameHandle || !visible || !intersecting) return
		frameHandle = requestAnimationFrame(frame)
	}

	type PointerHit =
		| { kind: 'local', node: EntityNode, position: { x: number, y: number }, distance: number }
		| { kind: 'ring', node: EntityNode, ringSystem: RingSystemProjection, position: { x: number, y: number }, distance: number }
		| { kind: 'sky', node: SkyNode, position: { x: number, y: number }, distance: number }

	function hitKey(hit: PointerHit | null): RootSelectionKey | null {
		return hit?.kind === 'ring' ? `body:${hit.ringSystem.id}` : hit?.node.key ?? null
	}

	function ringSystemBody(hit: Extract<PointerHit, { kind: 'ring' }>): MapBody {
		return {
			id: hit.ringSystem.id,
			name: hit.ringSystem.name,
			slug: hit.ringSystem.slug,
			bodyType: 'ring_system',
			parentId: hit.node.body.id,
		}
	}

	function closestTarget(event: PointerEvent): PointerHit | null {
		const rect = canvas.getBoundingClientRect()
		const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
		const normalizedPointer = new Vector2(
			pointer.x / Math.max(rect.width, 1) * 2 - 1,
			-(pointer.y / Math.max(rect.height, 1)) * 2 + 1,
		)
		camera.updateMatrixWorld()
		scene.updateMatrixWorld(true)
		raycaster.setFromCamera(normalizedPointer, camera)
		let nearestRing: PointerHit | null = null
		let nearestRingDistance = Number.POSITIVE_INFINITY
		for (const node of nodes.values()) {
			const meshes = node.visual.ringMeshes.filter(mesh => mesh.visible && mesh.userData.ringSystemId != null)
			const intersection = raycaster.intersectObjects(meshes, false)[0]
			if (!intersection || intersection.distance >= nearestRingDistance) continue
			const ringSystemId = Number(intersection.object.userData.ringSystemId)
			const ringSystem = node.body.ringSystems?.find(system => system.id === ringSystemId)
			if (!ringSystem) continue
			nearestRingDistance = intersection.distance
			nearestRing = { kind: 'ring', node, ringSystem, position: pointer, distance: 0 }
		}
		if (nearestRing) return nearestRing
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
		if (!interaction.hoverInspection) return
		const hit = closestTarget(event)
		hoveredId = hitKey(hit)
		let hoverTarget: Parameters<MapRendererCallbacks['onHover']>[0] = null
		if (hit?.kind === 'local') hoverTarget = { kind: 'local', body: hit.node.body }
		else if (hit?.kind === 'ring') hoverTarget = { kind: 'local', body: ringSystemBody(hit) }
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
		if (interaction.cameraMovement) canvas.focus({ preventScroll: true })
		dragStart = new Vector2(event.clientX, event.clientY)
		suppressClick = false
	}
	function handlePointerUp() {
		dragStart = null
	}
	function handleClick(event: MouseEvent) {
		if (suppressClick || !interaction.selectionInspection) return
		const hit = closestTarget(event as PointerEvent)
		callbacks.onSelect(hitKey(hit))
	}

	function frameNode(node: EntityNode) {
		const target = node.visual.anchor.position.clone()
		const current = currentTarget(new Vector3())
		const offsetDirection = camera.position.clone().sub(current).normalize()
		let targetScale = camera.zoom
		let targetDistance = camera.position.distanceTo(current)
		if (camera === planCamera) {
			targetScale = Math.min(
				MAX_VIEW_SCALE,
				Math.max(
					camera.zoom,
					FOCUS_RADIUS_PX * worldUnitsPerPixelAt(target) * camera.zoom
						/ Math.max(node.visual.radius, Number.EPSILON),
				),
			)
		} else {
			const focusDistance = perspectiveDistanceForWorldUnitsPerPixel(
				Math.max(node.visual.radius, Number.EPSILON) / FOCUS_RADIUS_PX,
				height,
				orreryCamera.fov,
			)
			targetDistance = Math.min(
				targetDistance,
				Math.max(controls.minDistance, node.visual.extent * 2.5, focusDistance),
			)
		}
		const targetCamera = target.clone().addScaledVector(offsetDirection, targetDistance)
		const reducedMotion = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
		applyCameraPose(targetCamera, target, targetScale, !reducedMotion, FLY_TO_SECONDS)
		if (reducedMotion) {
			controls.update(0)
			queueMicrotask(settleTextureLods)
		}
		schedule()
	}

	function setFocusedEntity(id: EntityKey | null, frame = true, forceFrame = false) {
		const node = id ? nodes.get(id) : null
		const nextId = node?.key ?? null
		if (focusedId === nextId) {
			if (node && frame && forceFrame) frameNode(node)
			return
		}
		focusedId = nextId
		lastFocusPosition = node?.visual.anchor.position.clone() ?? null
		if (node && frame) frameNode(node)
	}

	function releaseFocus() {
		if (!focusedId) return
		setFocusedEntity(null, false)
		callbacks.onFocusChange(null)
	}

	function handleDoubleClick(event: MouseEvent) {
		if (!interaction.objectNavigation) return
		const hit = closestTarget(event as PointerEvent)
		if (!hit) return
		if (hit.kind === 'sky') {
			callbacks.onActivateSkySource(hit.node.source.rootSlug)
			callbacks.onHover(null, null)
			hoveredId = null
			canvas.style.cursor = ''
			return
		}
		setFocusedEntity(hit.node.key, true, true)
		callbacks.onFocusChange(hit.node.key)
		callbacks.onHover(null, null)
		canvas.style.cursor = ''
	}
	function handleContextLost(event: Event) {
		event.preventDefault()
		contextLost = true
		if (frameHandle) cancelAnimationFrame(frameHandle)
		frameHandle = 0
		callbacks.onUnavailable?.('The graphics context was interrupted. Restoring the interactive map…')
		callbacks.onOverlayChange?.({ labels: [], indicators: [], legend: null, projection: null, status: 'unavailable' })
	}
	function handleContextRestored() {
		if (destroyed) return
		contextLost = false
		overlaySignature = ''
		lastFrameAt = performance.now()
		callbacks.onAvailable?.()
		callbacks.onOverlayChange?.({
			labels: [], indicators: [], legend: null,
			projection: camera === planCamera ? 'orthographic' : 'perspective',
			status: 'initializing',
		})
		schedule()
		queueMicrotask(settleTextureLods)
	}
	function handleKeyDown(event: KeyboardEvent) {
		if (!interaction.cameraMovement || !PAN_KEYS.has(event.code) || event.altKey || event.ctrlKey || event.metaKey) return
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
	function handleControlsStart() {
		const action = controls.currentAction
		if (
			action === RodderCameraControls.ACTION.TRUCK
			|| action === RodderCameraControls.ACTION.SCREEN_PAN
			|| action === RodderCameraControls.ACTION.TOUCH_TRUCK
			|| action === RodderCameraControls.ACTION.TOUCH_SCREEN_PAN
			|| action === RodderCameraControls.ACTION.TOUCH_ZOOM_TRUCK
		) releaseFocus()
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
	canvas.addEventListener('wheel', handleWheel, { passive: false })
	canvas.addEventListener('webglcontextlost', handleContextLost)
	canvas.addEventListener('webglcontextrestored', handleContextRestored)
	canvas.addEventListener('keydown', handleKeyDown)
	canvas.addEventListener('keyup', handleKeyUp)
	canvas.addEventListener('blur', handleCanvasBlur)
	controls.listen({
		onControlStart: handleControlsStart,
		onControl: schedule,
		onTransitionStart: schedule,
		onUpdate: schedule,
		onRest: handleControlsRest,
	})
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
			schedule()
		},
		setSelected(id) {
			selectedId = id
			// Old v1 links expressed a locked camera as follow + selection. Promote
			// that pair to the explicit focus model when it is first restored.
			if (settings.follow && selectedId && !selectedId.startsWith('sky-root:') && !focusedId) {
				setFocusedEntity(selectedId as EntityKey)
				callbacks.onFocusChange(selectedId as EntityKey)
			}
			applySelection()
			schedule()
		},
		setFocus(id) {
			setFocusedEntity(id)
			schedule()
		},
		setInteraction(nextInteraction) {
			interaction = { ...nextInteraction }
			configureControls()
			if (!interaction.hoverInspection) {
				hoveredId = null
				callbacks.onHover(null, null)
				canvas.style.cursor = ''
			}
			if (!interaction.cameraMovement) pressedPanKeys.clear()
			schedule()
		},
		setTheme(nextTheme) {
			if (
				theme.page === nextTheme.page
				&& theme.surface === nextTheme.surface
				&& theme.accent === nextTheme.accent
				&& theme.accentLight === nextTheme.accentLight
				&& theme.secondary === nextTheme.secondary
				&& theme.dim === nextTheme.dim
				&& theme.heading === nextTheme.heading
				&& theme.faint === nextTheme.faint
			) return
			theme = nextTheme
			rebuild()
		},
		resize,
		resetView() {
			const hadFocus = focusedId != null
			viewStartedAt = null
			viewBlend = settings.view === 'orrery' ? 1 : 0
			viewFrom = viewBlend
			viewTo = viewBlend
			resetCameraForView(settings.view)
			setFocusedEntity(null, false)
			if (hadFocus) callbacks.onFocusChange(null)
			applyPositions()
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
			canvas.removeEventListener('wheel', handleWheel)
			canvas.removeEventListener('webglcontextlost', handleContextLost)
			canvas.removeEventListener('webglcontextrestored', handleContextRestored)
			canvas.removeEventListener('keydown', handleKeyDown)
			canvas.removeEventListener('keyup', handleKeyUp)
			canvas.removeEventListener('blur', handleCanvasBlur)
			controls.dispose()
			clearSceneContent()
			clearSky()
			sharedSphere.dispose()
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
