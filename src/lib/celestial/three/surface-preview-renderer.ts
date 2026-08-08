import {
	ACESFilmicToneMapping,
	AmbientLight,
	Color,
	DirectionalLight,
	Mesh,
	PerspectiveCamera,
	Scene,
	SphereGeometry,
	SRGBColorSpace,
	WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { MapBody } from '../system-layout.js'
import { createPlanetSurfaceVisual, type PlanetSurfaceVisual } from './surface-material.js'
import { createStellarSurfaceVisual, type StellarSurfaceVisual } from './stellar-material.js'

export type SurfacePreviewRenderer = {
	setBody(body: MapBody, isStar?: boolean): Promise<void>
	resize(width: number, height: number): void
	resetView(): void
	dispose(): void
}

export function createSurfacePreviewRenderer(
	host: HTMLElement,
	onUnavailable: (message: string) => void,
): SurfacePreviewRenderer {
	const canvas = document.createElement('canvas')
	canvas.tabIndex = 0
	canvas.setAttribute('aria-label', 'Rotatable preview of the composed celestial surface')
	// setSize(..., false) controls only the drawing buffer. Pin the CSS box to
	// the host so a DPR-scaled intrinsic canvas is not clipped from its top-left.
	canvas.style.display = 'block'
	canvas.style.width = '100%'
	canvas.style.height = '100%'
	let context: WebGL2RenderingContext | null
	try {
		context = canvas.getContext('webgl2', {
			alpha: false,
			antialias: true,
			powerPreference: 'low-power',
		})
	} catch {
		throw new Error('WebGL 2 is unavailable; the base color plate remains available below.')
	}
	if (!context) throw new Error('WebGL 2 is unavailable; the base color plate remains available below.')

	const renderer = new WebGLRenderer({ canvas, context, antialias: true, powerPreference: 'low-power' })
	renderer.outputColorSpace = SRGBColorSpace
	renderer.toneMapping = ACESFilmicToneMapping
	renderer.toneMappingExposure = 1.15
	renderer.setClearColor(0x05070A, 1)
	renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2))
	renderer.shadowMap.enabled = false
	host.replaceChildren(canvas)

	const scene = new Scene()
	scene.background = new Color(0x05070A)
	const camera = new PerspectiveCamera(36, 1, 0.1, 20)
	camera.up.set(0, 0, 1)
	const initialCameraPosition = camera.position.set(2.45, -2.45, 1.15).clone()
	camera.lookAt(0, 0, 0)

	const controls = new OrbitControls(camera, canvas)
	controls.enableDamping = false
	controls.enablePan = false
	controls.enableZoom = true
	controls.minDistance = 2.45
	controls.maxDistance = 5.2
	controls.rotateSpeed = 0.7
	controls.zoomSpeed = 0.65
	controls.target.set(0, 0, 0)

	// Neutral authoring light: enough fill to inspect the whole recipe while a
	// directional key still exposes roughness, bump, clouds, and the terminator.
	scene.add(new AmbientLight(0xDCE7F5, 1.35))
	const keyLight = new DirectionalLight(0xFFF3DF, 3.1)
	keyLight.position.set(3.5, -4, 3)
	scene.add(keyLight)
	const rimLight = new DirectionalLight(0x8EBEFF, 1.15)
	rimLight.position.set(-4, 2, 1.5)
	scene.add(rimLight)

	const sphereGeometry = new SphereGeometry(1, 96, 64)
	sphereGeometry.rotateX(Math.PI / 2)
	let surface: PlanetSurfaceVisual | null = null
	let stellarSurface: StellarSurfaceVisual | null = null
	let mesh: Mesh | null = null
	let frameHandle = 0
	let disposed = false
	let generation = 0

	function render(): void {
		frameHandle = 0
		if (!disposed) renderer.render(scene, camera)
	}

	function scheduleRender(): void {
		if (!disposed && frameHandle === 0) frameHandle = requestAnimationFrame(render)
	}

	function clearSurface(): void {
		if (mesh) scene.remove(mesh)
		if (surface?.cloudMesh) scene.remove(surface.cloudMesh)
		surface?.dispose()
		stellarSurface?.dispose()
		surface = null
		stellarSurface = null
		mesh = null
	}

	function resetView(): void {
		camera.position.copy(initialCameraPosition)
		controls.target.set(0, 0, 0)
		controls.update()
		scheduleRender()
	}

	function resize(width: number, height: number): void {
		const safeWidth = Math.max(1, Math.round(width))
		const safeHeight = Math.max(1, Math.round(height))
		camera.aspect = safeWidth / safeHeight
		camera.updateProjectionMatrix()
		renderer.setSize(safeWidth, safeHeight, false)
		scheduleRender()
	}

	async function setBody(body: MapBody, isStar = false): Promise<void> {
		const currentGeneration = ++generation
		clearSurface()
		if (isStar) {
			stellarSurface = createStellarSurfaceVisual({
				body,
				colorCss: body.color ?? '#FFE088',
				initialLod: 1024,
				initialPriority: 'foreground',
				onTextureChange: scheduleRender,
			})
			stellarSurface.setVisibilityMode('enhanced')
		} else {
			surface = createPlanetSurfaceVisual({
				body,
				colorCss: body.color ?? '#CAE1FF',
				radius: 1,
				sphereGeometry,
				initialLod: 1024,
				initialPriority: 'foreground',
				onTextureChange: scheduleRender,
			})
		}
		mesh = new Mesh(sphereGeometry, isStar ? stellarSurface!.material : surface!.material)
		mesh.scale.setScalar(1)
		scene.add(mesh)
		if (surface?.cloudMesh) scene.add(surface.cloudMesh)
		scheduleRender()
		await (isStar ? stellarSurface!.ready : surface!.ready)
		if (!disposed && currentGeneration === generation) scheduleRender()
	}

	function handleContextLost(event: Event): void {
		event.preventDefault()
		onUnavailable('The surface preview graphics context was lost. The base color plate remains available.')
	}

	canvas.addEventListener('webglcontextlost', handleContextLost)
	controls.addEventListener('change', scheduleRender)
	scheduleRender()

	return {
		setBody,
		resize,
		resetView,
		dispose() {
			disposed = true
			generation += 1
			if (frameHandle) cancelAnimationFrame(frameHandle)
			canvas.removeEventListener('webglcontextlost', handleContextLost)
			controls.removeEventListener('change', scheduleRender)
			controls.dispose()
			clearSurface()
			sphereGeometry.dispose()
			renderer.dispose()
			renderer.forceContextLoss()
			canvas.remove()
		},
	}
}
