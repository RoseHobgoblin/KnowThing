export interface CelestialPreset {
	label: string
	description: string
	system: {
		name: string
	}
	stars: StarPreset[]
}

export interface StarPreset {
	name: string
	spectralType: string
	mass: string
	massKg: number
	radius: string
	radiusM: number
	luminosity: string
	luminosityW?: number
	temperature: string
	temperatureK?: number
	age: string
	color: string
	apparentMagnitude: string
	bodies: BodyPreset[]
}

export interface BodyPreset {
	name: string
	description?: string
	bodyType: 'planet' | 'asteroid'
	mass: string
	massKg: number
	radius: string
	radiusM: number
	density: string
	surfaceGravity: string
	temperatureK: number
	atmosphere: string
	surfacePressure?: string
	composition: string
	orbitalPeriod: string
	orbitalPeriodDays: number
	semiMajorAxisAu: number
	eccentricity: number
	inclination: number
	longitudeAscendingNode?: number
	argumentOfPeriapsis?: number
	epochPhase?: number
	rotationPeriod: string
	rotationPeriodS: number
	axialTilt: number
	satellites: number
	hasRings: boolean
	extra?: Record<string, unknown>
	seedSurface?: PresetSurface
	moons?: BodyPreset[]
}

export interface PresetMediaAsset {
	publicPath: string
	filename: string
	mimeType: string
	width: number
	height: number
	sizeBytes: number
	contentHash: string
	description: string
	interpretation: {
		projection: 'equirectangular'
		colorSpace: 'srgb' | 'linear'
		elevationUnit?: 'relative' | 'm' | 'km'
		elevationScale?: number
		elevationOffset?: number
		elevationDatum?: string
		elevationPositiveDirection?: 'up' | 'down'
	}
}

export interface PresetSurface {
	fallback: 'procedural' | 'flat'
	class: 'rocky' | 'terrestrial' | 'gas' | 'ice'
	seed: number | null
	coverage: {
		surfaceWater: number | null
		vegetation: number | null
		permanentSnowIce: number | null
	}
	maps: Partial<Record<'albedo' | 'elevation' | 'normal' | 'roughness' | 'emissive', PresetMediaAsset>>
}

/**
 * Flat lookup of individual star presets by name (e.g. "The Sun").
 * Built from the nested celestialPresets structure for use on configure pages.
 */
export function getStarPresets(): Map<string, StarPreset> {
	const map = new Map<string, StarPreset>()
	for (const preset of celestialPresets) {
		for (const star of preset.stars) {
			map.set(star.name, star)
		}
	}
	return map
}

/**
 * Flat lookup of individual body presets by name (e.g. "Earth", "Luna").
 * Includes planets and moons from all system presets.
 */
export function getBodyPresets(): Map<string, BodyPreset> {
	const map = new Map<string, BodyPreset>()
	for (const preset of celestialPresets) {
		for (const star of preset.stars) {
			for (const body of star.bodies) {
				map.set(body.name, body)
				if (body.moons) {
					for (const moon of body.moons) {
						map.set(moon.name, moon)
					}
				}
			}
		}
	}
	return map
}

export const celestialPresets: CelestialPreset[] = [
	{
		label: 'Solar System',
		description: 'Our solar system with the Sun, 8 planets, and major moons.',
		system: { name: 'Solar System' },
		stars: [
			{
				name: 'The Sun',
				spectralType: 'G2V',
				mass: '1.989 × 10³⁰ kg (1.0 M☉)',
				massKg: 1.989e30,
				radius: '696,340 km (1.0 R☉)',
				radiusM: 696_340_000,
				luminosity: '3.828 × 10²⁶ W (1.0 L☉)',
				luminosityW: 3.828e26,
				temperature: '5,778 K',
				temperatureK: 5778,
				age: '~4.6 billion years',
				color: 'Yellow-white',
				apparentMagnitude: '−26.74',
				bodies: [
					{
						name: 'Mercury',
						bodyType: 'planet',
						mass: '3.301 × 10²³ kg',
						massKg: 3.301e23,
						radius: '2,439.7 km',
						radiusM: 2_439_700,
						density: '5.427 g/cm³',
						surfaceGravity: '3.7 m/s²',
						temperatureK: 440,
						atmosphere: 'Trace (O₂, Na, H₂)',
						composition: 'Iron, silicates',
						orbitalPeriod: '87.97 days',
						orbitalPeriodDays: 87.969,
						semiMajorAxisAu: 0.387,
						eccentricity: 0.2056,
						inclination: 7,
						rotationPeriod: '58.646 days',
						rotationPeriodS: 5_067_360,
						axialTilt: 0.034,
						satellites: 0,
						hasRings: false,
					},
					{
						name: 'Venus',
						bodyType: 'planet',
						mass: '4.867 × 10²⁴ kg',
						massKg: 4.867e24,
						radius: '6,051.8 km',
						radiusM: 6_051_800,
						density: '5.243 g/cm³',
						surfaceGravity: '8.87 m/s²',
						temperatureK: 737,
						atmosphere: 'CO₂ 96.5%, N₂ 3.5%',
						composition: 'Iron, silicates',
						orbitalPeriod: '224.7 days',
						orbitalPeriodDays: 224.701,
						semiMajorAxisAu: 0.723,
						eccentricity: 0.0067,
						inclination: 3.39,
						rotationPeriod: '243.025 days (retrograde)',
						rotationPeriodS: 20_997_360,
						axialTilt: 177.36,
						satellites: 0,
						hasRings: false,
					},
					{
						name: 'Earth',
						bodyType: 'planet',
						mass: '5.972 × 10²⁴ kg',
						massKg: 5.972e24,
						radius: '6,371.0 km',
						radiusM: 6_371_000,
						density: '5.514 g/cm³',
						surfaceGravity: '9.807 m/s²',
						temperatureK: 288,
						atmosphere: 'N₂ 78%, O₂ 21%, Ar 0.93%',
						composition: 'Iron, nickel, silicates',
						orbitalPeriod: '365.256 days',
						orbitalPeriodDays: 365.256,
						semiMajorAxisAu: 1,
						eccentricity: 0.0167,
						inclination: 0,
						rotationPeriod: '23h 56m 4s',
						rotationPeriodS: 86_164,
						axialTilt: 23.44,
						satellites: 1,
						hasRings: false,
						moons: [
							{
								name: 'Luna',
								bodyType: 'planet',
								mass: '7.342 × 10²² kg',
								massKg: 7.342e22,
								radius: '1,737.4 km',
								radiusM: 1_737_400,
								density: '3.344 g/cm³',
								surfaceGravity: '1.62 m/s²',
								temperatureK: 250,
								atmosphere: '',
								composition: 'Silicates, iron oxide',
								orbitalPeriod: '27.322 days',
								orbitalPeriodDays: 27.322,
								semiMajorAxisAu: 0.00257,
								eccentricity: 0.0549,
								inclination: 5.145,
								rotationPeriod: '27.322 days (tidally locked)',
								rotationPeriodS: 2_360_620,
								axialTilt: 6.687,
								satellites: 0,
								hasRings: false,
							},
						],
					},
					{
						name: 'Mars',
						description: 'The fourth planet from the Sun: a cold, dry, iron-oxide-rich rocky world with a thin carbon-dioxide atmosphere and two small moons.',
						bodyType: 'planet',
						mass: '6.41691 × 10²³ kg',
						massKg: 6.41691e23,
						radius: '3,389.5 km',
						radiusM: 3_389_500,
						density: '3.934 g/cm³',
						surfaceGravity: '3.71 m/s² (equatorial)',
						temperatureK: 210,
						atmosphere: 'CO₂ 95.32%, N₂ 2.7%, Ar 1.6%, traces of O₂, CO, H₂O and noble gases',
						surfacePressure: '0.636 kPa (mean; seasonally variable)',
						composition: 'Silicate crust and mantle; iron-nickel-sulfur core; iron-oxide-rich regolith',
						orbitalPeriod: '686.9796 days',
						orbitalPeriodDays: 686.9795859,
						semiMajorAxisAu: 1.52371243,
						eccentricity: 0.09336511,
						inclination: 1.85181869,
						longitudeAscendingNode: 49.71320984,
						argumentOfPeriapsis: 286.36934232,
						rotationPeriod: '24h 37m 22.7s',
						rotationPeriodS: 88_642.664064,
						axialTilt: 25.19,
						satellites: 2,
						hasRings: false,
						extra: {
							seedData: {
								id: 'solar-system/mars', version: 1,
								manifest: '/seed-data/celestial/mars/manifest.json',
							},
							referenceBody: {
								frame: 'IAU_MARS', naifBodyCode: 499,
								radiiM: [3_396_190, 3_396_190, 3_376_200],
								latitudeType: 'planetocentric', longitudeDirection: 'positive-east',
								longitudeDomain: '-180..180',
							},
							dataSources: {
								physical: 'https://ssd.jpl.nasa.gov/planets/phys_par.html',
								orbit: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
								atmosphere: 'https://ntrs.nasa.gov/citations/20220019141',
							},
						},
						seedSurface: {
							fallback: 'flat',
							class: 'rocky',
							seed: null,
							coverage: { surfaceWater: 0, vegetation: 0, permanentSnowIce: 0 },
							maps: {
								albedo: {
									publicPath: 'seed-data/celestial/mars/runtime/mars-mdim21-color-4096x2048.webp',
									filename: 'Mars_MDIM21_colour_4096x2048.webp',
									mimeType: 'image/webp', width: 4096, height: 2048, sizeBytes: 2_696_266,
									contentHash: '81a2e8e4f2fb07a60c6147b91edc303cf2f2d815e3224fd3755e5db888810fd8',
									description: 'Mars surface appearance from the USGS Viking MDIM 2.1 colorized global mosaic. Public-domain 4K runtime derivative; see the Mars seed manifest for source and processing provenance.',
									interpretation: { projection: 'equirectangular', colorSpace: 'srgb' },
								},
								elevation: {
									publicPath: 'seed-data/celestial/mars/runtime/mars-mola-megdr-topography-4096x2048.png',
									filename: 'Mars_MOLA_topography_4096x2048.png',
									mimeType: 'image/png', width: 4096, height: 2048, sizeBytes: 2_629_834,
									contentHash: '7ebe4a0c4c2166f1661f4b7d27a0a87c2bdb9edb3a6b20e7a659c32c329fbf2f',
									description: 'Linear overview encoding of NASA PDS MGS MOLA 16-pixel/degree median topography. Values are metres above the GMM3 areoid; see the Mars seed manifest for the original PDS product and exact derivation.',
									interpretation: {
										projection: 'equirectangular', colorSpace: 'linear', elevationUnit: 'm',
										elevationScale: 29_348, elevationOffset: -8177,
										elevationDatum: 'Mars GMM3 (mgm1025) areoid, degree/order 50',
										elevationPositiveDirection: 'up',
									},
								},
							},
						},
						moons: [
							{
								name: 'Phobos', bodyType: 'planet', mass: '1.066 × 10¹⁶ kg', massKg: 1.066e16, radius: '11.267 km', radiusM: 11_267,
								density: '1.876 g/cm³', surfaceGravity: '0.0057 m/s²', temperatureK: 233,
								atmosphere: '', composition: 'Carbon chondrite',
								orbitalPeriod: '0.319 days', orbitalPeriodDays: 0.3189, semiMajorAxisAu: 0.0000628,
								eccentricity: 0.0151, inclination: 1.093, rotationPeriod: '0.319 days (tidally locked)',
								rotationPeriodS: 27_554, axialTilt: 0, satellites: 0, hasRings: false,
							},
							{
								name: 'Deimos', bodyType: 'planet', mass: '1.476 × 10¹⁵ kg', massKg: 1.476e15, radius: '6.2 km', radiusM: 6_200,
								density: '1.471 g/cm³', surfaceGravity: '0.003 m/s²', temperatureK: 233,
								atmosphere: '', composition: 'Carbon chondrite',
								orbitalPeriod: '1.263 days', orbitalPeriodDays: 1.2624, semiMajorAxisAu: 0.000157,
								eccentricity: 0.0002, inclination: 0.93, rotationPeriod: '1.263 days (tidally locked)',
								rotationPeriodS: 109_075, axialTilt: 0, satellites: 0, hasRings: false,
							},
						],
					},
					{
						name: 'Jupiter',
						bodyType: 'planet',
						mass: '1.898 × 10²⁷ kg',
						massKg: 1.898e27,
						radius: '69,911 km',
						radiusM: 69_911_000,
						density: '1.326 g/cm³',
						surfaceGravity: '24.79 m/s²',
						temperatureK: 165,
						atmosphere: 'H₂ 89.8%, He 10.2%',
						composition: 'Hydrogen, helium (gas giant)',
						orbitalPeriod: '11.862 years',
						orbitalPeriodDays: 4332.59,
						semiMajorAxisAu: 5.203,
						eccentricity: 0.0489,
						inclination: 1.303,
						rotationPeriod: '9h 55m 30s',
						rotationPeriodS: 35_730,
						axialTilt: 3.13,
						satellites: 95,
						hasRings: true,
						moons: [
							{
								name: 'Io', bodyType: 'planet', mass: '8.932 × 10²² kg', massKg: 8.932e22, radius: '1,821.6 km', radiusM: 1_821_600,
								density: '3.528 g/cm³', surfaceGravity: '1.796 m/s²', temperatureK: 110,
								atmosphere: 'SO₂ (thin)', composition: 'Silicates, sulfur',
								orbitalPeriod: '1.769 days', orbitalPeriodDays: 1.7691, semiMajorAxisAu: 0.00282,
								eccentricity: 0.0041, inclination: 0.05, rotationPeriod: '1.769 days (tidally locked)',
								rotationPeriodS: 152_853, axialTilt: 0, satellites: 0, hasRings: false,
							},
							{
								name: 'Europa', bodyType: 'planet', mass: '4.800 × 10²² kg', massKg: 4.8e22, radius: '1,560.8 km', radiusM: 1_560_800,
								density: '3.013 g/cm³', surfaceGravity: '1.315 m/s²', temperatureK: 102,
								atmosphere: 'O₂ (thin)', composition: 'Ice, silicates, subsurface ocean',
								orbitalPeriod: '3.551 days', orbitalPeriodDays: 3.5512, semiMajorAxisAu: 0.00449,
								eccentricity: 0.009, inclination: 0.47, rotationPeriod: '3.551 days (tidally locked)',
								rotationPeriodS: 306_823, axialTilt: 0.1, satellites: 0, hasRings: false,
							},
							{
								name: 'Ganymede', bodyType: 'planet', mass: '1.482 × 10²³ kg', massKg: 1.482e23, radius: '2,634.1 km', radiusM: 2_634_100,
								density: '1.936 g/cm³', surfaceGravity: '1.428 m/s²', temperatureK: 110,
								atmosphere: 'O₂ (thin)', composition: 'Ice, silicates',
								orbitalPeriod: '7.155 days', orbitalPeriodDays: 7.1546, semiMajorAxisAu: 0.00716,
								eccentricity: 0.0013, inclination: 0.2, rotationPeriod: '7.155 days (tidally locked)',
								rotationPeriodS: 618_153, axialTilt: 0.33, satellites: 0, hasRings: false,
							},
							{
								name: 'Callisto', bodyType: 'planet', mass: '1.076 × 10²³ kg', massKg: 1.076e23, radius: '2,410.3 km', radiusM: 2_410_300,
								density: '1.834 g/cm³', surfaceGravity: '1.235 m/s²', temperatureK: 134,
								atmosphere: 'CO₂ (thin)', composition: 'Ice, rock',
								orbitalPeriod: '16.689 days', orbitalPeriodDays: 16.689, semiMajorAxisAu: 0.01259,
								eccentricity: 0.0074, inclination: 0.192, rotationPeriod: '16.689 days (tidally locked)',
								rotationPeriodS: 1_441_930, axialTilt: 0, satellites: 0, hasRings: false,
							},
						],
					},
					{
						name: 'Saturn',
						bodyType: 'planet',
						mass: '5.683 × 10²⁶ kg',
						massKg: 5.683e26,
						radius: '58,232 km',
						radiusM: 58_232_000,
						density: '0.687 g/cm³',
						surfaceGravity: '10.44 m/s²',
						temperatureK: 134,
						atmosphere: 'H₂ 96.3%, He 3.25%',
						composition: 'Hydrogen, helium (gas giant)',
						orbitalPeriod: '29.457 years',
						orbitalPeriodDays: 10_759.22,
						semiMajorAxisAu: 9.537,
						eccentricity: 0.0565,
						inclination: 2.485,
						rotationPeriod: '10h 33m 38s',
						rotationPeriodS: 38_018,
						axialTilt: 26.73,
						satellites: 146,
						hasRings: true,
						moons: [
							{
								name: 'Titan', bodyType: 'planet', mass: '1.345 × 10²³ kg', massKg: 1.345e23, radius: '2,574.7 km', radiusM: 2_574_700,
								density: '1.882 g/cm³', surfaceGravity: '1.352 m/s²', temperatureK: 94,
								atmosphere: 'N₂ 98.4%, CH₄ 1.4%', composition: 'Ice, rock, hydrocarbon lakes',
								orbitalPeriod: '15.945 days', orbitalPeriodDays: 15.945, semiMajorAxisAu: 0.00817,
								eccentricity: 0.0288, inclination: 0.349, rotationPeriod: '15.945 days (tidally locked)',
								rotationPeriodS: 1_377_648, axialTilt: 0, satellites: 0, hasRings: false,
							},
							{
								name: 'Enceladus', bodyType: 'planet', mass: '1.080 × 10²⁰ kg', massKg: 1.08e20, radius: '252.1 km', radiusM: 252_100,
								density: '1.609 g/cm³', surfaceGravity: '0.113 m/s²', temperatureK: 75,
								atmosphere: 'H₂O vapor (geyser)', composition: 'Ice, subsurface ocean',
								orbitalPeriod: '1.370 days', orbitalPeriodDays: 1.3702, semiMajorAxisAu: 0.00159,
								eccentricity: 0.0047, inclination: 0.019, rotationPeriod: '1.370 days (tidally locked)',
								rotationPeriodS: 118_387, axialTilt: 0, satellites: 0, hasRings: false,
							},
						],
					},
					{
						name: 'Uranus',
						bodyType: 'planet',
						mass: '8.681 × 10²⁵ kg',
						massKg: 8.681e25,
						radius: '25,362 km',
						radiusM: 25_362_000,
						density: '1.270 g/cm³',
						surfaceGravity: '8.87 m/s²',
						temperatureK: 76,
						atmosphere: 'H₂ 82.5%, He 15.2%, CH₄ 2.3%',
						composition: 'Water, methane, ammonia ices (ice giant)',
						orbitalPeriod: '84.011 years',
						orbitalPeriodDays: 30_688.5,
						semiMajorAxisAu: 19.19,
						eccentricity: 0.0457,
						inclination: 0.772,
						rotationPeriod: '17h 14m 24s (retrograde)',
						rotationPeriodS: 62_064,
						axialTilt: 97.77,
						satellites: 28,
						hasRings: true,
					},
					{
						name: 'Neptune',
						bodyType: 'planet',
						mass: '1.024 × 10²⁶ kg',
						massKg: 1.024e26,
						radius: '24,622 km',
						radiusM: 24_622_000,
						density: '1.638 g/cm³',
						surfaceGravity: '11.15 m/s²',
						temperatureK: 72,
						atmosphere: 'H₂ 80%, He 19%, CH₄ 1.5%',
						composition: 'Water, methane, ammonia ices (ice giant)',
						orbitalPeriod: '164.8 years',
						orbitalPeriodDays: 60_182,
						semiMajorAxisAu: 30.07,
						eccentricity: 0.0113,
						inclination: 1.77,
						rotationPeriod: '16h 6m 36s',
						rotationPeriodS: 57_996,
						axialTilt: 28.32,
						satellites: 16,
						hasRings: true,
						moons: [
							{
								name: 'Triton', bodyType: 'planet', mass: '2.139 × 10²² kg', massKg: 2.139e22, radius: '1,353.4 km', radiusM: 1_353_400,
								density: '2.061 g/cm³', surfaceGravity: '0.779 m/s²', temperatureK: 38,
								atmosphere: 'N₂ (thin)', composition: 'Nitrogen ice, rock',
								orbitalPeriod: '5.877 days (retrograde)', orbitalPeriodDays: 5.877, semiMajorAxisAu: 0.00237,
								eccentricity: 0.000016, inclination: 156.885, rotationPeriod: '5.877 days (tidally locked)',
								rotationPeriodS: 507_773, axialTilt: 0, satellites: 0, hasRings: false,
							},
						],
					},
				],
			},
		],
	},
]
