<script lang="ts">
	import type { PageData } from './$types.js'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import { page } from '$app/stores'
	import InfoboxStar from '$lib/infoboxes/InfoboxStar.svelte'
	import InfoboxPlanet from '$lib/infoboxes/InfoboxPlanet.svelte'
	import InfoboxSystem from '$lib/infoboxes/InfoboxSystem.svelte'
	import { buildFieldMap } from '$lib/infoboxes/types.js'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'

	let { data }: { data: PageData } = $props()

	const kind = data.kind
	const isAdmin = data.isAdmin
	const raw = data.body as any
	const ast = data.ast as import('$lib/parser/types.js').WikiNode | null

	const layoutData = $derived($page.data)

	createKnowContext({
		existingPages: new Set(layoutData.existingPages || []),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: layoutData.calendarDate ?? null,
	})

	// Build a FieldMap from the structured data for the infobox
	function buildStarFields(body: any): Map<string, string> {
		const fields = new Map<string, string>()
		const set = (k: string, v: unknown) => { if (v != null && v !== '') fields.set(k, String(v)) }
		set('name', body.name)
		set('spectral_type', body.spectralType ?? body.spectral_type)
		set('mass', body.mass)
		set('radius', body.radius)
		set('luminosity', body.luminosity)
		set('luminosity_visual', body.luminosityVisual ?? body.luminosity_visual)
		set('temperature', body.temperature)
		set('age', body.age)
		set('color', body.color)
		set('orbital_period', body.orbitalPeriod ?? body.orbital_period)
		set('orbital_semimajor', body.semiMajorAxis ?? body.semi_major_axis)
		set('orbital_eccentricity', body.eccentricity)
		set('periastron', body.periastron)
		set('apastron', body.apastron)
		set('apparent_magnitude', body.apparentMagnitude ?? body.apparent_magnitude)
		set('angular_diameter', body.angularDiameter ?? body.angular_diameter)
		set('companion', body.companion)
		// Merge extra JSONB
		const extra = body.extra as Record<string, unknown> | undefined
		if (extra) {
			for (const [k, v] of Object.entries(extra)) {
				if (v != null && v !== '') fields.set(k, String(v))
			}
		}
		return fields
	}

	function buildPlanetFields(body: any): Map<string, string> {
		const fields = new Map<string, string>()
		const set = (k: string, v: unknown) => { if (v != null && v !== '') fields.set(k, String(v)) }
		set('name', body.name)
		set('body_type', body.bodyType ?? body.body_type)
		set('mass', body.mass)
		set('radius', body.radius)
		set('density', body.density)
		set('surface_gravity', body.surfaceGravity ?? body.surface_gravity)
		set('escape_velocity', body.escapeVelocity ?? body.escape_velocity)
		set('temperature', body.temperature)
		set('age', body.age)
		set('composition', body.composition)
		set('atmosphere', body.atmosphere)
		set('surface_pressure', body.surfacePressure ?? body.surface_pressure)
		set('orbital_period', body.orbitalPeriod ?? body.orbital_period)
		set('semi_major_axis', body.semiMajorAxis ?? body.semi_major_axis)
		set('eccentricity', body.eccentricity)
		set('rotation_period', body.rotationPeriod ?? body.rotation_period)
		set('axial_tilt', body.axialTilt ?? body.axial_tilt)
		set('apparent_magnitude', body.apparentMagnitude ?? body.apparent_magnitude)
		set('angular_diameter', body.angularDiameter ?? body.angular_diameter)
		set('albedo', body.albedo)
		set('satellites', body.satellites)
		if (body.hasRings || body.has_rings) set('has_rings', 'yes')
		const extra = body.extra as Record<string, unknown> | undefined
		if (extra) {
			for (const [k, v] of Object.entries(extra)) {
				if (v != null && v !== '') fields.set(k, String(v))
			}
		}
		return fields
	}

	function buildSystemFields(body: any): Map<string, string> {
		const fields = new Map<string, string>()
		fields.set('name', body.name ?? '')
		fields.set('system_type', body.systemType ?? body.system_type ?? '')
		return fields
	}

	const editPath = $derived(`/dashboard/celestial/${raw.slug}`)
</script>

<svelte:head>
	<title>{raw.name} — Celestial — KnowThing</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
	<!-- Header -->
	<div class="px-4 pt-4 md:px-6">
		<div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
			<div>
				<a href="/celestial" class="text-xs text-faint hover:text-link">← Celestial Registry</a>
				<h1 class="text-2xl font-bold text-heading md:text-3xl">{raw.name}</h1>
			</div>
			{#if isAdmin}
				<div class="flex gap-3 text-sm">
					<a href={editPath} class="text-link font-medium transition-colors hover:text-link-hover flex items-center gap-1">
						<PencilSimple size={14} weight="fill" />Edit
					</a>
				</div>
			{/if}
		</div>
		<div class="mt-2 h-0.5 bg-gradient-to-r from-accent to-accent-hover"></div>
	</div>

	<!-- Infobox + Content -->
	<div class="px-4 pt-3 pb-4 md:px-6 md:pb-5">
		<article class="know-article">
			<!-- Infobox from structured data -->
			{#if kind === 'system'}
				<InfoboxSystem fields={buildSystemFields(raw)} />
			{:else if kind === 'star'}
				<InfoboxStar fields={buildStarFields(raw)} />
			{:else}
				<InfoboxPlanet fields={buildPlanetFields(raw)} />
			{/if}

			<!-- Wiki content -->
			{#if ast}
				<WikiNodeComponent node={ast} />
			{:else if !data.wikiContent}
				<p class="text-dim italic mt-4">No article content yet.</p>
			{/if}
		</article>
	</div>
</div>
