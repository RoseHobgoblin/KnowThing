<script lang="ts">
	import type { FieldMap } from './types.js'
	import { getField, getRemainingFields } from './types.js'
	import InfoboxShell from './InfoboxShell.svelte'
	import InfoboxRow from './InfoboxRow.svelte'
	import InfoboxSection from './InfoboxSection.svelte'

	let { fields }: { fields: FieldMap } = $props()

	const KNOWN_KEYS = new Set([
		'name', 'image', 'caption', 'image_size',
		'spectral_type', 'mass', 'radius', 'luminosity', 'luminosity_visual',
		'temperature', 'age', 'color',
		'orbital_period', 'orbital_semimajor', 'semi_major_axis', 'eccentricity',
		'orbital_eccentricity', 'periastron', 'apastron',
		'apparent_magnitude', 'angular_diameter',
		'mean_distance', 'companion', 'description',
	])

	const title = getField(fields, 'name') ?? ''
	const image = getField(fields, 'image') ?? ''
	const imageCaption = getField(fields, 'caption') ?? ''

	const spectralType = getField(fields, 'spectral_type') ?? ''
	const mass = getField(fields, 'mass') ?? ''
	const radius = getField(fields, 'radius') ?? ''
	const luminosity = getField(fields, 'luminosity') ?? ''
	const luminosityVisual = getField(fields, 'luminosity_visual') ?? ''
	const temperature = getField(fields, 'temperature') ?? ''
	const age = getField(fields, 'age') ?? ''
	const color = getField(fields, 'color') ?? ''

	const orbitalPeriod = getField(fields, 'orbital_period') ?? ''
	const semiMajorAxis = getField(fields, 'orbital_semimajor', 'semi_major_axis') ?? ''
	const eccentricity = getField(fields, 'orbital_eccentricity', 'eccentricity') ?? ''
	const periastron = getField(fields, 'periastron') ?? ''
	const apastron = getField(fields, 'apastron') ?? ''

	const apparentMagnitude = getField(fields, 'apparent_magnitude') ?? ''
	const meanDistance = getField(fields, 'mean_distance') ?? ''
	const angularDiameter = getField(fields, 'angular_diameter') ?? ''
	const companion = getField(fields, 'companion') ?? ''

	const hasOrbital = orbitalPeriod || semiMajorAxis || eccentricity || periastron || apastron
	const hasObservation = apparentMagnitude || angularDiameter || meanDistance

	const remaining = getRemainingFields(fields, KNOWN_KEYS)
</script>

<InfoboxShell
	{title}
	subtitle={spectralType}
	{image}
	{imageCaption}
>
	<InfoboxSection title="Stellar properties" />
	<InfoboxRow label="Spectral type" value={spectralType} />
	<InfoboxRow label="Mass" value={mass} />
	<InfoboxRow label="Radius" value={radius} />
	<InfoboxRow label="Luminosity" value={luminosity} />
	{#if luminosityVisual}
		<InfoboxRow label="Luminosity (visual)" value={luminosityVisual} />
	{/if}
	<InfoboxRow label="Temperature" value={temperature} />
	<InfoboxRow label="Age" value={age} />
	<InfoboxRow label="Color" value={color} />

	{#if hasOrbital}
		<InfoboxSection title="Orbit" />
		<InfoboxRow label="Orbital period" value={orbitalPeriod} />
		<InfoboxRow label="Semi-major axis" value={semiMajorAxis} />
		<InfoboxRow label="Eccentricity" value={eccentricity} />
		<InfoboxRow label="Periastron" value={periastron} />
		<InfoboxRow label="Apastron" value={apastron} />
	{/if}

	{#if hasObservation}
		<InfoboxSection title="Observation" />
		<InfoboxRow label="Apparent magnitude" value={apparentMagnitude} />
		<InfoboxRow label="Mean distance" value={meanDistance} />
		<InfoboxRow label="Angular diameter" value={angularDiameter} />
	{/if}

	{#if companion}
		<InfoboxSection title="System" />
		<InfoboxRow label="Companion" value={companion} />
	{/if}

	{#each remaining as [key, value]}
		<InfoboxRow label={key} {value} />
	{/each}
</InfoboxShell>
