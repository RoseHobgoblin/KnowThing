import {
	AU_M,
	EARTH_MASS_KG,
	EARTH_RADIUS_M,
	G,
	SOLAR_LUMINOSITY,
	SOLAR_MASS_KG,
	STEFAN_BOLTZMANN,
} from './constants.js'
import type { ModelId } from './model-registry.js'

function requireFinite(name: string, value: number): void {
	if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite; got ${value}`)
}

function requirePositive(name: string, value: number): void {
	requireFinite(name, value)
	if (value <= 0) throw new RangeError(`${name} must be greater than zero; got ${value}`)
}

export interface ModelPackReference {
	id: ModelPackId
	version: string
	title: string
	summary: string
	modelIds: readonly ModelId[]
}

export const MODEL_PACK_IDS = {
	stellarScreening: 'stellar-screening',
	planetaryEnergyBalance: 'planetary-energy-balance',
	kopparapuHabitableZone: 'kopparapu-2014-habitable-zone',
	constantQTides: 'constant-q-tides',
	rockyInteriors: 'rocky-interiors',
} as const

export type ModelPackId = typeof MODEL_PACK_IDS[keyof typeof MODEL_PACK_IDS]

const MODEL_PACK_LIST: readonly ModelPackReference[] = [
	{
		id: MODEL_PACK_IDS.stellarScreening,
		version: '1.0.0',
		title: 'Stellar luminosity and main-sequence screening',
		summary: 'Blackbody luminosity and the Eker et al. empirical main-sequence mass–luminosity screen.',
		modelIds: [
			'star.stefan-boltzmann-luminosity',
			'star.eker-2018-main-sequence-screen',
		],
	},
	{
		id: MODEL_PACK_IDS.planetaryEnergyBalance,
		version: '1.0.0',
		title: 'Planetary irradiation and equilibrium temperature',
		summary: 'Top-of-atmosphere irradiance and globally redistributed blackbody equilibrium temperature.',
		modelIds: [
			'orbit.stellar-irradiance',
			'planet.blackbody-equilibrium-temperature',
		],
	},
	{
		id: MODEL_PACK_IDS.kopparapuHabitableZone,
		version: '1.0.0',
		title: 'Kopparapu 2014 conservative habitable zone',
		summary: 'Runaway-greenhouse and maximum-greenhouse boundaries for supported terrestrial mass classes.',
		modelIds: ['star.kopparapu-2014-conservative-hz'],
	},
	{
		id: MODEL_PACK_IDS.constantQTides,
		version: '1.0.0',
		title: 'Constant-Q tidal screening',
		summary: 'Low-eccentricity synchronous-body eccentricity damping timescale.',
		modelIds: ['satellite.constant-q-eccentricity-damping'],
	},
	{
		id: MODEL_PACK_IDS.rockyInteriors,
		version: '1.0.0',
		title: 'Rocky-planet interior relations',
		summary: 'Published class-specific mass–radius relations for differentiated rocky planets.',
		modelIds: ['planet.zeng-2016-rocky-radius'],
	},
] as const

const MODEL_PACKS = Object.freeze(Object.fromEntries(
	MODEL_PACK_LIST.map(pack => [pack.id, pack]),
)) as Readonly<Record<string, ModelPackReference>>

export function listModelPacks(): readonly ModelPackReference[] {
	return MODEL_PACK_LIST
}

export function getModelPack(id: ModelPackId): ModelPackReference
export function getModelPack(id: string): ModelPackReference | undefined
export function getModelPack(id: string): ModelPackReference | undefined {
	return MODEL_PACKS[id]
}

export type EkerMassDomain =
	| 'ultra-low'
	| 'very-low'
	| 'low'
	| 'intermediate'
	| 'high'
	| 'very-high'

interface EkerMassLuminositySegment {
	domain: EkerMassDomain
	lowerSolarMass: number
	upperSolarMass: number
	slope: number
	intercept: number
	scatterDex: number
}

const EKER_2018_SEGMENTS: readonly EkerMassLuminositySegment[] = [
	{ domain: 'ultra-low', lowerSolarMass: 0.179, upperSolarMass: 0.45, slope: 2.028, intercept: -0.976, scatterDex: 0.076 },
	{ domain: 'very-low', lowerSolarMass: 0.45, upperSolarMass: 0.72, slope: 4.572, intercept: -0.102, scatterDex: 0.109 },
	{ domain: 'low', lowerSolarMass: 0.72, upperSolarMass: 1.05, slope: 5.743, intercept: -0.007, scatterDex: 0.129 },
	{ domain: 'intermediate', lowerSolarMass: 1.05, upperSolarMass: 2.4, slope: 4.329, intercept: 0.01, scatterDex: 0.14 },
	{ domain: 'high', lowerSolarMass: 2.4, upperSolarMass: 7, slope: 3.967, intercept: 0.093, scatterDex: 0.165 },
	{ domain: 'very-high', lowerSolarMass: 7, upperSolarMass: 31, slope: 2.865, intercept: 1.105, scatterDex: 0.152 },
] as const

export interface EkerMainSequenceEstimate {
	expectedLuminosityW: number
	expectedLuminositySolar: number
	luminosityRatio: number
	logLuminosityResidualDex: number
	intrinsicScatterDex: number
	withinOneSigma: boolean
	massDomain: EkerMassDomain
}

export function estimateEker2018MainSequence(
	massKg: number,
	luminosityW: number,
): EkerMainSequenceEstimate {
	requirePositive('massKg', massKg)
	requirePositive('luminosityW', luminosityW)
	const massSolar = massKg / SOLAR_MASS_KG
	const segment = EKER_2018_SEGMENTS.find(candidate =>
		massSolar >= candidate.lowerSolarMass
		&& massSolar <= candidate.upperSolarMass,
	)
	if (segment == null) {
		throw new RangeError('massKg lies outside the Eker et al. 2018 domain of 0.179–31 solar masses')
	}
	const expectedLuminositySolar = 10 ** (
		segment.slope * Math.log10(massSolar) + segment.intercept
	)
	const expectedLuminosityW = expectedLuminositySolar * SOLAR_LUMINOSITY
	const luminosityRatio = luminosityW / expectedLuminosityW
	const logLuminosityResidualDex = Math.log10(luminosityRatio)
	return {
		expectedLuminosityW,
		expectedLuminositySolar,
		luminosityRatio,
		logLuminosityResidualDex,
		intrinsicScatterDex: segment.scatterDex,
		withinOneSigma: Math.abs(logLuminosityResidualDex) <= segment.scatterDex,
		massDomain: segment.domain,
	}
}

export function computeStellarIrradianceWm2(
	luminosityW: number,
	distanceAu: number,
): number {
	requirePositive('luminosityW', luminosityW)
	requirePositive('distanceAu', distanceAu)
	const distanceM = distanceAu * AU_M
	return luminosityW / (4 * Math.PI * distanceM ** 2)
}

export function computeBlackbodyEquilibriumTemperatureK(
	luminosityW: number,
	distanceAu: number,
	bondAlbedo: number,
): number {
	requirePositive('luminosityW', luminosityW)
	requirePositive('distanceAu', distanceAu)
	requireFinite('bondAlbedo', bondAlbedo)
	if (bondAlbedo < 0 || bondAlbedo >= 1) {
		throw new RangeError(`bondAlbedo must be in [0, 1); got ${bondAlbedo}`)
	}
	const irradiance = computeStellarIrradianceWm2(luminosityW, distanceAu)
	return ((irradiance * (1 - bondAlbedo)) / (4 * STEFAN_BOLTZMANN)) ** 0.25
}

export type KopparapuPlanetMassClass = '0.1-earth' | '1-earth' | '5-earth'

interface KopparapuCoefficients {
	solarFlux: number
	a: number
	b: number
	c: number
	d: number
}

const KOPPARAPU_INNER: Readonly<Record<KopparapuPlanetMassClass, KopparapuCoefficients>> = {
	'0.1-earth': { solarFlux: 0.99, a: 1.209e-4, b: 1.404e-8, c: -7.418e-12, d: -1.713e-15 },
	'1-earth': { solarFlux: 1.107, a: 1.332e-4, b: 1.58e-8, c: -8.308e-12, d: -1.931e-15 },
	'5-earth': { solarFlux: 1.188, a: 1.433e-4, b: 1.707e-8, c: -8.968e-12, d: -2.084e-15 },
}

const KOPPARAPU_OUTER: KopparapuCoefficients = {
	solarFlux: 0.356,
	a: 6.171e-5,
	b: 1.698e-9,
	c: -3.198e-12,
	d: -5.575e-16,
}

function kopparapuEffectiveFlux(
	temperatureK: number,
	coefficients: KopparapuCoefficients,
): number {
	const offset = temperatureK - 5780
	return coefficients.solarFlux
		+ coefficients.a * offset
		+ coefficients.b * offset ** 2
		+ coefficients.c * offset ** 3
		+ coefficients.d * offset ** 4
}

export interface KopparapuConservativeHabitableZone {
	innerAu: number
	outerAu: number
	innerEffectiveFlux: number
	outerEffectiveFlux: number
	planetMassClass: KopparapuPlanetMassClass
}

export function computeKopparapu2014ConservativeHabitableZone(
	luminosityW: number,
	effectiveTemperatureK: number,
	planetMassClass: KopparapuPlanetMassClass,
): KopparapuConservativeHabitableZone {
	requirePositive('luminosityW', luminosityW)
	requireFinite('effectiveTemperatureK', effectiveTemperatureK)
	if (effectiveTemperatureK < 2600 || effectiveTemperatureK > 7200) {
		throw new RangeError(
			`effectiveTemperatureK must be in the Kopparapu domain [2600, 7200]; got ${effectiveTemperatureK}`,
		)
	}
	if (!Object.hasOwn(KOPPARAPU_INNER, planetMassClass)) {
		throw new RangeError(`Unsupported planetMassClass ${String(planetMassClass)}`)
	}
	const innerEffectiveFlux = kopparapuEffectiveFlux(
		effectiveTemperatureK,
		KOPPARAPU_INNER[planetMassClass],
	)
	const outerEffectiveFlux = kopparapuEffectiveFlux(
		effectiveTemperatureK,
		KOPPARAPU_OUTER,
	)
	const luminositySolar = luminosityW / SOLAR_LUMINOSITY
	return {
		innerAu: Math.sqrt(luminositySolar / innerEffectiveFlux),
		outerAu: Math.sqrt(luminositySolar / outerEffectiveFlux),
		innerEffectiveFlux,
		outerEffectiveFlux,
		planetMassClass,
	}
}

export function computeConstantQEccentricityDampingTimeS(
	semiMajorAxisAu: number,
	satelliteRadiusM: number,
	satelliteMassKg: number,
	parentMassKg: number,
	tidalQualityFactor: number,
	loveNumberK2: number,
): number {
	requirePositive('semiMajorAxisAu', semiMajorAxisAu)
	requirePositive('satelliteRadiusM', satelliteRadiusM)
	requirePositive('satelliteMassKg', satelliteMassKg)
	requirePositive('parentMassKg', parentMassKg)
	requirePositive('tidalQualityFactor', tidalQualityFactor)
	requirePositive('loveNumberK2', loveNumberK2)
	const semiMajorAxisM = semiMajorAxisAu * AU_M
	const meanMotion = Math.sqrt(
		G * (parentMassKg + satelliteMassKg) / semiMajorAxisM ** 3,
	)
	return (2 / 21)
		* (tidalQualityFactor / loveNumberK2)
		* (satelliteMassKg / parentMassKg)
		* (semiMajorAxisM / satelliteRadiusM) ** 5
		/ meanMotion
}

export interface ZengRockyRadiusEstimate {
	radiusM: number
	radiusEarth: number
	massEarth: number
	coreMassFraction: number
}

export function estimateZeng2016RockyRadius(
	massKg: number,
	coreMassFraction: number,
): ZengRockyRadiusEstimate {
	requirePositive('massKg', massKg)
	requireFinite('coreMassFraction', coreMassFraction)
	const massEarth = massKg / EARTH_MASS_KG
	if (massEarth < 1 || massEarth > 8) {
		throw new RangeError(`massKg must be in the Zeng domain [1, 8] Earth masses; got ${massEarth}`)
	}
	if (coreMassFraction < 0 || coreMassFraction > 0.4) {
		throw new RangeError(`coreMassFraction must be in [0, 0.4]; got ${coreMassFraction}`)
	}
	const radiusEarth = (1.07 - 0.21 * coreMassFraction) * massEarth ** (1 / 3.7)
	return {
		radiusM: radiusEarth * EARTH_RADIUS_M,
		radiusEarth,
		massEarth,
		coreMassFraction,
	}
}
