import {
	ACESFilmicToneMapping,
	AmbientLight,
	Color,
	DirectionalLight,
	Mesh,
	PerspectiveCamera,
	Scene,
	Sphere,
	SphereGeometry,
	SRGBColorSpace,
	Vector3,
	WebGLRenderer,
} from 'three'
import type { MapBody } from '../root-layout.js'
import { RodderCameraControls } from './camera-controls.js'
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
	canvas.setAttribute('aria-label', 'Rotatable preview of the composed rodder surface')
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
	const controls = new RodderCameraControls(camera, {
		domElement: canvas,
		input: 'preview',
		smoothTime: 0.25,
		draggingSmoothTime: 0.1,
		dollySpeed: 0.65,
		rotateSpeed: 0.7,
	})
	controls.minDistance = 2.45
	controls.maxDistance = 5.2
	controls.setBoundaryRadius(0.001)
	void controls.setPose({ position: initialCameraPosition, target: new Vector3() })
	controls.update(0)

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
	let lastFrameAt = performance.now()
	const framingSphere = new Sphere(new Vector3(), 1.12)

	function render(now: number): void {
		frameHandle = 0
		if (disposed) return
		const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastFrameAt) / 1_000))
		lastFrameAt = now
		const controlsMoved = controls.update(deltaSeconds)
		renderer.render(scene, camera)
		if (controlsMoved) scheduleRender()
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
		const reducedMotion = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
		void controls.frameSphere(initialCameraPosition, framingSphere, {
			transition: !reducedMotion,
			smoothTime: 0.25,
		})
		if (reducedMotion) controls.update(0)
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
		void controls.fitSphere(framingSphere)
		controls.update(0)
		scheduleRender()
		await (isStar ? stellarSurface!.ready : surface!.ready)
		if (!disposed && currentGeneration === generation) scheduleRender()
	}

	function handleContextLost(event: Event): void {
		event.preventDefault()
		onUnavailable('The surface preview graphics context was lost. The base color plate remains available.')
	}

	function handleControlsSleep(): void {
		if (!frameHandle) return
		cancelAnimationFrame(frameHandle)
		frameHandle = 0
	}

	canvas.addEventListener('webglcontextlost', handleContextLost)
	controls.listen({
		onControl: scheduleRender,
		onTransitionStart: scheduleRender,
		onUpdate: scheduleRender,
		onSleep: handleControlsSleep,
	})
	resetView()

	return {
		setBody,
		resize,
		resetView,
		dispose() {
			disposed = true
			generation += 1
			if (frameHandle) cancelAnimationFrame(frameHandle)
			canvas.removeEventListener('webglcontextlost', handleContextLost)
			controls.dispose()
			clearSurface()
			sphereGeometry.dispose()
			renderer.dispose()
			renderer.forceContextLoss()
			canvas.remove()
		},
	}
}
