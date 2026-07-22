<script lang="ts">
	import type { FieldMap } from './types.js'
	import { getField, getRemainingFields } from './types.js'
	import InfoboxShell from './InfoboxShell.svelte'
	import InfoboxRow from './InfoboxRow.svelte'
	import InfoboxSection from './InfoboxSection.svelte'

	let { fields }: { fields: FieldMap } = $props()

	const KNOWN_KEYS = new Set([
		'name', 'image', 'caption', 'image_size', 'body_type',
		'mass', 'radius', 'density', 'surface_gravity', 'escape_velocity',
		'temperature', 'age',
		'circumference', 'surface_area', 'volume',
		'composition', 'atmosphere', 'surface_pressure',
		'orbital_period', 'semi_major_axis', 'eccentricity', 'inclination',
		'periapsis', 'apoapsis', 'orbital_velocity',
		'satellite_of', 'satellite_of_slug', 'parent_star', 'parent_star_slug',
		'rotation_period', 'axial_tilt', 'equatorial_velocity',
		'apparent_magnitude', 'angular_diameter', 'albedo',
		'satellites', 'has_rings', 'description',
	])

	const title = $derived(getField(fields, 'name') ?? '')
	const image = $derived(getField(fields, 'image') ?? '')
	const imageCaption = $derived(getField(fields, 'caption') ?? '')
	const bodyType = $derived(getField(fields, 'body_type') ?? '')

	const mass = $derived(getField(fields, 'mass') ?? '')
	const radius = $derived(getField(fields, 'radius') ?? '')
	const density = $derived(getField(fields, 'density') ?? '')
	const surfaceGravity = $derived(getField(fields, 'surface_gravity') ?? '')
	const escapeVelocity = $derived(getField(fields, 'escape_velocity') ?? '')
	const temperature = $derived(getField(fields, 'temperature') ?? '')
	const age = $derived(getField(fields, 'age') ?? '')
	const circumference = $derived(getField(fields, 'circumference') ?? '')
	const surfaceArea = $derived(getField(fields, 'surface_area') ?? '')
	const volume = $derived(getField(fields, 'volume') ?? '')

	const composition = $derived(getField(fields, 'composition') ?? '')
	const atmosphere = $derived(getField(fields, 'atmosphere') ?? '')
	const surfacePressure = $derived(getField(fields, 'surface_pressure') ?? '')

	const satelliteOf = $derived(getField(fields, 'satellite_of') ?? '')
	const satelliteOfSlug = $derived(getField(fields, 'satellite_of_slug') ?? '')
	const orbitalPeriod = $derived(getField(fields, 'orbital_period') ?? '')
	const semiMajorAxis = $derived(getField(fields, 'semi_major_axis') ?? '')
	const eccentricity = $derived(getField(fields, 'eccentricity') ?? '')
	const inclination = $derived(getField(fields, 'inclination') ?? '')
	const periapsis = $derived(getField(fields, 'periapsis') ?? '')
	const apoapsis = $derived(getField(fields, 'apoapsis') ?? '')
	const orbitalVelocity = $derived(getField(fields, 'orbital_velocity') ?? '')

	const rotationPeriod = $derived(getField(fields, 'rotation_period') ?? '')
	const axialTilt = $derived(getField(fields, 'axial_tilt') ?? '')
	const equatorialVelocity = $derived(getField(fields, 'equatorial_velocity') ?? '')

	const apparentMagnitude = $derived(getField(fields, 'apparent_magnitude') ?? '')
	const angularDiameter = $derived(getField(fields, 'angular_diameter') ?? '')
	const albedo = $derived(getField(fields, 'albedo') ?? '')

	const satellites = $derived(getField(fields, 'satellites') ?? '')
	const hasRings = $derived(getField(fields, 'has_rings') ?? '')

	const hasComposition = $derived(composition || atmosphere || surfacePressure)
	const hasOrbital = $derived(satelliteOf || orbitalPeriod || semiMajorAxis || eccentricity || inclination || periapsis || apoapsis || orbitalVelocity)
	const hasRotation = $derived(rotationPeriod || axialTilt || equatorialVelocity)
	const hasObservation = $derived(apparentMagnitude || angularDiameter || albedo)
	const hasSystem = $derived(satellites || hasRings)

	const remaining = $derived(getRemainingFields(fields, KNOWN_KEYS))
</script>

<InfoboxShell {title} {image} {imageCaption}>
	{#if hasOrbital}
		<InfoboxSection title="Orbital characteristics" variant="raised">
		{#if satelliteOf}
			<InfoboxRow label="Satellite of" value={satelliteOfSlug ? `[[${satelliteOfSlug}|${satelliteOf}]]` : satelliteOf} />
		{/if}
		<InfoboxRow label="Orbital period" value={orbitalPeriod} />
		<InfoboxRow label="Semi-major axis" value={semiMajorAxis} />
		<InfoboxRow label="Eccentricity" value={eccentricity} />
		<InfoboxRow label="Periapsis" value={periapsis} />
		<InfoboxRow label="Apoapsis" value={apoapsis} />
		<InfoboxRow label="Orbital velocity" value={orbitalVelocity} />
		<InfoboxRow label="Inclination" value={inclination} />
		</InfoboxSection>
	{/if}

	<InfoboxSection title="Physical characteristics" variant="raised">
	<InfoboxRow label="Type" value={bodyType} />
	<InfoboxRow label="Mass" value={mass} />
	<InfoboxRow label="Radius" value={radius} />
	<InfoboxRow label="Circumference" value={circumference} />
	<InfoboxRow label="Surface area" value={surfaceArea} />
	<InfoboxRow label="Volume" value={volume} />
	<InfoboxRow label="Density" value={density} />
	<InfoboxRow label="Surface gravity" value={surfaceGravity} />
	<InfoboxRow label="Escape velocity" value={escapeVelocity} />
	<InfoboxRow label="Temperature" value={temperature} />
	<InfoboxRow label="Age" value={age} />
	</InfoboxSection>

	{#if hasComposition}
		<InfoboxSection title="Composition" variant="raised">
		<InfoboxRow label="Composition" value={composition} />
		<InfoboxRow label="Atmosphere" value={atmosphere} />
		<InfoboxRow label="Surface pressure" value={surfacePressure} />
		</InfoboxSection>
	{/if}

	{#if hasRotation}
		<InfoboxSection title="Rotation" variant="raised">
		<InfoboxRow label="Rotation period" value={rotationPeriod} />
		<InfoboxRow label="Axial tilt" value={axialTilt} />
		<InfoboxRow label="Equatorial velocity" value={equatorialVelocity} />
		</InfoboxSection>
	{/if}

	{#if hasObservation}
		<InfoboxSection title="Observation" variant="raised">
		<InfoboxRow label="Apparent magnitude" value={apparentMagnitude} />
		<InfoboxRow label="Angular diameter" value={angularDiameter} />
		<InfoboxRow label="Albedo" value={albedo} />
		</InfoboxSection>
	{/if}

	{#if hasSystem}
		<InfoboxSection title="System" variant="raised">
		<InfoboxRow label="Satellites" value={satellites} />
		{#if hasRings}
			<InfoboxRow label="Rings" value="Yes" />
		{/if}
		</InfoboxSection>
	{/if}

	{#if remaining.length > 0}
		<InfoboxSection>
			{#each remaining as [key, value] (key)}
				<InfoboxRow label={key} {value} />
			{/each}
		</InfoboxSection>
	{/if}
</InfoboxShell>
