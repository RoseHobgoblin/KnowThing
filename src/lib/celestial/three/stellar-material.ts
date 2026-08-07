import {
	ClampToEdgeWrapping,
	Color,
	DataTexture,
	LinearFilter,
	LinearMipmapLinearFilter,
	RepeatWrapping,
	RGBAFormat,
	ShaderMaterial,
	SRGBColorSpace,
	TextureLoader,
	type Texture,
} from 'three'
import type { VisibilityMode } from '../map-settings.js'
import {
	composeStellarSurfacePlan,
	stellarSurfaceMediaUrl,
	type StellarSurfacePlan,
} from '../stellar-surface-model.js'
import type { MapBody } from '../system-layout.js'
import { temperatureDisplayRgb } from './procedural-stellar-surface.js'
import { requestProceduralStellarTexture } from './procedural-texture-client.js'

export type StellarSurfaceVisual = {
	material: ShaderMaterial
	plan: StellarSurfacePlan
	ready: Promise<void>
	setVisibilityMode(mode: VisibilityMode): void
	dispose(): void
}

const vertexShader = /* glsl */`
	varying vec2 vUv;
	varying vec3 vNormal;
	varying vec3 vViewDirection;

	void main() {
		vUv = uv;
		vNormal = normalize(normalMatrix * normal);
		vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
		vViewDirection = normalize(-viewPosition.xyz);
		gl_Position = projectionMatrix * viewPosition;
	}
`

const fragmentShader = /* glsl */`
	uniform sampler2D photosphereMap;
	uniform float hasPhotosphereMap;
	uniform float structureStrength;
	uniform vec3 baseColor;
	uniform vec3 rimColor;

	varying vec2 vUv;
	varying vec3 vNormal;
	varying vec3 vViewDirection;

	void main() {
		vec3 sampled = texture2D(photosphereMap, vUv).rgb;
		vec3 structured = mix(baseColor, sampled, hasPhotosphereMap);
		vec3 photosphere = mix(baseColor, structured, structureStrength);
		float viewCosine = max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0);
		float limbDarkening = 0.35 + 0.65 * pow(viewCosine, 0.6);
		float chromosphere = pow(1.0 - viewCosine, 2.5);
		vec3 outgoingLight = photosphere * limbDarkening + rimColor * chromosphere * 0.45;
		gl_FragColor = vec4(outgoingLight, 1.0);
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
	}
`

function configureColorTexture(texture: Texture): Texture {
	texture.colorSpace = SRGBColorSpace
	texture.wrapS = RepeatWrapping
	texture.wrapT = ClampToEdgeWrapping
	texture.magFilter = LinearFilter
	texture.minFilter = LinearMipmapLinearFilter
	texture.generateMipmaps = true
	texture.needsUpdate = true
	return texture
}

function generatedTexture(data: Uint8Array, width: number, height: number): DataTexture {
	return configureColorTexture(new DataTexture(data, width, height, RGBAFormat)) as DataTexture
}

function colorFromDisplayRgb(rgb: [number, number, number]): Color {
	return new Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, SRGBColorSpace)
}

/**
 * Creates the star's unlit photosphere. Procedural structure is visible only
 * in Enhanced mode; uploaded authored/observational plates may also appear in
 * Physical mode. Marker visibility remains the body-visual controller's job.
 */
export function createStellarSurfaceVisual(args: {
	body: MapBody
	colorCss: string
	onTextureChange?: () => void
}): StellarSurfaceVisual {
	const { body, colorCss, onTextureChange } = args
	const plan = composeStellarSurfacePlan(body, body.stellarSurface)
	const ownedTextures = new Set<Texture>()
	const fallbackPixel = new Uint8Array([255, 255, 255, 255])
	const fallbackTexture = generatedTexture(fallbackPixel, 1, 1)
	ownedTextures.add(fallbackTexture)
	const rimTemperature = Math.min(plan.temperatureK * 1.6, 40_000)
	const material = new ShaderMaterial({
		name: 'stellar-photosphere',
		vertexShader,
		fragmentShader,
		uniforms: {
			photosphereMap: { value: fallbackTexture },
			hasPhotosphereMap: { value: 0 },
			structureStrength: { value: 0 },
			baseColor: { value: new Color(colorCss) },
			rimColor: { value: colorFromDisplayRgb(temperatureDisplayRgb(rimTemperature)) },
		},
	})
	let disposed = false
	const readyTasks: Promise<void>[] = []

	if (plan.photosphere.source === 'procedural') {
		const task = requestProceduralStellarTexture({
			temperatureK: plan.temperatureK,
			morphology: plan.morphology,
			rotationDays: plan.rotationDays,
			activity: plan.activity,
			seed: plan.seed,
		}).then((generated) => {
			if (disposed) return
			const texture = generatedTexture(generated.photosphere, generated.width, generated.height)
			ownedTextures.add(texture)
			material.uniforms.photosphereMap.value = texture
			material.uniforms.hasPhotosphereMap.value = 1
			onTextureChange?.()
		}).catch(() => {
			// The restrained base photosphere remains available on generation failure.
			onTextureChange?.()
		})
		readyTasks.push(task)
	}

	if (plan.photosphere.source === 'uploaded' && plan.photosphere.filename) {
		const loader = new TextureLoader()
		const pending = loader.load(
			stellarSurfaceMediaUrl(plan.photosphere.filename),
			(loaded) => {
				if (disposed) {
					loaded.dispose()
					return
				}
				configureColorTexture(loaded)
				material.uniforms.photosphereMap.value = loaded
				material.uniforms.hasPhotosphereMap.value = 1
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

	function setVisibilityMode(mode: VisibilityMode): void {
		const authored = plan.photosphere.source === 'uploaded'
		const hasStructure = plan.photosphere.source !== 'constant'
		material.uniforms.structureStrength.value = hasStructure
			&& (mode === 'enhanced' || (mode === 'physical' && authored))
			? 1
			: 0
	}

	return {
		material,
		plan,
		ready: Promise.all(readyTasks).then(() => undefined),
		setVisibilityMode,
		dispose() {
			disposed = true
			material.dispose()
			for (const texture of ownedTextures) texture.dispose()
			ownedTextures.clear()
		},
	}
}
