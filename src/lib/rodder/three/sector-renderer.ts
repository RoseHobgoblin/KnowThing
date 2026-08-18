import {
	CanvasTexture,
	Color,
	GridHelper,
	Group,
	PerspectiveCamera,
	Scene,
	Sprite,
	SpriteMaterial,
	SRGBColorSpace,
	Vector2,
	Vector3,
	WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { ThemePalette } from '../root-layout.js'
import {
	positionedRoots,
	sectorBoundsRadius,
	sectorGridSpacing,
	type PositionedSectorRoot,
	type SectorOverlaySnapshot,
	type SectorRenderer,
	type SectorRendererCallbacks,
	type SectorRootView,
} from '../sector-view.js'

/**
 * The read-only sector map: sector roots in a light-year/parsec frame.
 *
 * Deliberately much simpler than map-renderer.ts — no time, no orbits, no
 * surface textures, no starlight. World units ARE sector units (the sector and
 * Orrery scales must never share a transform), Z is up to match the Orrery's
 * convention, and every root renders as a screen-legible marker sprite rather
 * than a physical body: at neighbourhood scale a star is a point, and drawing
 * it any other way would just misstate distances.
 */

const FOV_DEG = 50
const PICK_RADIUS_PX = 14
const MARKER_SCALE = 1 / 34 // marker world size as a fraction of bounds radius

function makeDiscTexture(): CanvasTexture {
	const canvas = document.createElement('canvas')
	canvas.width = 64
	canvas.height = 64
	const context = canvas.getContext('2d')!
	const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 30)
	gradient.addColorStop(0, 'rgba(255,255,255,1)')
	gradient.addColorStop(0.45, 'rgba(255,255,255,0.95)')
	gradient.addColorStop(0.7, 'rgba(255,255,255,0.25)')
	gradient.addColorStop(1, 'rgba(255,255,255,0)')
	context.fillStyle = gradient
	context.beginPath()
	context.arc(32, 32, 30, 0, Math.PI * 2)
	context.fill()
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	return texture
}

function makeRingTexture(): CanvasTexture {
	const canvas = document.createElement('canvas')
	canvas.width = 64
	canvas.height = 64
	const context = canvas.getContext('2d')!
	context.strokeStyle = '#FFFFFF'
	context.lineWidth = 4
	context.beginPath()
	context.arc(32, 32, 26, 0, Math.PI * 2)
	context.stroke()
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	return texture
}

function unavailableRenderer(canvas: HTMLCanvasElement, reason: string, callbacks: SectorRendererCallbacks): SectorRenderer {
	callbacks.onUnavailable?.(reason)
	callbacks.onOverlayChange?.({ labels: [], legend: null, status: 'unavailable' })
	return {
		canvas,
		setData() {}, setSelected() {}, setTheme() {}, resize() {}, resetView() {},
		focusRoot() {}, getCameraState() { return null }, setCameraState() {}, destroy() {},
	}
}

export function createSectorRenderer(
	host: HTMLElement,
	initialTheme: ThemePalette,
	callbacks: SectorRendererCallbacks,
): SectorRenderer {
	const canvas = document.createElement('canvas')
	canvas.tabIndex = 0
	let context: WebGL2RenderingContext | null
	try {
		context = canvas.getContext('webgl2', { alpha: false, antialias: true, powerPreference: 'high-performance' })
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

	const scene = new Scene()
	const rootGroup = new Group()
	const gridGroup = new Group()
	scene.add(gridGroup, rootGroup)

	let width = Math.max(1, Math.round(host.getBoundingClientRect().width))
	let height = Math.max(1, Math.round(host.getBoundingClientRect().height || width))
	const camera = new PerspectiveCamera(FOV_DEG, width / height, 0.01, 100_000)
	camera.up.set(0, 0, 1)
	const controls = new OrbitControls(camera, canvas)
	controls.enableDamping = true
	controls.dampingFactor = 0.085
	controls.screenSpacePanning = true
	controls.zoomToCursor = true
	// Full free orbit apart from the exact poles (Z-up look-at singularity).
	controls.minPolarAngle = 0.015
	controls.maxPolarAngle = Math.PI - 0.015

	const discTexture = makeDiscTexture()
	const ringTexture = makeRingTexture()

	let theme = initialTheme
	let roots: PositionedSectorRoot[] = []
	let units = 'ly'
	let selectedSlug: string | null = null
	let hoveredSlug: string | null = null
	let boundsRadius = 1
	let gridSpacing = 1
	let destroyed = false
	let frameHandle = 0
	let needsRender = true
	let overlaySignature = ''
	let dragStart: Vector2 | null = null
	let suppressClick = false
	let currentGrid: GridHelper | null = null
	const scratch = new Vector3()

	type RootNode = { root: PositionedSectorRoot, sprite: Sprite, ring: Sprite, material: SpriteMaterial }
	const nodes = new Map<string, RootNode>()

	function markerColor(root: PositionedSectorRoot): string {
		// Systems with stars read as stars; starless roots (future unbound
		// objects, markers) stay muted so absence of a sun is visible.
		return root.starCount > 0 ? theme.accent : theme.secondary
	}

	function disposeGrid() {
		if (!currentGrid) return
		gridGroup.remove(currentGrid)
		currentGrid.geometry.dispose()
		if (Array.isArray(currentGrid.material)) {
			for (const material of currentGrid.material) material.dispose()
		} else {
			currentGrid.material.dispose()
		}
		currentGrid = null
	}

	function rebuildGrid() {
		disposeGrid()
		gridSpacing = sectorGridSpacing(boundsRadius)
		const halfLines = Math.max(2, Math.ceil((boundsRadius * 1.2) / gridSpacing))
		const size = halfLines * 2 * gridSpacing
		const grid = new GridHelper(size, halfLines * 2, new Color(theme.faint), new Color(theme.faint))
		// GridHelper lies in the XZ plane; the sector's fundamental plane is XY.
		grid.rotation.x = Math.PI / 2
		const gridMaterial = grid.material as { transparent: boolean, opacity: number }
		gridMaterial.transparent = true
		gridMaterial.opacity = 0.35
		gridGroup.add(grid)
		currentGrid = grid
	}

	function rebuildRoots(nextRoots: SectorRootView[]) {
		for (const node of nodes.values()) {
			rootGroup.remove(node.sprite, node.ring)
			node.material.dispose()
			node.ring.material.dispose()
		}
		nodes.clear()

		roots = positionedRoots(nextRoots)
		boundsRadius = sectorBoundsRadius(nextRoots)
		rebuildGrid()

		const markerSize = boundsRadius * MARKER_SCALE
		for (const root of roots) {
			const material = new SpriteMaterial({ map: discTexture, color: markerColor(root), depthTest: false })
			const sprite = new Sprite(material)
			sprite.position.set(root.x, root.y, root.z)
			sprite.scale.setScalar(markerSize)
			sprite.renderOrder = 2

			const ring = new Sprite(new SpriteMaterial({ map: ringTexture, color: theme.accentLight, depthTest: false, opacity: 0 }))
			ring.position.copy(sprite.position)
			ring.scale.setScalar(markerSize * 2)
			ring.renderOrder = 3

			rootGroup.add(sprite, ring)
			nodes.set(root.slug, { root, sprite, ring, material })
		}
		applySelection()
		schedule()
	}

	function applySelection() {
		for (const node of nodes.values()) {
			const isSelected = node.root.slug === selectedSlug
			const ringMaterial = node.ring.material as SpriteMaterial
			ringMaterial.opacity = isSelected ? 1 : 0
			node.material.color.set(isSelected ? theme.accentLight : markerColor(node.root))
		}
	}

	function applyTheme() {
		scene.background = new Color(theme.page)
		rebuildGrid()
		applySelection()
	}

	function defaultCameraPosition(target: Vector3): Vector3 {
		const polar = 55 * Math.PI / 180
		const azimuth = 35 * Math.PI / 180
		const direction = new Vector3(
			Math.sin(azimuth) * Math.sin(polar),
			-Math.cos(azimuth) * Math.sin(polar),
			Math.cos(polar),
		)
		return target.clone().addScaledVector(direction, boundsRadius * 2.6)
	}

	function resetView() {
		controls.target.set(0, 0, 0)
		camera.position.copy(defaultCameraPosition(controls.target))
		camera.lookAt(controls.target)
		schedule()
	}

	function projectToScreen(position: Vector3): { x: number, y: number, behind: boolean } {
		scratch.copy(position).project(camera)
		return {
			x: (scratch.x + 1) / 2 * width,
			y: (1 - scratch.y) / 2 * height,
			behind: scratch.z > 1,
		}
	}

	function closestRoot(event: MouseEvent): PositionedSectorRoot | null {
		const rect = canvas.getBoundingClientRect()
		const px = event.clientX - rect.left
		const py = event.clientY - rect.top
		let best: PositionedSectorRoot | null = null
		let bestDistance = PICK_RADIUS_PX
		for (const node of nodes.values()) {
			const projected = projectToScreen(node.sprite.position)
			if (projected.behind) continue
			const distance = Math.hypot(projected.x - px, projected.y - py)
			if (distance < bestDistance) {
				bestDistance = distance
				best = node.root
			}
		}
		return best
	}

	function publishOverlay() {
		const labels: SectorOverlaySnapshot['labels'] = []
		for (const node of nodes.values()) {
			const projected = projectToScreen(node.sprite.position)
			if (projected.behind) continue
			labels.push({
				slug: node.root.slug,
				name: node.root.name,
				x: Math.round(projected.x),
				y: Math.round(projected.y + 12),
				selected: node.root.slug === selectedSlug,
			})
		}
		// Legend: the on-screen length of one grid cell at the controls target.
		const distance = camera.position.distanceTo(controls.target)
		const worldPerPixel = 2 * distance * Math.tan(FOV_DEG * Math.PI / 360) / height
		const legendPixels = gridSpacing / worldPerPixel
		const snapshot: SectorOverlaySnapshot = {
			labels,
			legend: legendPixels >= 8 && legendPixels <= width
				? { pixels: Math.round(legendPixels), label: `${gridSpacing.toLocaleString('en-US')} ${units} grid` }
				: null,
			status: 'ready',
		}
		const signature = JSON.stringify(snapshot)
		if (signature !== overlaySignature) {
			overlaySignature = signature
			callbacks.onOverlayChange?.(snapshot)
		}
	}

	function schedule() {
		needsRender = true
	}

	function frame() {
		if (destroyed) return
		frameHandle = requestAnimationFrame(frame)
		if (document.hidden) return
		const controlsMoved = controls.update()
		if (!needsRender && !controlsMoved) return
		needsRender = false
		renderer.render(scene, camera)
		publishOverlay()
	}

	function handlePointerDown(event: PointerEvent) {
		dragStart = new Vector2(event.clientX, event.clientY)
		suppressClick = false
	}

	function handlePointerMove(event: PointerEvent) {
		if (dragStart && new Vector2(event.clientX, event.clientY).distanceTo(dragStart) > 5) suppressClick = true
		const root = closestRoot(event)
		if (root?.slug !== hoveredSlug) {
			hoveredSlug = root?.slug ?? null
			canvas.style.cursor = root ? 'pointer' : ''
		}
		if (root) {
			const rect = canvas.getBoundingClientRect()
			callbacks.onHover(root, { x: event.clientX - rect.left, y: event.clientY - rect.top })
		} else {
			callbacks.onHover(null, null)
		}
	}

	function handlePointerLeave() {
		hoveredSlug = null
		canvas.style.cursor = ''
		callbacks.onHover(null, null)
	}

	function handleClick(event: MouseEvent) {
		if (suppressClick) return
		callbacks.onSelect(closestRoot(event)?.slug ?? null)
	}

	function handleDoubleClick(event: MouseEvent) {
		const root = closestRoot(event)
		if (root) callbacks.onActivate(root.slug)
	}

	function handleContextLost(event: Event) {
		event.preventDefault()
		callbacks.onUnavailable?.('The graphics context was lost. Reload the page to restore the sector map.')
	}

	canvas.addEventListener('pointerdown', handlePointerDown)
	canvas.addEventListener('pointermove', handlePointerMove)
	canvas.addEventListener('pointerleave', handlePointerLeave)
	canvas.addEventListener('click', handleClick)
	canvas.addEventListener('dblclick', handleDoubleClick)
	canvas.addEventListener('webglcontextlost', handleContextLost)
	controls.addEventListener('change', schedule)

	applyTheme()
	resetView()
	renderer.setSize(width, height, false)
	frameHandle = requestAnimationFrame(frame)

	return {
		canvas,
		setData(nextRoots, nextUnits) {
			units = nextUnits
			rebuildRoots(nextRoots)
			resetView()
		},
		setSelected(slug) {
			selectedSlug = slug
			applySelection()
			schedule()
		},
		setTheme(nextTheme) {
			theme = nextTheme
			applyTheme()
			schedule()
		},
		resize(nextWidth, nextHeight) {
			width = Math.max(1, Math.round(nextWidth))
			height = Math.max(1, Math.round(nextHeight))
			camera.aspect = width / height
			camera.updateProjectionMatrix()
			renderer.setSize(width, height, false)
			schedule()
		},
		resetView,
		focusRoot(slug) {
			const node = nodes.get(slug)
			if (!node) return
			const offset = camera.position.clone().sub(controls.target)
			// Come in closer than the whole-sector framing, but never inside the marker.
			const focusDistance = Math.max(boundsRadius * 0.45, gridSpacing * 1.5)
			offset.setLength(Math.min(offset.length(), focusDistance))
			controls.target.copy(node.sprite.position)
			camera.position.copy(node.sprite.position).add(offset)
			schedule()
		},
		getCameraState() {
			return {
				position: camera.position.toArray() as [number, number, number],
				target: controls.target.toArray() as [number, number, number],
				fieldOfView: camera.fov,
			}
		},
		setCameraState(state) {
			if (![...state.position, ...state.target, state.fieldOfView].every(Number.isFinite)) return
			if (Math.hypot(
				state.position[0] - state.target[0],
				state.position[1] - state.target[1],
				state.position[2] - state.target[2],
			) <= 1e-9) return
			camera.position.fromArray(state.position)
			controls.target.fromArray(state.target)
			camera.fov = Math.min(179, Math.max(1, state.fieldOfView))
			camera.lookAt(controls.target)
			camera.updateProjectionMatrix()
			schedule()
		},
		destroy() {
			destroyed = true
			cancelAnimationFrame(frameHandle)
			canvas.removeEventListener('pointerdown', handlePointerDown)
			canvas.removeEventListener('pointermove', handlePointerMove)
			canvas.removeEventListener('pointerleave', handlePointerLeave)
			canvas.removeEventListener('click', handleClick)
			canvas.removeEventListener('dblclick', handleDoubleClick)
			canvas.removeEventListener('webglcontextlost', handleContextLost)
			controls.dispose()
			for (const node of nodes.values()) {
				node.material.dispose()
				node.ring.material.dispose()
			}
			discTexture.dispose()
			ringTexture.dispose()
			disposeGrid()
			renderer.dispose()
		},
	}
}
