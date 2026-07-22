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

	const title = $derived(getField(fields, 'name') ?? '')
	const image = $derived(getField(fields, 'image') ?? '')
	const imageCaption = $derived(getField(fields, 'caption') ?? '')

	const spectralType = $derived(getField(fields, 'spectral_type') ?? '')
	const mass = $derived(getField(fields, 'mass') ?? '')
	const radius = $derived(getField(fields, 'radius') ?? '')
	const density = $derived(getField(fields, 'density') ?? '')
	const surfaceGravity = $derived(getField(fields, 'surface_gravity') ?? '')
	const escapeVelocity = $derived(getField(fields, 'escape_velocity') ?? '')
	const luminosity = $derived(getField(fields, 'luminosity') ?? '')
	const luminosityVisual = $derived(getField(fields, 'luminosity_visual') ?? '')
	const temperature = $derived(getField(fields, 'temperature') ?? '')
	const age = $derived(getField(fields, 'age') ?? '')
	const color = $derived(getField(fields, 'color') ?? '')
	const metallicity = $derived(getField(fields, 'metallicity') ?? '')
	const habitableZone = $derived(getField(fields, 'habitable_zone') ?? '')

	const rotationPeriod = $derived(getField(fields, 'rotation_period') ?? '')
	const axialTilt = $derived(getField(fields, 'axial_tilt') ?? '')
	const equatorialVelocity = $derived(getField(fields, 'equatorial_velocity') ?? '')

	const orbitalPeriod = $derived(getField(fields, 'orbital_period') ?? '')
	const semiMajorAxis = $derived(getField(fields, 'orbital_semimajor', 'semi_major_axis') ?? '')
	const eccentricity = $derived(getField(fields, 'orbital_eccentricity', 'eccentricity') ?? '')
	const periastron = $derived(getField(fields, 'periastron') ?? '')
	const apastron = $derived(getField(fields, 'apastron') ?? '')

	const apparentMagnitude = $derived(getField(fields, 'apparent_magnitude') ?? '')
	const apparentMagnitudeBright = $derived(getField(fields, 'apparent_magnitude_bright') ?? '')
	const apparentMagnitudeDim = $derived(getField(fields, 'apparent_magnitude_dim') ?? '')
	const absoluteMagnitude = $derived(getField(fields, 'absolute_magnitude') ?? '')
	const angularDiameter = $derived(getField(fields, 'angular_diameter') ?? '')
	const angularDiameterMax = $derived(getField(fields, 'angular_diameter_max') ?? '')
	const angularDiameterMin = $derived(getField(fields, 'angular_diameter_min') ?? '')

	const meanDistance = $derived(getField(fields, 'mean_distance') ?? '')
	const companion = $derived(getField(fields, 'companion') ?? '')
	const companionOf = $derived(getField(fields, 'companion_of') ?? '')
	const companionOfSlug = $derived(getField(fields, 'companion_of_slug') ?? '')
	const planets = $derived(getField(fields, 'planets') ?? '')
	const knownSatellites = $derived(getField(fields, 'known_satellites') ?? '')

	const hasRotation = $derived(rotationPeriod || axialTilt || equatorialVelocity)
	const hasOrbital = $derived(orbitalPeriod || semiMajorAxis || eccentricity || periastron || apastron)
	const hasObservation = $derived(apparentMagnitude || apparentMagnitudeBright || absoluteMagnitude || angularDiameter || angularDiameterMax || meanDistance)
	const hasSystem = $derived(companion || companionOf || planets || knownSatellites)

	const remaining = $derived(getRemainingFields(fields, KNOWN_KEYS))
</script>

<InfoboxShell {title} {image} {imageCaption}>
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
