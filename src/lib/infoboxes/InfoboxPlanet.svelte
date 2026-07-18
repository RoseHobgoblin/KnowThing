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

	const image = getField(fields, 'image') ?? ''
	const imageCaption = getField(fields, 'caption') ?? ''
	const bodyType = getField(fields, 'body_type') ?? ''

	const mass = getField(fields, 'mass') ?? ''
	const radius = getField(fields, 'radius') ?? ''
	const density = getField(fields, 'density') ?? ''
	const surfaceGravity = getField(fields, 'surface_gravity') ?? ''
	const escapeVelocity = getField(fields, 'escape_velocity') ?? ''
	const temperature = getField(fields, 'temperature') ?? ''
	const age = getField(fields, 'age') ?? ''
	const circumference = getField(fields, 'circumference') ?? ''
	const surfaceArea = getField(fields, 'surface_area') ?? ''
	const volume = getField(fields, 'volume') ?? ''

	const composition = getField(fields, 'composition') ?? ''
	const atmosphere = getField(fields, 'atmosphere') ?? ''
	const surfacePressure = getField(fields, 'surface_pressure') ?? ''

	const satelliteOf = getField(fields, 'satellite_of') ?? ''
	const satelliteOfSlug = getField(fields, 'satellite_of_slug') ?? ''
	const orbitalPeriod = getField(fields, 'orbital_period') ?? ''
	const semiMajorAxis = getField(fields, 'semi_major_axis') ?? ''
	const eccentricity = getField(fields, 'eccentricity') ?? ''
	const inclination = getField(fields, 'inclination') ?? ''
	const periapsis = getField(fields, 'periapsis') ?? ''
	const apoapsis = getField(fields, 'apoapsis') ?? ''
	const orbitalVelocity = getField(fields, 'orbital_velocity') ?? ''

	const rotationPeriod = getField(fields, 'rotation_period') ?? ''
	const axialTilt = getField(fields, 'axial_tilt') ?? ''
	const equatorialVelocity = getField(fields, 'equatorial_velocity') ?? ''

	const apparentMagnitude = getField(fields, 'apparent_magnitude') ?? ''
	const angularDiameter = getField(fields, 'angular_diameter') ?? ''
	const albedo = getField(fields, 'albedo') ?? ''

	const satellites = getField(fields, 'satellites') ?? ''
	const hasRings = getField(fields, 'has_rings') ?? ''

	const hasComposition = composition || atmosphere || surfacePressure
	const hasOrbital = satelliteOf || orbitalPeriod || semiMajorAxis || eccentricity || inclination || periapsis || apoapsis || orbitalVelocity
	const hasRotation = rotationPeriod || axialTilt || equatorialVelocity
	const hasObservation = apparentMagnitude || angularDiameter || albedo
	const hasSystem = satellites || hasRings

	const remaining = getRemainingFields(fields, KNOWN_KEYS)
</script>

<InfoboxShell {image} {imageCaption}>
	{#if hasOrbital}
		<InfoboxSection title="Orbital characteristics">
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

	<InfoboxSection title="Physical characteristics">
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
		<InfoboxSection title="Composition">
		<InfoboxRow label="Composition" value={composition} />
		<InfoboxRow label="Atmosphere" value={atmosphere} />
		<InfoboxRow label="Surface pressure" value={surfacePressure} />
		</InfoboxSection>
	{/if}

	{#if hasRotation}
		<InfoboxSection title="Rotation">
		<InfoboxRow label="Rotation period" value={rotationPeriod} />
		<InfoboxRow label="Axial tilt" value={axialTilt} />
		<InfoboxRow label="Equatorial velocity" value={equatorialVelocity} />
		</InfoboxSection>
	{/if}

	{#if hasObservation}
		<InfoboxSection title="Observation">
		<InfoboxRow label="Apparent magnitude" value={apparentMagnitude} />
		<InfoboxRow label="Angular diameter" value={angularDiameter} />
		<InfoboxRow label="Albedo" value={albedo} />
		</InfoboxSection>
	{/if}

	{#if hasSystem}
		<InfoboxSection title="System">
		<InfoboxRow label="Satellites" value={satellites} />
		{#if hasRings}
			<InfoboxRow label="Rings" value="Yes" />
		{/if}
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
