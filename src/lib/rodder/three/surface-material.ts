import {
	ClampToEdgeWrapping,
	Color,
	DataTexture,
	LinearFilter,
	LinearMipmapLinearFilter,
	Mesh,
	MeshStandardMaterial,
	NoColorSpace,
	RGBAFormat,
	RepeatWrapping,
	SRGBColorSpace,
	TextureLoader,
	type SphereGeometry,
	type Texture,
} from 'three'
import { composeSurfacePlan, surfaceMediaUrl, type SurfaceMapChannel, type SurfacePlan } from '../surface-model.js'
import type { MapBody } from '../system-layout.js'
import { composeWeatherPlan, type WeatherPlan } from '../weather-model.js'
import {
	requestProceduralPlanetTexture,
	type ProceduralTextureSize,
	type TexturePriority,
} from './procedural-texture-client.js'

export type PlanetSurfaceVisual = {
	material: MeshStandardMaterial
	cloudMesh: Mesh | null
	plan: SurfacePlan
	weatherPlan: WeatherPlan
	ready: Promise<void>
	getProceduralLod(): { desired: ProceduralTextureSize, settled: ProceduralTextureSize | null }
	setProceduralLod(size: ProceduralTextureSize, priority: TexturePriority): Promise<void>
	setGeometryVisible(visible: boolean): void
	dispose(): void
}

function colorTuple(colorCss: string): [number, number, number] {
	const hex = new Color(colorCss).getHex(SRGBColorSpace)
	return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

function configureTexture(texture: Texture, color: boolean): Texture {
	texture.colorSpace = color ? SRGBColorSpace : NoColorSpace
	texture.wrapS = RepeatWrapping
	texture.wrapT = ClampToEdgeWrapping
	texture.magFilter = LinearFilter
	texture.minFilter = LinearMipmapLinearFilter
	texture.generateMipmaps = true
	texture.needsUpdate = true
	return texture
}

function dataTexture(data: Uint8Array, width: number, height: number, color: boolean): DataTexture {
	return configureTexture(new DataTexture(data, width, height, RGBAFormat), color) as DataTexture
}

/** Uploaded channels remain owned for the visual lifetime; generated LODs are swapped atomically. */
export function createPlanetSurfaceVisual(args: {
	body: MapBody
	colorCss: string
	radius: number
	sphereGeometry: SphereGeometry
	initialLod?: ProceduralTextureSize
	initialPriority?: TexturePriority
	onTextureChange?: () => void
}): PlanetSurfaceVisual {
	const {
		body, colorCss, radius, sphereGeometry, onTextureChange,
		initialLod = 256, initialPriority = 'background',
	} = args
	const plan = composeSurfacePlan(body, body.surface)
	const weatherPlan = composeWeatherPlan(body, body.weather, body.surface)
	const material = new MeshStandardMaterial({ color: new Color(colorCss), roughness: 0.82, metalness: 0.03 })
	const ownedTextures = new Set<Texture>()
	let generatedTextures = new Set<Texture>()
	let disposed = false
	let geometryVisible = true
	let cloudReady = false
	let cloudMaterial: MeshStandardMaterial | null = null
	let cloudMesh: Mesh | null = null
	let desiredLod: ProceduralTextureSize = initialLod
	let settledLod: ProceduralTextureSize | null = null
	let activeLod: ProceduralTextureSize | null = null
	let requestVersion = 0
	let activeRequest: Promise<void> = Promise.resolve()

	const setColorMap = (texture: Texture) => {
		material.map = texture
		material.color.set(0xFFFFFF)
		material.needsUpdate = true
	}

	// Relief maps arrive from two async sources (LOD promise, TextureLoader
	// callback) in either order, so a single precedence function is the only
	// writer of normalMap/bumpMap: uploaded normal > uploaded elevation >
	// generated normal > generated elevation. Supplied measurements must never
	// be hidden by illustrative relief.
	let uploadedNormal: Texture | null = null
	let generatedNormal: Texture | null = null
	let uploadedBump: Texture | null = null
	let generatedBump: Texture | null = null
	const applyRelief = () => {
		const normal = uploadedNormal ?? (uploadedBump ? null : generatedNormal)
		if (normal) {
			material.normalMap = normal
			const down = normal === uploadedNormal
				&& plan.channels.normal.binding?.interpretation.normalY === 'down'
			material.normalScale.set(0.72, down ? -0.72 : 0.72)
			material.bumpMap = null
		} else {
			material.normalMap = null
			material.bumpMap = uploadedBump ?? generatedBump
			material.bumpScale = 0.055
		}
		material.needsUpdate = true
	}

	const hasCloudLayer = weatherPlan.clouds.source === 'procedural'
	if (hasCloudLayer) {
		cloudMaterial = new MeshStandardMaterial({
			color: 0xFFFFFF,
			transparent: true,
			opacity: 0.72,
			depthWrite: false,
			roughness: 1,
		})
		cloudMesh = new Mesh(sphereGeometry, cloudMaterial)
		cloudMesh.name = 'cloud-layer'
		cloudMesh.scale.setScalar(radius * 1.008)
		cloudMesh.visible = false
	}

	const needsProcedural = Object.values(plan.channels).some(channelPlan => channelPlan.source === 'procedural')
		|| hasCloudLayer
	if (!needsProcedural) settledLod = initialLod
	function setProceduralLod(size: ProceduralTextureSize, priority: TexturePriority): Promise<void> {
		if (activeLod === size) return activeRequest
		desiredLod = size
		if (!needsProcedural || settledLod === size) return Promise.resolve()
		const version = ++requestVersion
		activeLod = size
		activeRequest = requestProceduralPlanetTexture({
			class: plan.class,
			seed: plan.seed,
			temperatureK: plan.temperatureK,
			starTemperatureK: body.hostStarTemperatureK ?? null,
			generateAlbedo: plan.channels.albedo.source === 'procedural',
			coverage: plan.coverage,
			clouds: hasCloudLayer && weatherPlan.clouds.meanCover != null
				? {
					meanCover: weatherPlan.clouds.meanCover,
					seed: weatherPlan.clouds.seed,
				}
				: null,
			tint: colorTuple(colorCss),
		}, { size, priority }).then((generated) => {
			if (disposed || version !== requestVersion || size !== desiredLod) return
			const nextTextures = new Set<Texture>()
			const ownGenerated = <T extends Texture>(texture: T): T => {
				nextTextures.add(texture)
				return texture
			}
			const albedo = plan.channels.albedo.source === 'procedural' && generated.albedo
				? ownGenerated(dataTexture(generated.albedo, generated.width, generated.height, true))
				: null
			const roughness = plan.channels.roughness.source === 'procedural'
				? ownGenerated(dataTexture(generated.roughness, generated.width, generated.height, false))
				: null
			const normal = plan.channels.normal.source === 'procedural' && generated.normal
				? ownGenerated(dataTexture(generated.normal, generated.width, generated.height, false))
				: null
			// A generated normal is the settled procedural relief. Avoid allocating
			// a second GPU texture for the elevation plane when it cannot be bound.
			const elevation = !normal && plan.channels.elevation.source === 'procedural' && generated.elevation
				? ownGenerated(dataTexture(generated.elevation, generated.width, generated.height, false))
				: null
			const clouds = hasCloudLayer && generated.clouds
				? ownGenerated(dataTexture(generated.clouds, generated.width, generated.height, false))
				: null
			if (albedo) setColorMap(albedo)
			if (roughness) {
				material.roughness = 1
				material.roughnessMap = roughness
			}
			generatedBump = elevation
			generatedNormal = normal
			applyRelief()
			if (clouds && cloudMaterial && cloudMesh) {
				cloudMaterial.alphaMap = clouds
				cloudMaterial.needsUpdate = true
				cloudReady = true
				cloudMesh.visible = geometryVisible
			}
			material.needsUpdate = true
			const previousTextures = generatedTextures
			generatedTextures = nextTextures
			settledLod = size
			activeLod = null
			for (const texture of previousTextures) texture.dispose()
			onTextureChange?.()
		}).catch(() => {
			if (version === requestVersion) activeLod = null
			if (version === requestVersion) onTextureChange?.()
		})
		return activeRequest
	}

	const loader = new TextureLoader()
	function loadChannel(channel: SurfaceMapChannel, apply: (texture: Texture) => void): void {
		const channelPlan = plan.channels[channel]
		const binding = channelPlan.binding
		if (channelPlan.source !== 'uploaded' || !binding) return
		const pending = loader.load(
			surfaceMediaUrl(binding),
			(loaded) => {
				if (disposed) {
					loaded.dispose()
					return
				}
				configureTexture(loaded, binding.interpretation.colorSpace === 'srgb')
				apply(loaded)
				onTextureChange?.()
			},
			undefined,
			() => {
				ownedTextures.delete(pending)
				pending.dispose()
				onTextureChange?.()
			},
		)
		ownedTextures.add(pending)
	}

	loadChannel('albedo', setColorMap)
	loadChannel('roughness', (texture) => {
		material.roughness = 1
		material.roughnessMap = texture
		material.needsUpdate = true
	})
	loadChannel('elevation', (texture) => {
		uploadedBump = texture
		applyRelief()
	})
	loadChannel('normal', (texture) => {
		uploadedNormal = texture
		applyRelief()
	})
	loadChannel('emissive', (texture) => {
		material.emissive.set(0xFFFFFF)
		material.emissiveMap = texture
		material.emissiveIntensity = 0.7
		material.needsUpdate = true
	})
	const ready = setProceduralLod(initialLod, initialPriority)
	return {
		material,
		cloudMesh,
		plan,
		weatherPlan,
		ready,
		getProceduralLod: () => ({ desired: desiredLod, settled: settledLod }),
		setProceduralLod,
		setGeometryVisible(visible) {
			geometryVisible = visible
			if (cloudMesh) cloudMesh.visible = visible && cloudReady
		},
		dispose() {
			disposed = true
			requestVersion += 1
			material.dispose()
			cloudMaterial?.dispose()
			for (const texture of ownedTextures) texture.dispose()
			for (const texture of generatedTextures) texture.dispose()
			ownedTextures.clear()
			generatedTextures.clear()
		},
	}
}
