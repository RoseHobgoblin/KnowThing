<script lang="ts">
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import ConfigureFooter from '$lib/components/ConfigureFooter.svelte'
	import { celestialConfigureBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { page } from '$app/stores'

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
	let confirmDialog: ReturnType<typeof ConfirmDialog>

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
	let saveError = $state('')
	let savedAt = $state<Date | null>(null)
	const initialSnapshot = JSON.stringify({
		bodyType: body.bodyType ?? 'planet',
		starId: body.starId ? String(body.starId) : '',
		parentId: body.parentId ? String(body.parentId) : '',
		description: body.description ?? '',
		mass: body.mass ?? '',
		radius: body.radius ?? '',
		density: body.density ?? '',
		surfaceGravity: body.surfaceGravity ?? '',
		escapeVelocity: body.escapeVelocity ?? '',
		temperature: body.temperature ?? '',
		age: body.age ?? '',
		composition: body.composition ?? '',
		atmosphere: body.atmosphere ?? '',
		surfacePressure: body.surfacePressure ?? '',
		orbitalPeriod: body.orbitalPeriod ?? '',
		orbitalPeriodDays: body.orbitalPeriodDays ?? null,
		semiMajorAxis: body.semiMajorAxis ?? '',
		semiMajorAxisAu: body.semiMajorAxisAu ?? null,
		eccentricity: body.eccentricity ?? null,
		inclination: body.inclination ?? null,
		epochPhase: body.epochPhase ?? null,
		rotationPeriod: body.rotationPeriod ?? '',
		rotationPeriodS: body.rotationPeriodS ?? null,
		axialTilt: body.axialTilt ?? null,
		apparentMagnitude: body.apparentMagnitude ?? '',
		angularDiameter: body.angularDiameter ?? '',
		albedo: body.albedo ?? '',
		satellites: body.satellites ?? null,
		hasRings: body.hasRings ?? false,
		content: wikiContent ?? '',
	})
	const currentSnapshot = $derived(JSON.stringify({
		bodyType, starId: starIdStr, parentId: parentIdStr, description, mass, radius, density,
		surfaceGravity, escapeVelocity, temperature, age, composition, atmosphere, surfacePressure,
		orbitalPeriod, orbitalPeriodDays, semiMajorAxis, semiMajorAxisAu, eccentricity, inclination,
		epochPhase, rotationPeriod, rotationPeriodS, axialTilt, apparentMagnitude, angularDiameter,
		albedo, satellites, hasRings, content,
	}))
	const isDirty = $derived(currentSnapshot !== initialSnapshot || editSummary.trim().length > 0)
	const permissions = $derived($page.data.permissions)
	const validationIssues = $derived.by(() => {
		const issues: string[] = []
		if (semiMajorAxisAu !== null && semiMajorAxisAu < 0) issues.push('Semi-major axis must be zero or greater.')
		if (eccentricity !== null && (eccentricity < 0 || eccentricity > 1)) issues.push('Eccentricity must be between 0 and 1.')
		if (satellites !== null && satellites < 0) issues.push('Satellite count cannot be negative.')
		return issues
	})

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

	function resetDraft() {
		bodyType = body.bodyType ?? 'planet'
		starIdStr = body.starId ? String(body.starId) : ''
		parentIdStr = body.parentId ? String(body.parentId) : ''
		description = body.description ?? ''
		mass = body.mass ?? ''
		radius = body.radius ?? ''
		density = body.density ?? ''
		surfaceGravity = body.surfaceGravity ?? ''
		escapeVelocity = body.escapeVelocity ?? ''
		temperature = body.temperature ?? ''
		age = body.age ?? ''
		composition = body.composition ?? ''
		atmosphere = body.atmosphere ?? ''
		surfacePressure = body.surfacePressure ?? ''
		orbitalPeriod = body.orbitalPeriod ?? ''
		orbitalPeriodDays = body.orbitalPeriodDays ?? null
		semiMajorAxis = body.semiMajorAxis ?? ''
		semiMajorAxisAu = body.semiMajorAxisAu ?? null
		eccentricity = body.eccentricity ?? null
		inclination = body.inclination ?? null
		epochPhase = body.epochPhase ?? null
		rotationPeriod = body.rotationPeriod ?? ''
		rotationPeriodS = body.rotationPeriodS ?? null
		axialTilt = body.axialTilt ?? null
		apparentMagnitude = body.apparentMagnitude ?? ''
		angularDiameter = body.angularDiameter ?? ''
		albedo = body.albedo ?? ''
		satellites = body.satellites ?? null
		hasRings = body.hasRings ?? false
		content = wikiContent ?? ''
		editSummary = ''
		saveError = ''
	}

	async function save() {
		if (validationIssues.length > 0) {
			saveError = 'Review the orbital fields below before saving.'
			return
		}

		saving = true
		saveError = ''
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
				saveError = data.error || 'Failed to save properties'
				pushError(saveError)
				return
			}

			if (contentRecordId && content !== wikiContent) {
				const formData = new FormData()
				formData.set('contentRecordId', String(contentRecordId))
				formData.set('content', content)
				formData.set('summary', editSummary)
				await fetch(window.location.pathname, { method: 'POST', body: formData })
			}

			savedAt = new Date()
			pushSuccess('Body saved')
			goto(viewPath)
		} catch {
			saveError = 'Failed to save'
			pushError('Failed to save')
		} finally {
			saving = false
		}
	}

	async function deleteBody() {
		const ok = await confirmDialog.confirm(
			'Delete celestial body',
			`Delete "${body.name}"? This cannot be undone.`,
			'Delete Body',
			'Cancel',
		)
		if (!ok) return

		const response = await fetch(`/api/planetary-bodies/${body.slug}`, { method: 'DELETE' })
		if (!response.ok) {
			const payload = await response.json().catch(() => ({}))
			pushError(payload.error || 'Failed to delete body')
			return
		}

		pushSuccess('Body deleted')
		goto(parentCrumbs.at(-1)?.href ?? '/celestial')
	}
</script>

<ArticleShell
	breadcrumbs={celestialConfigureBreadcrumbs(parentCrumbs, { name: body.name, slug: body.slug })}
	title="Configure {body.name}"
>
	<UnsavedChangesGuard when={isDirty && !saving} />
	<div class="space-y-6">
		<div class="flex items-center justify-between gap-3 bg-surface border border-border px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold text-heading">Configure Record</h2>
				<p class="text-xs text-faint">Structured body properties and article content are managed here.</p>
			</div>
			<SaveStatusBadge dirty={isDirty} {saving} error={saveError} {savedAt} />
		</div>
		{#if saveError}
			<FormNotice title="Body changes were not saved" message={saveError} />
		{/if}
		{#if validationIssues.length > 0}
			<FormNotice tone="warning" title="Body draft needs attention" messages={validationIssues} />
		{/if}
		<section class="bg-page border border-border-subtle p-5">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Current Summary</h2>
			<div class="grid grid-cols-1 gap-4 pt-3 md:grid-cols-4">
				<div>
					<div class="text-xs font-medium text-secondary">Classification</div>
					<div class="text-sm text-body">{bodyType}</div>
				</div>
				<div>
					<div class="text-xs font-medium text-secondary">Parent Star</div>
					<div class="text-sm text-body">{starItems.find(item => item.value === starIdStr)?.label || 'Unassigned'}</div>
				</div>
				<div>
					<div class="text-xs font-medium text-secondary">Orbit Summary</div>
					<div class="text-sm text-body">{semiMajorAxisAu ?? '—'} AU, e={eccentricity ?? '—'}</div>
				</div>
				<div>
					<div class="text-xs font-medium text-secondary">Article State</div>
					<div class="text-sm text-body">{content.trim() ? 'Article content present' : 'No article content yet'}</div>
				</div>
			</div>
		</section>
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
				<Input label="Semi-major Axis (AU)" type="number" bind:value={semiMajorAxisAu} step="any" placeholder="1.0" error={semiMajorAxisAu !== null && semiMajorAxisAu < 0 ? 'Must be 0 or greater' : ''} />
				<Input label="Eccentricity" type="number" bind:value={eccentricity} step="any" min={0} max={1} placeholder="0.0167" error={eccentricity !== null && (eccentricity < 0 || eccentricity > 1) ? 'Use a value from 0 to 1' : ''} />
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
				<Input label="Satellites" type="number" bind:value={satellites} min={0} placeholder="1" error={satellites !== null && satellites < 0 ? 'Cannot be negative' : ''} />
				<Checkbox bind:value={hasRings} label="Has rings" />
			</div>
		</section>

		<ConfigureFooter
			initialContent={wikiContent ?? ''}
			bind:content
			bind:editSummary
			cancelHref={viewPath}
			{saving}
			dirty={isDirty}
			error={saveError}
			{savedAt}
			onsave={save}
			ondiscard={resetDraft}
		/>

		{#if permissions.canManageSettings}
			<section class="border border-error-border bg-error-subtle/40 p-5 space-y-3">
				<div>
					<h2 class="text-sm font-semibold text-error">Danger Zone</h2>
					<p class="text-xs text-faint mt-1">Delete this celestial body record. This cannot be undone.</p>
				</div>
				<div>
					<button
						type="button"
						onclick={deleteBody}
						class="px-4 py-2 text-sm border border-error-border text-error hover:bg-error-subtle"
					>
						Delete Body
					</button>
				</div>
			</section>
		{/if}
	</div>
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
