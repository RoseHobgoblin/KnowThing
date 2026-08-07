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
import { requestProceduralPlanetTexture } from './procedural-texture-client.js'

export type PlanetSurfaceVisual = {
	material: MeshStandardMaterial
	cloudMesh: Mesh | null
	plan: SurfacePlan
	ready: Promise<void>
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

/**
 * Composes each material channel independently. Uploaded media always wins;
 * procedural output fills only channels that the surface plan marks procedural.
 */
export function createPlanetSurfaceVisual(args: {
	body: MapBody
	colorCss: string
	radius: number
	sphereGeometry: SphereGeometry
	onTextureChange?: () => void
}): PlanetSurfaceVisual {
	const { body, colorCss, radius, sphereGeometry, onTextureChange } = args
	const plan = composeSurfacePlan(body, body.surface)
	const material = new MeshStandardMaterial({
		color: new Color(colorCss),
		roughness: 0.82,
		metalness: 0.03,
	})
	const ownedTextures = new Set<Texture>()
	let disposed = false
	let geometryVisible = true
	let cloudReady = false
	let cloudMaterial: MeshStandardMaterial | null = null
	let cloudMesh: Mesh | null = null
	const readyTasks: Promise<void>[] = []

	const own = <T extends Texture>(texture: T): T => {
		ownedTextures.add(texture)
		return texture
	}
	const setColorMap = (texture: Texture) => {
		material.map = texture
		material.color.set(0xFFFFFF)
		material.needsUpdate = true
	}

	const hasCloudLayer = plan.channels.clouds.source === 'procedural' || plan.channels.clouds.source === 'uploaded'
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
	if (needsProcedural) {
		const task = requestProceduralPlanetTexture({
			class: plan.class,
			seed: plan.seed,
			temperatureK: plan.temperatureK,
			hydrosphereFraction: plan.hydrosphereFraction,
			cloudCoverage: plan.recipe.cloudCoverage,
			tint: colorTuple(colorCss),
		}).then((generated) => {
			if (disposed) return
			if (plan.channels.albedo.source === 'procedural') {
				setColorMap(own(dataTexture(generated.albedo, generated.width, generated.height, true)))
			}
			if (plan.channels.roughness.source === 'procedural') {
				material.roughness = 1
				material.roughnessMap = own(dataTexture(generated.roughness, generated.width, generated.height, false))
			}
			if (plan.channels.elevation.source === 'procedural' && generated.elevation) {
				material.bumpMap = own(dataTexture(generated.elevation, generated.width, generated.height, false))
				material.bumpScale = 0.055
			}
			if (plan.channels.clouds.source === 'procedural' && generated.clouds && cloudMaterial && cloudMesh) {
				cloudMaterial.alphaMap = own(dataTexture(generated.clouds, generated.width, generated.height, false))
				cloudMaterial.needsUpdate = true
				cloudReady = true
				cloudMesh.visible = geometryVisible
			}
			onTextureChange?.()
		}).catch(() => {
			// Flat material remains a truthful fallback when generation fails.
			onTextureChange?.()
		})
		readyTasks.push(task)
	}

	const loader = new TextureLoader()
	function loadChannel(channel: SurfaceMapChannel, color: boolean, apply: (texture: Texture) => void): void {
		const channelPlan = plan.channels[channel]
		if (channelPlan.source !== 'uploaded' || !channelPlan.filename) return
		const pending = loader.load(
			surfaceMediaUrl(channelPlan.filename),
			(loaded) => {
				if (disposed) {
					loaded.dispose()
					return
				}
				configureTexture(loaded, color)
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

	loadChannel('albedo', true, setColorMap)
	loadChannel('roughness', false, (texture) => {
		material.roughness = 1
		material.roughnessMap = texture
		material.needsUpdate = true
	})
	loadChannel('elevation', false, (texture) => {
		material.bumpMap = texture
		material.bumpScale = 0.055
		material.needsUpdate = true
	})
	loadChannel('normal', false, (texture) => {
		material.normalMap = texture
		// A supplied normal map is more authoritative than fallback/height bump.
		material.bumpMap = null
		material.normalScale.setScalar(0.72)
		material.needsUpdate = true
	})
	loadChannel('emissive', true, (texture) => {
		material.emissive.set(0xFFFFFF)
		material.emissiveMap = texture
		material.emissiveIntensity = 0.7
		material.needsUpdate = true
	})
	if (plan.channels.clouds.source === 'uploaded') {
		loadChannel('clouds', false, (texture) => {
			if (!cloudMaterial || !cloudMesh) return
			cloudMaterial.alphaMap = texture
			cloudMaterial.needsUpdate = true
			cloudReady = true
			cloudMesh.visible = geometryVisible
		})
	}

	return {
		material,
		cloudMesh,
		plan,
		ready: Promise.all(readyTasks).then(() => undefined),
		setGeometryVisible(visible) {
			geometryVisible = visible
			if (cloudMesh) cloudMesh.visible = visible && cloudReady
		},
		dispose() {
			disposed = true
			material.dispose()
			cloudMaterial?.dispose()
			for (const texture of ownedTextures) texture.dispose()
			ownedTextures.clear()
		},
	}
}
