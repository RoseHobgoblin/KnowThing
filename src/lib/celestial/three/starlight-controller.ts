import {
	AmbientLight,
	Color,
	Group,
	PointLight,
	type Vector3,
} from 'three'
import { spectralColor } from '../colors.js'
import type { VisibilityMode } from '../map-settings.js'
import {
	resolveStarlightLuminosity,
	type StarlightLuminositySource,
} from '../starlight-model.js'
import { keyForBody, type EntityKey, type MapBody } from '../system-layout.js'

export const SOLAR_IRRADIANCE_DISPLAY = 2.6
export const DEFAULT_STARLIGHT_EXPOSURE = 1.05
export const MIN_STARLIGHT_EXPOSURE = 0.08
export const MAX_STARLIGHT_EXPOSURE = 512
const MAX_RENDER_LUMINOSITY_SOLAR = 1e6

export type StarlightSummary = {
	lightCount: number
	fallbackCount: number
	derivedCount: number
	label: string
}

export type StarlightExposureCandidate = {
	key: EntityKey
	isStar: boolean
	inside: boolean
	x: number
	y: number
	physicalRadiusPx: number
}

export type StarlightExposureState = {
	policy: 'fixed' | 'auto'
	exposure: number
	ev: number
}

type StarlightRecord = {
	light: PointLight
	source: StarlightLuminositySource
}

export function starlightPointIntensity(
	solarLuminosities: number,
	worldUnitsPerAu: number,
): number {
	if (!Number.isFinite(solarLuminosities) || !Number.isFinite(worldUnitsPerAu)
		|| solarLuminosities <= 0 || worldUnitsPerAu <= 0) return 0
	const renderLuminosity = Math.min(MAX_RENDER_LUMINOSITY_SOLAR, solarLuminosities)
	return SOLAR_IRRADIANCE_DISPLAY * renderLuminosity * worldUnitsPerAu ** 2
}

export function starlightFillIntensity(mode: VisibilityMode): number {
	if (mode === 'physical') return 0
	return mode === 'enhanced' ? 0.018 : 0.035
}

export function focusedStarlightExposure(irradiance: number): number {
	if (!Number.isFinite(irradiance) || irradiance <= 0) return DEFAULT_STARLIGHT_EXPOSURE
	return Math.min(
		MAX_STARLIGHT_EXPOSURE,
		Math.max(
			MIN_STARLIGHT_EXPOSURE,
			DEFAULT_STARLIGHT_EXPOSURE * SOLAR_IRRADIANCE_DISPLAY / irradiance,
		),
	)
}

export function resolveStarlightExposure(
	mode: VisibilityMode,
	irradiance: number | null,
): StarlightExposureState {
	const policy = mode === 'physical' ? 'fixed' : 'auto'
	const exposure = policy === 'auto' && irradiance != null
		? focusedStarlightExposure(irradiance)
		: DEFAULT_STARLIGHT_EXPOSURE
	return {
		policy,
		exposure,
		ev: Math.log2(exposure / DEFAULT_STARLIGHT_EXPOSURE),
	}
}

export function formatStarlightExposure(
	state: StarlightExposureState,
	targetName: string | null,
): string {
	const roundedExposureValue = Math.abs(state.ev) < 0.05 ? 0 : state.ev
	const exposureValueLabel = `${roundedExposureValue > 0 ? '+' : ''}${roundedExposureValue.toFixed(1)} EV`
	if (state.policy === 'fixed') return `Fixed exposure · ${exposureValueLabel}`
	return targetName
		? `Auto exposure · ${exposureValueLabel} · ${targetName}`
		: `Auto exposure · ${exposureValueLabel}`
}

/**
 * Chooses what the camera is inspecting from the view itself, never selection.
 * Tiny overview markers cannot drive exposure; a readable physical body near
 * the optical centre can. This prevents clicking from changing illumination.
 */
export function focusedStarlightTarget(
	candidates: StarlightExposureCandidate[],
	viewportWidth: number,
	viewportHeight: number,
	zoomLevel: number,
): EntityKey | null {
	if (!Number.isFinite(zoomLevel) || zoomLevel < 4) return null
	const centreX = viewportWidth / 2
	const centreY = viewportHeight / 2
	let closest: { key: EntityKey, distance: number } | null = null
	for (const candidate of candidates) {
		if (candidate.isStar || !candidate.inside || candidate.physicalRadiusPx < 1) continue
		const distance = Math.hypot(candidate.x - centreX, candidate.y - centreY)
		const focusRadius = Math.max(FOCUS_RADIUS_PX, candidate.physicalRadiusPx)
		if (distance > focusRadius || (closest && distance >= closest.distance)) continue
		closest = { key: candidate.key, distance }
	}
	return closest?.key ?? null
}

const FOCUS_RADIUS_PX = 96

function summaryFor(records: Iterable<StarlightRecord>): StarlightSummary {
	let lightCount = 0
	let fallbackCount = 0
	let derivedCount = 0
	for (const record of records) {
		lightCount++
		if (record.source === 'fallback') fallbackCount++
		if (record.source === 'derived') derivedCount++
	}
	let label = 'Starlight'
	if (lightCount === 0) label = 'No stellar light'
	else if (fallbackCount > 0) {
		label = `Starlight · ${fallbackCount} luminosity fallback${fallbackCount === 1 ? '' : 's'}`
	}
	return { lightCount, fallbackCount, derivedCount, label }
}

/** Owns luminous-star lights separately from the stars' unlit photospheres. */
export class StarlightController {
	readonly group = new Group()
	readonly fillLight = new AmbientLight(0x9AA7C5, 0)
	#records = new Map<EntityKey, StarlightRecord>()
	#visibilityMode: VisibilityMode = 'enhanced'

	constructor() {
		this.group.name = 'starlight'
		this.group.add(this.fillLight)
	}

	rebuild(stars: MapBody[], worldUnitsPerAu: number): StarlightSummary {
		this.clearStarLights()
		for (const star of stars) {
			const resolved = resolveStarlightLuminosity(star)
			const cssColor = spectralColor(star.spectralType, star.color)
			const color = new Color(cssColor)
			const light = new PointLight(
				color,
				starlightPointIntensity(resolved.solarLuminosities, worldUnitsPerAu),
				0,
				2,
			)
			light.name = `starlight:${star.id}`
			light.castShadow = false
			this.group.add(light)
			this.#records.set(keyForBody(star, true), { light, source: resolved.source })
		}
		return this.summary()
	}

	setPosition(key: EntityKey, position: Vector3): void {
		this.#records.get(key)?.light.position.copy(position)
	}

	setVisibilityMode(mode: VisibilityMode): void {
		this.#visibilityMode = mode
		this.fillLight.intensity = starlightFillIntensity(mode)
	}

	compensateFillForExposure(exposure: number): void {
		const safeExposure = Number.isFinite(exposure) && exposure > 0 ? exposure : 1
		this.fillLight.intensity = starlightFillIntensity(this.#visibilityMode) / safeExposure
	}

	irradianceAt(position: Vector3): number {
		let irradiance = 0
		for (const { light } of this.#records.values()) {
			const distanceSquared = light.position.distanceToSquared(position)
			if (distanceSquared > Number.EPSILON) irradiance += light.intensity / distanceSquared
		}
		return Number.isFinite(irradiance) ? irradiance : 0
	}

	summary(): StarlightSummary {
		return summaryFor(this.#records.values())
	}

	clearStarLights(): void {
		for (const { light } of this.#records.values()) light.removeFromParent()
		this.#records.clear()
	}

	dispose(): void {
		this.clearStarLights()
		this.fillLight.removeFromParent()
		this.group.removeFromParent()
	}
}
