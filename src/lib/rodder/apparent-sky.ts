import type { VisibilityMode } from './map-settings.js'
import type { EntityKey } from './root-layout.js'
import { SOLAR_LUMINOSITY_W, STEFAN_BOLTZMANN_W_M2_K4 } from './starlight-model.js'
import { spectralTemperatureK } from './stellar-surface-model.js'
import { temperatureDisplayRgb } from './three/procedural-stellar-surface.js'

export const LIGHT_YEARS_PER_PARSEC = 3.26156
export const SOLAR_BOLOMETRIC_ABSOLUTE_MAGNITUDE = 4.74
export const NAKED_EYE_MAGNITUDE_LIMIT = 6.5

export type SkySourceKey = `sky-root:${number}`
export type RootSelectionKey = EntityKey | SkySourceKey
export type ApparentSkyStatus = 'available' | 'unavailable'
export type ApparentSkyBrightnessStatus = 'complete' | 'incomplete' | 'unavailable'
export type ApparentSkyBrightnessSource = 'absolute-magnitude' | 'stored-luminosity' | 'derived-luminosity' | 'unavailable'

export type ApparentSkyObserver = {
	rootId: number
	sectorId: number
	sectorName: string
	sectorSlug: string
	units: 'ly' | 'pc'
	handedness: 'right-handed' | 'left-handed'
	referenceEpoch: string | null
	x: number | null
	y: number | null
	z: number | null
}

export type ApparentSkyMemberInput = {
	id: number
	name: string
	slug: string
	spectralType: string | null
	temperatureK: number | null
	luminosityW: number | null
	radiusM: number | null
	absoluteMagnitude: string | null
}

export type ApparentSkyRootInput = {
	rootId: number
	rootName: string
	rootSlug: string
	rootKind: string
	x: number | null
	y: number | null
	z: number | null
	positionProvenance: string
	positionUncertainty: number | null
	stars: ApparentSkyMemberInput[]
}

export type ApparentSkyMember = ApparentSkyMemberInput & {
	apparentMagnitude: number | null
	brightnessSource: ApparentSkyBrightnessSource
}

export type ApparentSkySource = {
	key: SkySourceKey
	rootId: number
	rootName: string
	rootSlug: string
	rootKind: string
	direction: [number, number, number]
	distance: number
	distancePc: number
	units: 'ly' | 'pc'
	apparentMagnitude: number | null
	brightnessStatus: ApparentSkyBrightnessStatus
	displayColor: string
	positionProvenance: string
	positionUncertainty: number | null
	stars: ApparentSkyMember[]
}

export type ApparentSkyDiagnostics = {
	observerRoot: number
	incompatibleSectorRoots: number
	unpositionedRoots: number
	starlessRoots: number
	coincidentRoots: number
	incompleteBrightnessSources: number
}

export type ApparentSkyResult = {
	status: ApparentSkyStatus
	reason: string | null
	sector: {
		id: number
		name: string
		slug: string
		units: 'ly' | 'pc'
		handedness: 'right-handed' | 'left-handed'
		referenceEpoch: string | null
	} | null
	sources: ApparentSkySource[]
	diagnostics: ApparentSkyDiagnostics
}

export type ApparentSkyVisual = {
	visible: boolean
	sizePx: number
	opacity: number
	major: boolean
}

const EMPTY_DIAGNOSTICS: ApparentSkyDiagnostics = {
	observerRoot: 0,
	incompatibleSectorRoots: 0,
	unpositionedRoots: 0,
	starlessRoots: 0,
	coincidentRoots: 0,
	incompleteBrightnessSources: 0,
}

function positiveFinite(value: number | null | undefined): value is number {
	return value != null && Number.isFinite(value) && value > 0
}

function strictNumber(value: string | null): number | null {
	if (value == null || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

export function distanceToParsecs(distance: number, units: 'ly' | 'pc'): number {
	return units === 'pc' ? distance : distance / LIGHT_YEARS_PER_PARSEC
}

export function apparentMagnitudeFromAbsolute(absoluteMagnitude: number, distancePc: number): number {
	return absoluteMagnitude + 5 * Math.log10(distancePc) - 5
}

/** Preserve canonical sector coordinates; reflect only at the right-handed Three.js boundary. */
export function apparentSkyDirectionForRenderer(
	direction: [number, number, number],
	handedness: 'right-handed' | 'left-handed',
): [number, number, number] {
	return handedness === 'left-handed'
		? [direction[0], -direction[1], direction[2]]
		: [...direction]
}

function physicalLuminosity(member: ApparentSkyMemberInput): { luminosityW: number, source: ApparentSkyBrightnessSource } | null {
	if (positiveFinite(member.luminosityW)) {
		return { luminosityW: member.luminosityW, source: 'stored-luminosity' }
	}
	if (!positiveFinite(member.radiusM) || !positiveFinite(member.temperatureK)) return null
	const luminosityW = 4 * Math.PI
		* member.radiusM ** 2
		* STEFAN_BOLTZMANN_W_M2_K4
		* member.temperatureK ** 4
	return positiveFinite(luminosityW) ? { luminosityW, source: 'derived-luminosity' } : null
}

function resolveMemberMagnitude(member: ApparentSkyMemberInput, distancePc: number): ApparentSkyMember {
	const absoluteMagnitude = strictNumber(member.absoluteMagnitude)
	if (absoluteMagnitude != null) {
		return {
			...member,
			apparentMagnitude: apparentMagnitudeFromAbsolute(absoluteMagnitude, distancePc),
			brightnessSource: 'absolute-magnitude',
		}
	}
	const luminosity = physicalLuminosity(member)
	if (!luminosity) return { ...member, apparentMagnitude: null, brightnessSource: 'unavailable' }
	const bolometricAbsoluteMagnitude = SOLAR_BOLOMETRIC_ABSOLUTE_MAGNITUDE
		- 2.5 * Math.log10(luminosity.luminosityW / SOLAR_LUMINOSITY_W)
	return {
		...member,
		apparentMagnitude: apparentMagnitudeFromAbsolute(bolometricAbsoluteMagnitude, distancePc),
		brightnessSource: luminosity.source,
	}
}

function srgbToLinear(channel: number): number {
	const value = Math.min(1, Math.max(0, channel / 255))
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(channel: number): number {
	const value = Math.max(0, channel)
	return Math.round(255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055))
}

function memberDisplayRgb(member: ApparentSkyMember): [number, number, number] {
	const temperature = positiveFinite(member.temperatureK)
		? member.temperatureK
		: spectralTemperatureK(member.spectralType)
	return temperature ? temperatureDisplayRgb(temperature) : [255, 255, 255]
}

function combinedColor(members: ApparentSkyMember[]): string {
	let totalWeight = 0
	const linear = [0, 0, 0]
	for (const member of members) {
		if (member.apparentMagnitude == null) continue
		const weight = 10 ** (-0.4 * member.apparentMagnitude)
		const rgb = memberDisplayRgb(member)
		for (let channel = 0; channel < 3; channel++) linear[channel] += srgbToLinear(rgb[channel]) * weight
		totalWeight += weight
	}
	if (totalWeight === 0) return '#FFFFFF'
	const channels = linear.map(channel => linearToSrgb(channel / totalWeight))
	return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export function resolveApparentSkyVisual(source: ApparentSkySource, visibility: VisibilityMode): ApparentSkyVisual {
	const magnitude = source.apparentMagnitude
	if (visibility === 'physical' && (magnitude == null || magnitude > NAKED_EYE_MAGNITUDE_LIMIT)) {
		return { visible: false, sizePx: 0, opacity: 0, major: false }
	}
	if (magnitude == null) {
		return visibility === 'markers'
			? { visible: true, sizePx: 7, opacity: 0.72, major: false }
			: { visible: true, sizePx: 2, opacity: 0.42, major: false }
	}
	const prominence = Math.max(0, NAKED_EYE_MAGNITUDE_LIMIT - magnitude)
	const baseSize = Math.min(12, Math.max(1.25, 1.25 + prominence * 0.72))
	const sizePx = visibility === 'markers' ? Math.max(6, baseSize) : baseSize
	const opacity = Math.min(1, Math.max(0.18, 0.2 + prominence * 0.12))
	return { visible: true, sizePx, opacity, major: magnitude <= 1.5 }
}

export function buildApparentSky(
	observer: ApparentSkyObserver | null,
	roots: ApparentSkyRootInput[],
	externalDiagnostics?: Pick<ApparentSkyDiagnostics, 'incompatibleSectorRoots'>,
): ApparentSkyResult {
	const diagnostics = {
		...EMPTY_DIAGNOSTICS,
		observerRoot: observer ? 1 : 0,
		incompatibleSectorRoots: externalDiagnostics?.incompatibleSectorRoots ?? 0,
	}
	const sector = observer
		? {
			id: observer.sectorId,
			name: observer.sectorName,
			slug: observer.sectorSlug,
			units: observer.units,
			handedness: observer.handedness,
			referenceEpoch: observer.referenceEpoch,
		}
		: null
	if (!observer) {
		return { status: 'unavailable', reason: 'This root does not belong to a declared sector.', sector, sources: [], diagnostics }
	}
	if (observer.x == null || observer.y == null || observer.z == null
		|| ![observer.x, observer.y, observer.z].every(Number.isFinite)) {
		return { status: 'unavailable', reason: 'The observer root has no complete sector position.', sector, sources: [], diagnostics }
	}

	const sources: ApparentSkySource[] = []
	for (const root of roots) {
		if (root.rootId === observer.rootId) continue
		if (root.stars.length === 0) {
			diagnostics.starlessRoots++
			continue
		}
		if (root.x == null || root.y == null || root.z == null
			|| ![root.x, root.y, root.z].every(Number.isFinite)) {
			diagnostics.unpositionedRoots++
			continue
		}
		const vector: [number, number, number] = [
			root.x - observer.x,
			root.y - observer.y,
			root.z - observer.z,
		]
		const distance = Math.hypot(...vector)
		if (!positiveFinite(distance)) {
			diagnostics.coincidentRoots++
			continue
		}
		const distancePc = distanceToParsecs(distance, observer.units)
		const stars = root.stars.map(star => resolveMemberMagnitude(star, distancePc))
		const known = stars.filter(star => star.apparentMagnitude != null)
		let brightnessStatus: ApparentSkyBrightnessStatus = 'incomplete'
		if (known.length === 0) brightnessStatus = 'unavailable'
		else if (known.length === stars.length) brightnessStatus = 'complete'
		if (brightnessStatus !== 'complete') diagnostics.incompleteBrightnessSources++
		const totalFlux = known.reduce((sum, star) => sum + 10 ** (-0.4 * star.apparentMagnitude!), 0)
		const apparentMagnitude = totalFlux > 0 ? -2.5 * Math.log10(totalFlux) : null
		sources.push({
			key: `sky-root:${root.rootId}`,
			rootId: root.rootId,
			rootName: root.rootName,
			rootSlug: root.rootSlug,
			rootKind: root.rootKind,
			direction: vector.map(component => component / distance) as [number, number, number],
			distance,
			distancePc,
			units: observer.units,
			apparentMagnitude,
			brightnessStatus,
			displayColor: combinedColor(stars),
			positionProvenance: root.positionProvenance,
			positionUncertainty: root.positionUncertainty,
			stars,
		})
	}

	return { status: 'available', reason: null, sector, sources, diagnostics }
}
