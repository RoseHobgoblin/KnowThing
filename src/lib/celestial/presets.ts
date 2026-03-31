export interface CelestialPreset {
	label: string
	description: string
	system: {
		name: string
		systemType: string
	}
	stars: StarPreset[]
}

export interface StarPreset {
	name: string
	spectralType: string
	mass: string
	radius: string
	luminosity: string
	temperature: string
	age: string
	color: string
	apparentMagnitude: string
	bodies: BodyPreset[]
}

export interface BodyPreset {
	name: string
	bodyType: 'planet' | 'moon' | 'dwarf_planet' | 'asteroid'
	mass: string
	radius: string
	density: string
	surfaceGravity: string
	temperature: string
	atmosphere: string
	composition: string
	orbitalPeriod: string
	orbitalPeriodDays: number
	semiMajorAxisAu: number
	eccentricity: number
	inclination: number
	rotationPeriod: string
	rotationPeriodS: number
	axialTilt: number
	satellites: number
	hasRings: boolean
	moons?: BodyPreset[]
}

export const celestialPresets: CelestialPreset[] = [
	{
		label: 'Solar System',
		description: 'Our solar system with the Sun, 8 planets, and major moons.',
		system: { name: 'Solar System', systemType: 'single' },
		stars: [
			{
				name: 'The Sun',
				spectralType: 'G2V',
				mass: '1.989 × 10³⁰ kg (1.0 M☉)',
				radius: '696,340 km (1.0 R☉)',
				luminosity: '3.828 × 10²⁶ W (1.0 L☉)',
				temperature: '5,778 K',
				age: '~4.6 billion years',
				color: 'Yellow-white',
				apparentMagnitude: '−26.74',
				bodies: [
					{
						name: 'Mercury',
						bodyType: 'planet',
						mass: '3.301 × 10²³ kg',
						radius: '2,439.7 km',
						density: '5.427 g/cm³',
						surfaceGravity: '3.7 m/s²',
						temperature: '440 K (mean)',
						atmosphere: 'Trace (O₂, Na, H₂)',
						composition: 'Iron, silicates',
						orbitalPeriod: '87.97 days',
						orbitalPeriodDays: 87.969,
						semiMajorAxisAu: 0.387,
						eccentricity: 0.2056,
						inclination: 7.0,
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
						radius: '6,051.8 km',
						density: '5.243 g/cm³',
						surfaceGravity: '8.87 m/s²',
						temperature: '737 K (surface)',
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
						radius: '6,371.0 km',
						density: '5.514 g/cm³',
						surfaceGravity: '9.807 m/s²',
						temperature: '288 K (mean)',
						atmosphere: 'N₂ 78%, O₂ 21%, Ar 0.93%',
						composition: 'Iron, nickel, silicates',
						orbitalPeriod: '365.256 days',
						orbitalPeriodDays: 365.256,
						semiMajorAxisAu: 1.0,
						eccentricity: 0.0167,
						inclination: 0.0,
						rotationPeriod: '23h 56m 4s',
						rotationPeriodS: 86_164,
						axialTilt: 23.44,
						satellites: 1,
						hasRings: false,
						moons: [
							{
								name: 'Luna',
								bodyType: 'moon',
								mass: '7.342 × 10²² kg',
								radius: '1,737.4 km',
								density: '3.344 g/cm³',
								surfaceGravity: '1.62 m/s²',
								temperature: '250 K (mean)',
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
						bodyType: 'planet',
						mass: '6.417 × 10²³ kg',
						radius: '3,389.5 km',
						density: '3.934 g/cm³',
						surfaceGravity: '3.721 m/s²',
						temperature: '210 K (mean)',
						atmosphere: 'CO₂ 95.3%, N₂ 2.7%',
						composition: 'Iron oxide, silicates',
						orbitalPeriod: '687.0 days',
						orbitalPeriodDays: 686.98,
						semiMajorAxisAu: 1.524,
						eccentricity: 0.0934,
						inclination: 1.85,
						rotationPeriod: '24h 37m 22s',
						rotationPeriodS: 88_642,
						axialTilt: 25.19,
						satellites: 2,
						hasRings: false,
						moons: [
							{
								name: 'Phobos', bodyType: 'moon', mass: '1.066 × 10¹⁶ kg', radius: '11.267 km',
								density: '1.876 g/cm³', surfaceGravity: '0.0057 m/s²', temperature: '233 K',
								atmosphere: '', composition: 'Carbon chondrite',
								orbitalPeriod: '0.319 days', orbitalPeriodDays: 0.3189, semiMajorAxisAu: 0.0000628,
								eccentricity: 0.0151, inclination: 1.093, rotationPeriod: '0.319 days (tidally locked)',
								rotationPeriodS: 27_554, axialTilt: 0, satellites: 0, hasRings: false,
							},
							{
								name: 'Deimos', bodyType: 'moon', mass: '1.476 × 10¹⁵ kg', radius: '6.2 km',
								density: '1.471 g/cm³', surfaceGravity: '0.003 m/s²', temperature: '233 K',
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
						radius: '69,911 km',
						density: '1.326 g/cm³',
						surfaceGravity: '24.79 m/s²',
						temperature: '165 K (cloud top)',
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
								name: 'Io', bodyType: 'moon', mass: '8.932 × 10²² kg', radius: '1,821.6 km',
								density: '3.528 g/cm³', surfaceGravity: '1.796 m/s²', temperature: '110 K',
								atmosphere: 'SO₂ (thin)', composition: 'Silicates, sulfur',
								orbitalPeriod: '1.769 days', orbitalPeriodDays: 1.7691, semiMajorAxisAu: 0.00282,
								eccentricity: 0.0041, inclination: 0.05, rotationPeriod: '1.769 days (tidally locked)',
								rotationPeriodS: 152_853, axialTilt: 0, satellites: 0, hasRings: false,
							},
							{
								name: 'Europa', bodyType: 'moon', mass: '4.800 × 10²² kg', radius: '1,560.8 km',
								density: '3.013 g/cm³', surfaceGravity: '1.315 m/s²', temperature: '102 K',
								atmosphere: 'O₂ (thin)', composition: 'Ice, silicates, subsurface ocean',
								orbitalPeriod: '3.551 days', orbitalPeriodDays: 3.5512, semiMajorAxisAu: 0.00449,
								eccentricity: 0.009, inclination: 0.47, rotationPeriod: '3.551 days (tidally locked)',
								rotationPeriodS: 306_823, axialTilt: 0.1, satellites: 0, hasRings: false,
							},
							{
								name: 'Ganymede', bodyType: 'moon', mass: '1.482 × 10²³ kg', radius: '2,634.1 km',
								density: '1.936 g/cm³', surfaceGravity: '1.428 m/s²', temperature: '110 K',
								atmosphere: 'O₂ (thin)', composition: 'Ice, silicates',
								orbitalPeriod: '7.155 days', orbitalPeriodDays: 7.1546, semiMajorAxisAu: 0.00716,
								eccentricity: 0.0013, inclination: 0.2, rotationPeriod: '7.155 days (tidally locked)',
								rotationPeriodS: 618_153, axialTilt: 0.33, satellites: 0, hasRings: false,
							},
							{
								name: 'Callisto', bodyType: 'moon', mass: '1.076 × 10²³ kg', radius: '2,410.3 km',
								density: '1.834 g/cm³', surfaceGravity: '1.235 m/s²', temperature: '134 K',
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
						radius: '58,232 km',
						density: '0.687 g/cm³',
						surfaceGravity: '10.44 m/s²',
						temperature: '134 K (cloud top)',
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
								name: 'Titan', bodyType: 'moon', mass: '1.345 × 10²³ kg', radius: '2,574.7 km',
								density: '1.882 g/cm³', surfaceGravity: '1.352 m/s²', temperature: '94 K',
								atmosphere: 'N₂ 98.4%, CH₄ 1.4%', composition: 'Ice, rock, hydrocarbon lakes',
								orbitalPeriod: '15.945 days', orbitalPeriodDays: 15.945, semiMajorAxisAu: 0.00817,
								eccentricity: 0.0288, inclination: 0.349, rotationPeriod: '15.945 days (tidally locked)',
								rotationPeriodS: 1_377_648, axialTilt: 0, satellites: 0, hasRings: false,
							},
							{
								name: 'Enceladus', bodyType: 'moon', mass: '1.080 × 10²⁰ kg', radius: '252.1 km',
								density: '1.609 g/cm³', surfaceGravity: '0.113 m/s²', temperature: '75 K',
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
						radius: '25,362 km',
						density: '1.270 g/cm³',
						surfaceGravity: '8.87 m/s²',
						temperature: '76 K (cloud top)',
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
						radius: '24,622 km',
						density: '1.638 g/cm³',
						surfaceGravity: '11.15 m/s²',
						temperature: '72 K (cloud top)',
						atmosphere: 'H₂ 80%, He 19%, CH₄ 1.5%',
						composition: 'Water, methane, ammonia ices (ice giant)',
						orbitalPeriod: '164.8 years',
						orbitalPeriodDays: 60_182,
						semiMajorAxisAu: 30.07,
						eccentricity: 0.0113,
						inclination: 1.770,
						rotationPeriod: '16h 6m 36s',
						rotationPeriodS: 57_996,
						axialTilt: 28.32,
						satellites: 16,
						hasRings: true,
						moons: [
							{
								name: 'Triton', bodyType: 'moon', mass: '2.139 × 10²² kg', radius: '1,353.4 km',
								density: '2.061 g/cm³', surfaceGravity: '0.779 m/s²', temperature: '38 K',
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
