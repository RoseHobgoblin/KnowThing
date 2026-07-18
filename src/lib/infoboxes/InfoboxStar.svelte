<script lang="ts">
	import type { FieldMap } from './types.js'
	import { getField, getRemainingFields } from './types.js'
	import InfoboxShell from './InfoboxShell.svelte'
	import InfoboxRow from './InfoboxRow.svelte'
	import InfoboxSection from './InfoboxSection.svelte'

	let { fields }: { fields: FieldMap } = $props()

	const KNOWN_KEYS = new Set([
		'name', 'image', 'caption', 'image_size',
		'spectral_type', 'mass', 'radius', 'density', 'surface_gravity', 'escape_velocity',
		'luminosity', 'luminosity_visual',
		'temperature', 'age', 'color', 'metallicity',
		'habitable_zone',
		'rotation_period', 'axial_tilt', 'equatorial_velocity',
		'orbital_period', 'orbital_semimajor', 'semi_major_axis', 'eccentricity',
		'orbital_eccentricity', 'periastron', 'apastron',
		'apparent_magnitude', 'apparent_magnitude_bright', 'apparent_magnitude_dim',
		'absolute_magnitude',
		'angular_diameter', 'angular_diameter_max', 'angular_diameter_min',
		'mean_distance', 'companion', 'companion_of', 'companion_of_slug',
		'planets', 'known_satellites',
		'description', 'from',
	])

	const image = getField(fields, 'image') ?? ''
	const imageCaption = getField(fields, 'caption') ?? ''

	const spectralType = getField(fields, 'spectral_type') ?? ''
	const mass = getField(fields, 'mass') ?? ''
	const radius = getField(fields, 'radius') ?? ''
	const density = getField(fields, 'density') ?? ''
	const surfaceGravity = getField(fields, 'surface_gravity') ?? ''
	const escapeVelocity = getField(fields, 'escape_velocity') ?? ''
	const luminosity = getField(fields, 'luminosity') ?? ''
	const luminosityVisual = getField(fields, 'luminosity_visual') ?? ''
	const temperature = getField(fields, 'temperature') ?? ''
	const age = getField(fields, 'age') ?? ''
	const color = getField(fields, 'color') ?? ''
	const metallicity = getField(fields, 'metallicity') ?? ''
	const habitableZone = getField(fields, 'habitable_zone') ?? ''

	const rotationPeriod = getField(fields, 'rotation_period') ?? ''
	const axialTilt = getField(fields, 'axial_tilt') ?? ''
	const equatorialVelocity = getField(fields, 'equatorial_velocity') ?? ''

	const orbitalPeriod = getField(fields, 'orbital_period') ?? ''
	const semiMajorAxis = getField(fields, 'orbital_semimajor', 'semi_major_axis') ?? ''
	const eccentricity = getField(fields, 'orbital_eccentricity', 'eccentricity') ?? ''
	const periastron = getField(fields, 'periastron') ?? ''
	const apastron = getField(fields, 'apastron') ?? ''

	const apparentMagnitude = getField(fields, 'apparent_magnitude') ?? ''
	const apparentMagnitudeBright = getField(fields, 'apparent_magnitude_bright') ?? ''
	const apparentMagnitudeDim = getField(fields, 'apparent_magnitude_dim') ?? ''
	const absoluteMagnitude = getField(fields, 'absolute_magnitude') ?? ''
	const angularDiameter = getField(fields, 'angular_diameter') ?? ''
	const angularDiameterMax = getField(fields, 'angular_diameter_max') ?? ''
	const angularDiameterMin = getField(fields, 'angular_diameter_min') ?? ''

	const meanDistance = getField(fields, 'mean_distance') ?? ''
	const companion = getField(fields, 'companion') ?? ''
	const companionOf = getField(fields, 'companion_of') ?? ''
	const companionOfSlug = getField(fields, 'companion_of_slug') ?? ''
	const planets = getField(fields, 'planets') ?? ''
	const knownSatellites = getField(fields, 'known_satellites') ?? ''

	const hasRotation = rotationPeriod || axialTilt || equatorialVelocity
	const hasOrbital = orbitalPeriod || semiMajorAxis || eccentricity || periastron || apastron
	const hasObservation = apparentMagnitude || apparentMagnitudeBright || absoluteMagnitude || angularDiameter || angularDiameterMax || meanDistance
	const hasSystem = companion || companionOf || planets || knownSatellites

	const remaining = getRemainingFields(fields, KNOWN_KEYS)
</script>

<InfoboxShell {image} {imageCaption}>
	<InfoboxSection title="Stellar properties">
	<InfoboxRow label="Spectral type" value={spectralType} />
	<InfoboxRow label="Mass" value={mass} />
	<InfoboxRow label="Radius" value={radius} />
	<InfoboxRow label="Density" value={density} />
	<InfoboxRow label="Surface gravity" value={surfaceGravity} />
	<InfoboxRow label="Escape velocity" value={escapeVelocity} />
	<InfoboxRow label="Luminosity" value={luminosity} />
	{#if luminosityVisual}
		<InfoboxRow label="Luminosity (visual)" value={luminosityVisual} />
	{/if}
	<InfoboxRow label="Temperature" value={temperature} />
	<InfoboxRow label="Metallicity" value={metallicity} />
	<InfoboxRow label="Age" value={age} />
	<InfoboxRow label="Color" value={color} />
	<InfoboxRow label="Habitable zone" value={habitableZone} />
	</InfoboxSection>

	{#if hasRotation}
		<InfoboxSection title="Rotation">
		<InfoboxRow label="Rotation period" value={rotationPeriod} />
		<InfoboxRow label="Equatorial velocity" value={equatorialVelocity} />
		<InfoboxRow label="Axial tilt" value={axialTilt} />
		</InfoboxSection>
	{/if}

	{#if hasOrbital}
		<InfoboxSection title="Orbit">
		<InfoboxRow label="Orbital period" value={orbitalPeriod} />
		<InfoboxRow label="Semi-major axis" value={semiMajorAxis} />
		<InfoboxRow label="Eccentricity" value={eccentricity} />
		<InfoboxRow label="Periastron" value={periastron} />
		<InfoboxRow label="Apastron" value={apastron} />
		</InfoboxSection>
	{/if}

	{#if hasObservation}
		<InfoboxSection title="Observation">
		{#if apparentMagnitude}
			<InfoboxRow label="Apparent magnitude" value={apparentMagnitude} />
		{/if}
		{#if apparentMagnitudeBright}
			<InfoboxRow label="Apparent mag. (bright)" value={apparentMagnitudeBright} />
		{/if}
		{#if apparentMagnitudeDim}
			<InfoboxRow label="Apparent mag. (dim)" value={apparentMagnitudeDim} />
		{/if}
		<InfoboxRow label="Absolute magnitude" value={absoluteMagnitude} />
		<InfoboxRow label="Mean distance" value={meanDistance} />
		{#if angularDiameter}
			<InfoboxRow label="Angular diameter" value={angularDiameter} />
		{/if}
		{#if angularDiameterMax}
			<InfoboxRow label="Angular diameter (max)" value={angularDiameterMax} />
		{/if}
		{#if angularDiameterMin}
			<InfoboxRow label="Angular diameter (min)" value={angularDiameterMin} />
		{/if}
		</InfoboxSection>
	{/if}

	{#if hasSystem}
		<InfoboxSection title="System">
		{#if companionOf}
			<InfoboxRow label="Companion of" value={companionOfSlug ? `[[${companionOfSlug}|${companionOf}]]` : companionOf} />
		{/if}
		<InfoboxRow label="Companion" value={companion} />
		<InfoboxRow label="Planets" value={planets} />
		<InfoboxRow label="Known satellites" value={knownSatellites} />
		</InfoboxSection>
	{/if}

	{#if remaining.length > 0}
		<InfoboxSection>
			{#each remaining as [key, value]}
				<InfoboxRow label={key} {value} />
			{/each}
		</InfoboxSection>
	{/if}
</InfoboxShell>
