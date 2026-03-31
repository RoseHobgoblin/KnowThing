<script lang="ts">
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import ConfigureFooter from '$lib/components/ConfigureFooter.svelte'
	import { celestialConfigureBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'

	let {
		body,
		allStars,
		siblings,
		wikiContent,
		contentRecordId,
		parentCrumbs,
	}: {
		body: Record<string, any>
		allStars: { id: number, name: string, slug: string }[]
		siblings: { id: number, name: string, slug: string }[]
		wikiContent: string
		contentRecordId: number | null
		parentCrumbs: { label: string, href: string }[]
	} = $props()

	const viewPath = parentCrumbs.length > 0
		? `${parentCrumbs.at(-1)!.href}/${body.slug}`
		: `/celestial/${body.slug}`

	// ── Form state ──────────────────────────────────────────
	// Identity
	let bodyType = $state(body.bodyType ?? 'planet')
	let starIdStr = $state(body.starId ? String(body.starId) : '')
	let parentIdStr = $state(body.parentId ? String(body.parentId) : '')
	let description = $state(body.description ?? '')

	// Physical
	let mass = $state(body.mass ?? '')
	let radius = $state(body.radius ?? '')
	let density = $state(body.density ?? '')
	let surfaceGravity = $state(body.surfaceGravity ?? '')
	let escapeVelocity = $state(body.escapeVelocity ?? '')
	let temperature = $state(body.temperature ?? '')
	let age = $state(body.age ?? '')

	// Composition
	let composition = $state(body.composition ?? '')
	let atmosphere = $state(body.atmosphere ?? '')
	let surfacePressure = $state(body.surfacePressure ?? '')

	// Orbital
	let orbitalPeriod = $state(body.orbitalPeriod ?? '')
	let orbitalPeriodDays = $state<number | null>(body.orbitalPeriodDays ?? null)
	let semiMajorAxis = $state(body.semiMajorAxis ?? '')
	let semiMajorAxisAu = $state<number | null>(body.semiMajorAxisAu ?? null)
	let eccentricity = $state<number | null>(body.eccentricity ?? null)
	let inclination = $state<number | null>(body.inclination ?? null)
	let epochPhase = $state<number | null>(body.epochPhase ?? null)

	// Rotation
	let rotationPeriod = $state(body.rotationPeriod ?? '')
	let rotationPeriodS = $state<number | null>(body.rotationPeriodS ?? null)
	let axialTilt = $state<number | null>(body.axialTilt ?? null)

	// Observation
	let apparentMagnitude = $state(body.apparentMagnitude ?? '')
	let angularDiameter = $state(body.angularDiameter ?? '')
	let albedo = $state(body.albedo ?? '')

	// System
	let satellites = $state<number | null>(body.satellites ?? null)
	let hasRings = $state(body.hasRings ?? false)

	// ── Wiki content ────────────────────────────────────────
	let content = $state(wikiContent ?? '')
	let editSummary = $state('')

	// ── Save state ──────────────────────────────────────────
	let saving = $state(false)

	const bodyTypeItems = [
		{ value: 'planet', label: 'Planet' },
		{ value: 'moon', label: 'Moon' },
		{ value: 'dwarf_planet', label: 'Dwarf Planet' },
		{ value: 'asteroid', label: 'Asteroid' },
		{ value: 'ring_system', label: 'Ring System' },
	]

	const starItems = $derived([
		{ value: '', label: 'None' },
		...allStars.map(s => ({ value: String(s.id), label: s.name })),
	])

	const parentItems = $derived([
		{ value: '', label: 'None (orbits star directly)' },
		...siblings
			.filter(s => s.id !== body.id)
			.map(s => ({ value: String(s.id), label: s.name })),
	])

	async function save() {
		saving = true
		try {
			const res = await fetch(`/api/planetary-bodies/${body.slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bodyType,
					starId: starIdStr ? Number(starIdStr) : null,
					parentId: parentIdStr ? Number(parentIdStr) : null,
					description,
					mass: mass || null,
					radius: radius || null,
					density: density || null,
					surfaceGravity: surfaceGravity || null,
					escapeVelocity: escapeVelocity || null,
					temperature: temperature || null,
					age: age || null,
					composition: composition || null,
					atmosphere: atmosphere || null,
					surfacePressure: surfacePressure || null,
					orbitalPeriod: orbitalPeriod || null,
					orbitalPeriodDays,
					semiMajorAxis: semiMajorAxis || null,
					semiMajorAxisAu,
					eccentricity,
					inclination,
					epochPhase,
					rotationPeriod: rotationPeriod || null,
					rotationPeriodS,
					axialTilt,
					apparentMagnitude: apparentMagnitude || null,
					angularDiameter: angularDiameter || null,
					albedo: albedo || null,
					satellites,
					hasRings,
				}),
			})
			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				pushError(data.error || 'Failed to save properties')
				return
			}

			if (contentRecordId && content !== wikiContent) {
				const formData = new FormData()
				formData.set('contentRecordId', String(contentRecordId))
				formData.set('content', content)
				formData.set('summary', editSummary)
				await fetch(window.location.pathname, { method: 'POST', body: formData })
			}

			pushSuccess('Body saved')
			goto(viewPath)
		} catch {
			pushError('Failed to save')
		} finally {
			saving = false
		}
	}
</script>

<ArticleShell
	breadcrumbs={celestialConfigureBreadcrumbs(parentCrumbs, { name: body.name, slug: body.slug })}
	title="Configure {body.name}"
>
	<div class="space-y-6">
		<!-- Identity -->
		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Identity</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div><span class="text-xs font-medium text-secondary block mb-1">Name</span><p class="text-sm text-body">{body.name}</p></div>
				<Select label="Body Type" type="single" bind:value={bodyType} items={bodyTypeItems} />
				<Select label="Parent Star" type="single" numeric bind:value={starIdStr} items={starItems} />
			</div>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<Select label="Orbits Body" type="single" numeric bind:value={parentIdStr} items={parentItems} />
				<Input label="Description" bind:value={description} placeholder="Brief description..." />
			</div>
		</section>

		<!-- Physical -->
		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Physical Characteristics</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Mass" bind:value={mass} placeholder="5.972 × 10²⁴ kg" />
				<Input label="Radius" bind:value={radius} placeholder="6,371.0 km" />
				<Input label="Density" bind:value={density} placeholder="5.514 g/cm³" />
				<Input label="Surface Gravity" bind:value={surfaceGravity} placeholder="9.807 m/s²" />
				<Input label="Escape Velocity" bind:value={escapeVelocity} placeholder="11.186 km/s" />
				<Input label="Temperature" bind:value={temperature} placeholder="288 K (mean)" />
				<Input label="Age" bind:value={age} placeholder="~4.5 billion years" />
			</div>
		</section>

		<!-- Composition -->
		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Composition</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Composition" bind:value={composition} placeholder="Iron, nickel, silicates" />
				<Input label="Atmosphere" bind:value={atmosphere} placeholder="N₂ 78%, O₂ 21%" />
				<Input label="Surface Pressure" bind:value={surfacePressure} placeholder="101.325 kPa" />
			</div>
		</section>

		<!-- Orbital -->
		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Orbital Parameters</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Orbital Period" bind:value={orbitalPeriod} placeholder="365.25 days" />
				<Input label="Orbital Period (days)" type="number" bind:value={orbitalPeriodDays} step="any" placeholder="365.25" />
				<Input label="Semi-major Axis" bind:value={semiMajorAxis} placeholder="1.496 × 10⁸ km" />
				<Input label="Semi-major Axis (AU)" type="number" bind:value={semiMajorAxisAu} step="any" placeholder="1.0" />
				<Input label="Eccentricity" type="number" bind:value={eccentricity} step="any" min={0} max={1} placeholder="0.0167" />
				<Input label="Inclination (°)" type="number" bind:value={inclination} step="any" placeholder="0.0" />
				<Input label="Epoch Phase" type="number" bind:value={epochPhase} step="any" placeholder="0.0" />
			</div>
		</section>

		<!-- Rotation -->
		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Rotation</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Rotation Period" bind:value={rotationPeriod} placeholder="23h 56m 4s" />
				<Input label="Rotation Period (seconds)" type="number" bind:value={rotationPeriodS} step="any" placeholder="86164.1" />
				<Input label="Axial Tilt (°)" type="number" bind:value={axialTilt} step="any" placeholder="23.44" />
			</div>
		</section>

		<!-- Observation -->
		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Observation & System</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Apparent Magnitude" bind:value={apparentMagnitude} placeholder="-3.86" />
				<Input label="Angular Diameter" bind:value={angularDiameter} placeholder="3.5 arcsec" />
				<Input label="Albedo" bind:value={albedo} placeholder="0.306" />
				<Input label="Satellites" type="number" bind:value={satellites} min={0} placeholder="1" />
				<Checkbox bind:value={hasRings} label="Has rings" />
			</div>
		</section>

		<ConfigureFooter
			initialContent={wikiContent ?? ''}
			bind:content
			bind:editSummary
			cancelHref={viewPath}
			{saving}
			onsave={save}
		/>
	</div>
</ArticleShell>
