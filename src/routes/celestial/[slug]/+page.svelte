<script lang="ts">
	import type { PageData } from './$types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'

	let { data }: { data: PageData } = $props()

	const isStar = data.kind === 'star'
	const isAdmin = data.isAdmin
	const raw = data.body as any

	// Shared fields
	let name = $state(raw.name ?? '')
	let pageSlug = $state(raw.pageSlug ?? '')
	let description = $state(raw.description ?? '')

	// Star fields
	let spectralType = $state(raw.spectralType ?? raw.spectral_type ?? '')
	let mass = $state(raw.mass ?? '')
	let radius = $state(raw.radius ?? '')
	let luminosity = $state(raw.luminosity ?? '')
	let luminosityVisual = $state(raw.luminosityVisual ?? raw.luminosity_visual ?? '')
	let temperature = $state(raw.temperature ?? '')
	let age = $state(raw.age ?? '')
	let color = $state(raw.color ?? '')
	let orbitalPeriod = $state(raw.orbitalPeriod ?? raw.orbital_period ?? '')
	let semiMajorAxis = $state(raw.semiMajorAxis ?? raw.semi_major_axis ?? '')
	let semiMajorAxisAu = $state(raw.semiMajorAxisAu ?? raw.semi_major_axis_au ?? '')
	let eccentricity = $state(raw.eccentricity ?? '')
	let periastron = $state(raw.periastron ?? '')
	let apastron = $state(raw.apastron ?? '')
	let apparentMagnitude = $state(raw.apparentMagnitude ?? raw.apparent_magnitude ?? '')
	let angularDiameter = $state(raw.angularDiameter ?? raw.angular_diameter ?? '')
	let companion = $state(raw.companion ?? '')

	// Planet-specific fields
	let density = $state(raw.density ?? '')
	let surfaceGravity = $state(raw.surfaceGravity ?? raw.surface_gravity ?? '')
	let escapeVelocity = $state(raw.escapeVelocity ?? raw.escape_velocity ?? '')
	let composition = $state(raw.composition ?? '')
	let atmosphere = $state(raw.atmosphere ?? '')
	let surfacePressure = $state(raw.surfacePressure ?? raw.surface_pressure ?? '')
	let orbitalPeriodDays = $state(raw.orbitalPeriodDays ?? raw.orbital_period_days ?? '')
	let rotationPeriod = $state(raw.rotationPeriod ?? raw.rotation_period ?? '')
	let rotationPeriodS = $state(raw.rotationPeriodS ?? raw.rotation_period_s ?? '')
	let axialTilt = $state(raw.axialTilt ?? raw.axial_tilt ?? '')
	let inclination = $state(raw.inclination ?? '')
	let albedo = $state(raw.albedo ?? '')
	let satellites = $state(raw.satellites ?? '')
	let hasRings = $state(raw.hasRings ?? raw.has_rings ?? false)
	let bodyType = $state(raw.bodyType ?? raw.body_type ?? 'planet')
	let starId = $state(raw.starId ?? raw.star_id ?? null)
	let parentId = $state(raw.parentId ?? raw.parent_id ?? null)

	// Extra fields (JSONB overflow)
	let extraJson = $state(JSON.stringify(raw.extra ?? {}, null, 2))

	let saving = $state(false)

	function parseNum(v: string | number | null): number | null {
		if (v === '' || v == null) return null
		const n = Number(v)
		return Number.isNaN(n) ? null : n
	}

	async function save() {
		saving = true
		try {
			let extra = {}
			try { extra = JSON.parse(extraJson) } catch { /* keep empty */ }

			const endpoint = isStar
				? `/api/stars/${raw.slug}`
				: `/api/planetary-bodies/${raw.slug}`

			const payload = isStar
				? {
					name, pageSlug: pageSlug || null, description,
					spectralType: spectralType || null, mass: mass || null, radius: radius || null,
					luminosity: luminosity || null, luminosityVisual: luminosityVisual || null,
					temperature: temperature || null, age: age || null, color: color || null,
					orbitalPeriod: orbitalPeriod || null, semiMajorAxis: semiMajorAxis || null,
					semiMajorAxisAu: parseNum(semiMajorAxisAu), eccentricity: parseNum(eccentricity),
					periastron: periastron || null, apastron: apastron || null,
					apparentMagnitude: apparentMagnitude || null, angularDiameter: angularDiameter || null,
					companion: companion || null, extra,
				}
				: {
					name, bodyType, starId, parentId: parentId || null,
					pageSlug: pageSlug || null, description,
					mass: mass || null, radius: radius || null, density: density || null,
					surfaceGravity: surfaceGravity || null, escapeVelocity: escapeVelocity || null,
					temperature: temperature || null, age: age || null,
					composition: composition || null, atmosphere: atmosphere || null,
					surfacePressure: surfacePressure || null,
					orbitalPeriod: orbitalPeriod || null, orbitalPeriodDays: parseNum(orbitalPeriodDays),
					semiMajorAxis: semiMajorAxis || null, semiMajorAxisAu: parseNum(semiMajorAxisAu),
					eccentricity: parseNum(eccentricity), inclination: parseNum(inclination),
					rotationPeriod: rotationPeriod || null, rotationPeriodS: parseNum(rotationPeriodS),
					axialTilt: parseNum(axialTilt),
					apparentMagnitude: apparentMagnitude || null, angularDiameter: angularDiameter || null,
					albedo: albedo || null,
					satellites: parseNum(satellites), hasRings, extra,
				}

			const res = await fetch(endpoint, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})

			if (res.ok) pushSuccess('Saved')
			else pushError('Failed to save')
		} finally {
			saving = false
		}
	}
</script>

<svelte:head>
	<title>Edit {name} — Celestial — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<a href="/celestial" class="text-xs text-faint hover:text-link">← Back to registry</a>
			<h1 class="text-xl font-bold text-heading">{name || 'Untitled'}</h1>
			<p class="text-xs text-faint mt-0.5">{isStar ? 'Star' : bodyType} · {raw.slug}</p>
		</div>
		{#if isAdmin}
			<button onclick={save} disabled={saving} class="px-5 py-2 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50">
				{saving ? 'Saving...' : 'Save changes'}
			</button>
		{/if}
	</div>

	<!-- Identity -->
	<section class="bg-surface border border-border p-5 space-y-4">
		<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Identity</h2>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<Input label="Name" bind:value={name} required />
			<Input label="Wiki page slug" bind:value={pageSlug} placeholder="e.g. Therne" />
		</div>
		<Input label="Description" bind:value={description} placeholder="Short description" />
	</section>

	{#if isStar}
		<!-- Stellar properties -->
		<section class="bg-surface border border-border p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Stellar Properties</h2>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
				<Input label="Spectral type" bind:value={spectralType} placeholder="G2V" />
				<Input label="Mass" bind:value={mass} placeholder="1.0 M☉" />
				<Input label="Radius" bind:value={radius} placeholder="1.0 R☉" />
				<Input label="Luminosity" bind:value={luminosity} placeholder="1.0 L☉" />
				<Input label="Luminosity (visual)" bind:value={luminosityVisual} placeholder="V-band" />
				<Input label="Temperature" bind:value={temperature} placeholder="5,778 K" />
				<Input label="Age" bind:value={age} placeholder="~4.6 billion years" />
				<Input label="Color" bind:value={color} placeholder="Yellow-white" />
			</div>
		</section>

		<!-- Orbital (binary) -->
		<section class="bg-surface border border-border p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Orbital Properties</h2>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
				<Input label="Orbital period" bind:value={orbitalPeriod} placeholder="140.9 years" />
				<Input label="Semi-major axis" bind:value={semiMajorAxis} placeholder="30 AU" />
				<Input label="Semi-major axis (AU)" bind:value={semiMajorAxisAu} type="number" placeholder="Numeric, for rendering" />
				<Input label="Eccentricity" bind:value={eccentricity} type="number" placeholder="0-1" />
				<Input label="Periastron" bind:value={periastron} placeholder="21.0 AU" />
				<Input label="Apastron" bind:value={apastron} placeholder="39.0 AU" />
			</div>
		</section>

		<!-- Observation -->
		<section class="bg-surface border border-border p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Observation</h2>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
				<Input label="Apparent magnitude" bind:value={apparentMagnitude} placeholder="−26.7" />
				<Input label="Angular diameter" bind:value={angularDiameter} placeholder="31.4 arcmin" />
				<Input label="Companion" bind:value={companion} placeholder="[[Therne]] (M3V, 30 AU)" />
			</div>
		</section>
	{:else}
		<!-- Planet identity -->
		<section class="bg-surface border border-border p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Classification</h2>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
				<div>
					<span class="text-xs font-medium text-secondary block mb-1">Body type</span>
					<select bind:value={bodyType} class="w-full px-2 py-2 text-sm border border-border-strong bg-surface text-body outline-none transition-colors hover:border-border focus:ring-2 focus:ring-accent">
						<option value="planet">Planet</option>
						<option value="moon">Moon</option>
						<option value="dwarf_planet">Dwarf planet</option>
						<option value="asteroid">Asteroid</option>
						<option value="ring_system">Ring system</option>
					</select>
				</div>
				{#if 'allStars' in data}
					<div>
						<span class="text-xs font-medium text-secondary block mb-1">Parent star</span>
						<select bind:value={starId} class="w-full px-2 py-2 text-sm border border-border-strong bg-surface text-body outline-none transition-colors hover:border-border focus:ring-2 focus:ring-accent">
							<option value={null}>None</option>
							{#each data.allStars as s (s.id)}
								<option value={s.id}>{s.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<span class="text-xs font-medium text-secondary block mb-1">Parent body (for moons)</span>
						<select bind:value={parentId} class="w-full px-2 py-2 text-sm border border-border-strong bg-surface text-body outline-none transition-colors hover:border-border focus:ring-2 focus:ring-accent">
							<option value={null}>None</option>
							{#each data.siblings as sib (sib.id)}
								{#if sib.id !== raw.id}
									<option value={sib.id}>{sib.name}</option>
								{/if}
							{/each}
						</select>
					</div>
				{/if}
			</div>
		</section>

		<!-- Physical -->
		<section class="bg-surface border border-border p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Physical Characteristics</h2>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
				<Input label="Mass" bind:value={mass} placeholder="5.97×10²⁴ kg" />
				<Input label="Radius" bind:value={radius} placeholder="6,371 km" />
				<Input label="Density" bind:value={density} placeholder="5.51 g/cm³" />
				<Input label="Surface gravity" bind:value={surfaceGravity} placeholder="9.81 m/s²" />
				<Input label="Escape velocity" bind:value={escapeVelocity} placeholder="11.2 km/s" />
				<Input label="Temperature" bind:value={temperature} placeholder="288 K" />
				<Input label="Age" bind:value={age} />
			</div>
		</section>

		<!-- Composition -->
		<section class="bg-surface border border-border p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Composition & Atmosphere</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<Input label="Composition" bind:value={composition} placeholder="Iron-nickel core, silicate mantle..." />
				<Input label="Atmosphere" bind:value={atmosphere} placeholder="78% nitrogen, 21% oxygen..." />
				<Input label="Surface pressure" bind:value={surfacePressure} placeholder="101.3 kPa" />
			</div>
		</section>

		<!-- Orbital -->
		<section class="bg-surface border border-border p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Orbital Properties</h2>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
				<Input label="Orbital period" bind:value={orbitalPeriod} placeholder="365.25 days" />
				<Input label="Orbital period (days)" bind:value={orbitalPeriodDays} type="number" placeholder="Numeric, for calendar" />
				<Input label="Semi-major axis" bind:value={semiMajorAxis} placeholder="1.02 AU" />
				<Input label="Semi-major axis (AU)" bind:value={semiMajorAxisAu} type="number" placeholder="Numeric, for rendering" />
				<Input label="Eccentricity" bind:value={eccentricity} type="number" placeholder="0-1" />
				<Input label="Inclination (°)" bind:value={inclination} type="number" />
			</div>
		</section>

		<!-- Rotation -->
		<section class="bg-surface border border-border p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Rotation</h2>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
				<Input label="Rotation period" bind:value={rotationPeriod} placeholder="24h" />
				<Input label="Rotation period (seconds)" bind:value={rotationPeriodS} type="number" placeholder="86400 — feeds calendar day_length" />
				<Input label="Axial tilt (°)" bind:value={axialTilt} type="number" />
			</div>
		</section>

		<!-- Observation -->
		<section class="bg-surface border border-border p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Observation & System</h2>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
				<Input label="Apparent magnitude" bind:value={apparentMagnitude} />
				<Input label="Angular diameter" bind:value={angularDiameter} />
				<Input label="Albedo" bind:value={albedo} />
				<Input label="Satellites" bind:value={satellites} type="number" />
				<label class="flex items-center gap-2 text-sm text-secondary self-end cursor-pointer">
					<input type="checkbox" bind:checked={hasRings} class="accent-accent" />
					Has rings
				</label>
			</div>
		</section>
	{/if}

	<!-- Extra fields -->
	<section class="bg-surface border border-border p-5 space-y-4">
		<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Extra Fields (JSON)</h2>
		<p class="text-xs text-faint">Overflow fields not captured above. These are merged into the infobox.</p>
		<textarea bind:value={extraJson} rows={4} class="w-full px-3 py-2 text-sm font-mono bg-page border border-border-strong text-body outline-none focus:ring-2 focus:ring-accent"></textarea>
	</section>
</div>
