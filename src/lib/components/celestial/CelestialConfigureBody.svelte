<script lang="ts">
	import { untrack } from 'svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import ConfigureFooter from '$lib/components/ConfigureFooter.svelte'
	import { celestialConfigureBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import { updatePlanetaryBodySchema } from '$lib/celestial/schema.js'
	import { summarizeZodIssues } from '$lib/utils.js'
	import { getBodyPresets, type BodyPreset } from '$lib/celestial/presets.js'
	import { deriveBodyFields, deriveBodyOrbitalFields, deriveDisplayStrings } from '$lib/celestial/compute.js'
	import { validateBodyPhysics } from '$lib/celestial/validate-physics.js'
	import TabNavigation from '$lib/components/ui/TabNavigation.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import DerivedField from '$lib/components/ui/DerivedField.svelte'

	const bodyTabs = [
		{ id: 'identity', label: 'Identity' },
		{ id: 'physical', label: 'Physical' },
		{ id: 'composition', label: 'Composition' },
		{ id: 'orbit', label: 'Orbit' },
		{ id: 'rotation', label: 'Rotation' },
		{ id: 'observation', label: 'Observation' },
		{ id: 'article', label: 'Article' },
	]
	let activeTab = $state('identity')

	type CelestialCrumb = { label: string, href: string }
	type BodyType = 'planet' | 'asteroid' | 'ring_system'
	type CelestialStarOption = { id: number, name: string, slug: string, massKg?: number | null }
	type CelestialBodyOption = { id: number, name: string, slug: string, massKg?: number | null }
	type BodyRecord = {
		id: number
		name: string
		slug: string
		bodyType?: BodyType | null
		starId?: number | null
		parentId?: number | null
		description?: string | null
		mass?: string | null
		massKg?: number | null
		radius?: string | null
		radiusM?: number | null
		density?: string | null
		surfaceGravity?: string | null
		escapeVelocity?: string | null
		temperature?: string | null
		age?: string | null
		composition?: string | null
		atmosphere?: string | null
		surfacePressure?: string | null
		orbitalPeriod?: string | null
		orbitalPeriodDays?: number | null
		semiMajorAxis?: string | null
		semiMajorAxisAu?: number | null
		eccentricity?: number | null
		inclination?: number | null
		epochPhase?: number | null
		rotationPeriod?: string | null
		rotationPeriodS?: number | null
		axialTilt?: number | null
		apparentMagnitude?: string | null
		angularDiameter?: string | null
		albedo?: string | null
		satellites?: number | null
		hasRings?: boolean | null
	}

	type BodyDraftSnapshot = {
		bodyType: BodyType
		starIdStr: string
		parentIdStr: string
		description: string
		massKg: number | null
		radiusM: number | null
		temperature: string
		age: string
		composition: string
		atmosphere: string
		surfacePressure: string
		orbitalPeriodDays: number | null
		semiMajorAxisAu: number | null
		eccentricity: number | null
		inclination: number | null
		epochPhase: number | null
		rotationPeriodS: number | null
		axialTilt: number | null
		apparentMagnitude: string
		angularDiameter: string
		albedo: string
		hasRings: boolean
		content: string
	}

	function buildInitialBodyDraft(bodyRecord: BodyRecord, articleContent: string): BodyDraftSnapshot {
		return {
			bodyType: bodyRecord.bodyType ?? 'planet',
			starIdStr: bodyRecord.starId ? String(bodyRecord.starId) : '',
			parentIdStr: bodyRecord.parentId ? String(bodyRecord.parentId) : '',
			description: bodyRecord.description ?? '',
			massKg: bodyRecord.massKg ?? null,
			radiusM: bodyRecord.radiusM ?? null,
			temperature: bodyRecord.temperature ?? '',
			age: bodyRecord.age ?? '',
			composition: bodyRecord.composition ?? '',
			atmosphere: bodyRecord.atmosphere ?? '',
			surfacePressure: bodyRecord.surfacePressure ?? '',
			orbitalPeriodDays: bodyRecord.orbitalPeriodDays ?? null,
			semiMajorAxisAu: bodyRecord.semiMajorAxisAu ?? null,
			eccentricity: bodyRecord.eccentricity ?? null,
			inclination: bodyRecord.inclination ?? null,
			epochPhase: bodyRecord.epochPhase ?? null,
			rotationPeriodS: bodyRecord.rotationPeriodS ?? null,
			axialTilt: bodyRecord.axialTilt ?? null,
			apparentMagnitude: bodyRecord.apparentMagnitude ?? '',
			angularDiameter: bodyRecord.angularDiameter ?? '',
			albedo: bodyRecord.albedo ?? '',
			hasRings: bodyRecord.hasRings ?? false,
			content: articleContent,
		}
	}

	let {
		body,
		allStars,
		siblings,
		wikiContent,
		contentRecordId,
		parentCrumbs,
	}: {
		body: BodyRecord
		allStars: CelestialStarOption[]
		siblings: CelestialBodyOption[]
		wikiContent: string
		contentRecordId: number | null
		parentCrumbs: CelestialCrumb[]
	} = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const initialBody = $state.snapshot(untrack(() => body))
	const initialParentCrumbs = $state.snapshot(untrack(() => parentCrumbs))
	const initialWikiContent = untrack(() => wikiContent ?? '')
	const initialDraft = buildInitialBodyDraft(initialBody, initialWikiContent)

	const viewPath = $derived.by(() => initialParentCrumbs.length > 0
		? `${initialParentCrumbs.at(-1)!.href}/${initialBody.slug}`
		: `/celestial/${initialBody.slug}`)

	let bodyType = $state<BodyType>(initialDraft.bodyType)
	let starIdStr = $state(initialDraft.starIdStr)
	let parentIdStr = $state(initialDraft.parentIdStr)
	let description = $state(initialDraft.description)

	let massKg = $state<number | null>(initialDraft.massKg)
	let radiusM = $state<number | null>(initialDraft.radiusM)
	let temperature = $state(initialDraft.temperature)
	let age = $state(initialDraft.age)

	let composition = $state(initialDraft.composition)
	let atmosphere = $state(initialDraft.atmosphere)
	let surfacePressure = $state(initialDraft.surfacePressure)

	let orbitalPeriodDays = $state<number | null>(initialDraft.orbitalPeriodDays)
	let semiMajorAxisAu = $state<number | null>(initialDraft.semiMajorAxisAu)
	let eccentricity = $state<number | null>(initialDraft.eccentricity)
	let inclination = $state<number | null>(initialDraft.inclination)
	let epochPhase = $state<number | null>(initialDraft.epochPhase)

	let rotationPeriodS = $state<number | null>(initialDraft.rotationPeriodS)
	let axialTilt = $state<number | null>(initialDraft.axialTilt)

	let apparentMagnitude = $state(initialDraft.apparentMagnitude)
	let angularDiameter = $state(initialDraft.angularDiameter)
	let albedo = $state(initialDraft.albedo)

	let hasRings = $state(initialDraft.hasRings)

	let content = $state(initialDraft.content)
	let editSummary = $state('')

	// Preset population
	const bodyPresets = getBodyPresets()
	const presetItems = [
		{ value: '', label: 'Choose a body...' },
		...[...bodyPresets.keys()].map(name => ({ value: name, label: name })),
	]
	let selectedPreset = $state('')

	function applyPreset(preset: BodyPreset) {
		bodyType = preset.bodyType
		massKg = preset.massKg
		radiusM = preset.radiusM
		temperature = preset.temperature
		composition = preset.composition
		atmosphere = preset.atmosphere
		orbitalPeriodDays = preset.orbitalPeriodDays
		semiMajorAxisAu = preset.semiMajorAxisAu
		eccentricity = preset.eccentricity
		inclination = preset.inclination
		rotationPeriodS = preset.rotationPeriodS
		axialTilt = preset.axialTilt
		hasRings = preset.hasRings
	}

	let saving = $state(false)
	let saveError = $state('')
	let savedAt = $state<Date | null>(null)
	let initialSnapshot = JSON.stringify(initialDraft)
	// Auto-computed derived fields
	const computedPhysical = $derived(deriveBodyFields(massKg, radiusM))
	const physicsWarnings = $derived(validateBodyPhysics({ massKg, radiusM, orbitalPeriodDays, semiMajorAxisAu, eccentricity, rotationPeriodS, axialTilt, bodyType, isSatellite: !!parentIdStr }))

	const parentMassKg = $derived.by(() => {
		if (parentIdStr) {
			const parent = siblings.find(s => String(s.id) === parentIdStr)
			if (parent?.massKg) return parent.massKg
		}
		if (starIdStr) {
			const star = allStars.find(s => String(s.id) === starIdStr)
			if (star?.massKg) return star.massKg
		}
		return null
	})
	const computedOrbital = $derived(deriveBodyOrbitalFields(semiMajorAxisAu, orbitalPeriodDays, massKg, parentMassKg))
	const effectivePeriodDays = $derived(orbitalPeriodDays ?? computedOrbital.orbitalPeriodDays)
	const computedDisplay = $derived(deriveDisplayStrings(effectivePeriodDays, semiMajorAxisAu, rotationPeriodS))

	const currentSnapshot = $derived(JSON.stringify({
		bodyType,
		starIdStr,
		parentIdStr,
		description,
		massKg,
		radiusM,
		temperature,
		age,
		composition,
		atmosphere,
		surfacePressure,
		orbitalPeriodDays,
		semiMajorAxisAu,
		eccentricity,
		inclination,
		epochPhase,
		rotationPeriodS,
		axialTilt,
		apparentMagnitude,
		angularDiameter,
		albedo,
		hasRings,
		content,
	}))
	const isDirty = $derived(currentSnapshot !== initialSnapshot || editSummary.trim().length > 0)
	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)
	const validationIssues = $derived.by(() => {
		const parsed = updatePlanetaryBodySchema.safeParse({
			bodyType,
			starId: starIdStr ? Number(starIdStr) : null,
			parentId: parentIdStr ? Number(parentIdStr) : null,
			description,
			massKg,
			radiusM,
			temperature: temperature || null,
			age: age || null,
			composition: composition || null,
			atmosphere: atmosphere || null,
			surfacePressure: surfacePressure || null,
			orbitalPeriodDays,
			semiMajorAxisAu,
			eccentricity,
			inclination,
			epochPhase,
			rotationPeriodS,
			axialTilt,
			apparentMagnitude: apparentMagnitude || null,
			angularDiameter: angularDiameter || null,
			albedo: albedo || null,
			hasRings,
		})

		if (parsed.success) return []
		return summarizeZodIssues(parsed.error)
	})

	const bodyTypeItems: Array<{ value: BodyType, label: string }> = [
		{ value: 'planet', label: 'Planet' },
		{ value: 'asteroid', label: 'Asteroid' },
		{ value: 'ring_system', label: 'Ring System' },
	]

	const starItems = $derived<Array<{ value: string, label: string }>>([
		{ value: '', label: 'None' },
		...allStars.map(starOption => ({ value: String(starOption.id), label: starOption.name })),
	])

	const parentItems = $derived<Array<{ value: string, label: string }>>([
		{ value: '', label: 'None (orbits star directly)' },
		...siblings
			.filter(sibling => sibling.id !== initialBody.id)
			.map(sibling => ({ value: String(sibling.id), label: sibling.name })),
	])

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})

	function resetDraft() {
		bodyType = initialDraft.bodyType
		starIdStr = initialDraft.starIdStr
		parentIdStr = initialDraft.parentIdStr
		description = initialDraft.description
		massKg = initialDraft.massKg
		radiusM = initialDraft.radiusM
		temperature = initialDraft.temperature
		age = initialDraft.age
		composition = initialDraft.composition
		atmosphere = initialDraft.atmosphere
		surfacePressure = initialDraft.surfacePressure
		orbitalPeriodDays = initialDraft.orbitalPeriodDays
		semiMajorAxisAu = initialDraft.semiMajorAxisAu
		eccentricity = initialDraft.eccentricity
		inclination = initialDraft.inclination
		epochPhase = initialDraft.epochPhase
		rotationPeriodS = initialDraft.rotationPeriodS
		axialTilt = initialDraft.axialTilt
		apparentMagnitude = initialDraft.apparentMagnitude
		angularDiameter = initialDraft.angularDiameter
		albedo = initialDraft.albedo
		hasRings = initialDraft.hasRings
		content = initialDraft.content
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
			const res = await fetch(`/api/planetary-bodies/${initialBody.slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bodyType,
					starId: starIdStr ? Number(starIdStr) : null,
					parentId: parentIdStr ? Number(parentIdStr) : null,
					description,
					massKg,
					radiusM,
					temperature: temperature || null,
					age: age || null,
					composition: composition || null,
					atmosphere: atmosphere || null,
					surfacePressure: surfacePressure || null,
					orbitalPeriodDays,
					semiMajorAxisAu,
					eccentricity,
					inclination,
					epochPhase,
					rotationPeriodS,
					axialTilt,
					apparentMagnitude: apparentMagnitude || null,
					angularDiameter: angularDiameter || null,
					albedo: albedo || null,
					hasRings,
				}),
			})
			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				saveError = data.error || 'Failed to save properties'
				pushError(saveError)
				return
			}

			if (content !== initialWikiContent) {
				if (!contentRecordId) {
					saveError = 'Article content is not attached to this body yet. Reload and try again.'
					pushError(saveError)
					return
				}
				const formData = new FormData()
				formData.set('contentRecordId', String(contentRecordId))
				formData.set('content', content)
				formData.set('summary', editSummary)
				const articleRes = await fetch(window.location.pathname, { method: 'POST', body: formData })
				if (!articleRes.ok) {
					const payload = await articleRes.json().catch(() => ({}))
					saveError = payload.error || 'Failed to save article content'
					pushError(saveError)
					return
				}
			}

			savedAt = new Date()
			initialSnapshot = currentSnapshot
			editSummary = ''
			pushSuccess('Body saved')
		} catch {
			saveError = 'Failed to save'
			pushError('Failed to save')
		} finally {
			saving = false
		}
	}

	async function saveAndExit() {
		await save()
		if (!saveError) goto(viewPath)
	}

	async function deleteBody() {
		const ok = await confirmDialog.confirm(
			'Delete celestial body',
			`Delete "${initialBody.name}"? This cannot be undone.`,
			'Delete Body',
			'Cancel',
		)
		if (!ok) return

		const response = await fetch(`/api/planetary-bodies/${initialBody.slug}`, { method: 'DELETE' })
		if (!response.ok) {
			const payload = await response.json().catch(() => ({}))
			pushError(payload.error || 'Failed to delete body')
			return
		}

		pushSuccess('Body deleted')
		goto(initialParentCrumbs.at(-1)?.href ?? '/celestial')
	}
</script>

<ArticleShell
	breadcrumbs={celestialConfigureBreadcrumbs(initialParentCrumbs, { name: initialBody.name, slug: initialBody.slug })}
	title="Configure {initialBody.name}"
>
	<UnsavedChangesGuard when={isDirty && !saving} />
	<div class="space-y-6">
		<section class="bg-base border border-border p-4 flex flex-col gap-2 sm:flex-row sm:items-end">
			<div class="flex-1">
				<Select label="Populate from real-world data" type="single" bind:value={selectedPreset} items={presetItems} />
			</div>
			<button
				type="button"
				disabled={!selectedPreset}
				onclick={() => {
					const preset = bodyPresets.get(selectedPreset)
					if (preset) applyPreset(preset)
				}}
				class="px-4 py-2 text-sm border border-accent-border text-accent hover:bg-accent-subtle disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Apply
			</button>
		</section>

		{#if saveError}
			<FormNotice title="Body changes were not saved" message={saveError} />
		{/if}
		{#if validationIssues.length > 0}
			<FormNotice tone="warning" title="Body draft needs attention" messages={validationIssues} />
		{/if}
		{#if physicsWarnings.length > 0}
			<FormNotice
				tone="warning"
				title="Physics plausibility"
				messages={physicsWarnings.map(w => `${w.severity === 'impossible' ? '🚫' : '⚠️'} ${w.message}`)}
			/>
		{/if}
		<TabNavigation navItems={bodyTabs} bind:activeSectionId={activeTab} fullWidth size="sm" />

		{#if activeTab === 'identity'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div><span class="text-xs font-medium text-secondary block mb-1">Name</span><p class="text-sm text-body">{initialBody.name}</p></div>
					<Select label="Body Type" type="single" bind:value={bodyType} items={bodyTypeItems} />
					<Select label="Parent Star" type="single" bind:value={starIdStr} items={starItems} />
				</div>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Select label="Orbits Body" type="single" bind:value={parentIdStr} items={parentItems} />
					<Input label="Description" bind:value={description} placeholder="Brief description..." />
				</div>
			</section>
		{:else if activeTab === 'physical'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Input label="Mass (kg)" type="number" bind:value={massKg} step="any" placeholder="5.972e24" hint="Total mass in kilograms. Earth is 5.972 × 10²⁴ kg. Used to derive density, gravity, escape velocity, and Hill sphere." />
					<Input label="Radius (m)" type="number" bind:value={radiusM} step="any" placeholder="6371000" hint="Mean radius in metres. Earth is 6,371,000 m. Used to derive density, gravity, and escape velocity." />
					<DerivedField label="Density" value={computedPhysical.density} hint="Mass / volume. Derived from mass and radius. Earth is 5.514 g/cm³." />
					<DerivedField label="Surface Gravity" value={computedPhysical.surfaceGravity} hint="GM/r². Derived from mass and radius. Earth is 9.807 m/s²." />
					<DerivedField label="Escape Velocity" value={computedPhysical.escapeVelocity} hint="√(2GM/r). Minimum speed to leave the body's gravity. Earth is 11.186 km/s." />
					<Input label="Temperature" bind:value={temperature} placeholder="288 K (mean)" hint="Mean surface or cloud-top temperature. Free text — include units." />
					<Input label="Age" bind:value={age} placeholder="~4.5 billion years" hint="Estimated age. Free text." />
				</div>
			</section>
		{:else if activeTab === 'composition'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Input label="Composition" bind:value={composition} placeholder="Iron, nickel, silicates" hint="Primary materials making up the body." />
					<Input label="Atmosphere" bind:value={atmosphere} placeholder="N2 78%, O2 21%" hint="Atmospheric composition. Leave blank for airless bodies." />
					<Input label="Surface Pressure" bind:value={surfacePressure} placeholder="101.325 kPa" hint="Atmospheric pressure at the surface. Earth is 101.325 kPa." />
				</div>
			</section>
		{:else if activeTab === 'orbit'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Input label="Orbital Period (days)" type="number" bind:value={orbitalPeriodDays} step="any" placeholder="365.25" hint="Time for one full orbit in days. Leave blank to auto-derive from semi-major axis and parent star mass via Kepler's third law." />
					<DerivedField label="Orbital Period" value={computedDisplay.orbitalPeriod} tag={orbitalPeriodDays == null && computedOrbital.orbitalPeriodDays != null ? 'Kepler' : undefined} hint="Human-readable period. Formatted from the days value, or computed via T = 2π√(a³/GM) when parent star mass is known." />
					<Input label="Semi-major Axis (AU)" type="number" bind:value={semiMajorAxisAu} step="any" placeholder="1.0" hint="Half the longest diameter of the orbit, in astronomical units. 1 AU = Earth–Sun distance." error={semiMajorAxisAu !== null && semiMajorAxisAu < 0 ? 'Must be 0 or greater' : ''} />
					<DerivedField label="Semi-major Axis" value={computedDisplay.semiMajorAxis} hint="Same distance converted to kilometres." />
					<Input label="Eccentricity" type="number" bind:value={eccentricity} step="any" min={0} max={1} placeholder="0.0167" hint="How elliptical the orbit is. 0 = perfect circle, 1 = parabolic escape. Earth is 0.0167." error={eccentricity !== null && (eccentricity < 0 || eccentricity > 1) ? 'Use a value from 0 to 1' : ''} />
					<Input label="Inclination (deg)" type="number" bind:value={inclination} step="any" placeholder="0.0" hint="Angle of the orbital plane relative to the reference plane (ecliptic), in degrees." />
					<Input label="Epoch Phase" type="number" bind:value={epochPhase} step="any" min={0} max={1} placeholder="0.0" hint="Position along the orbit at day 0 (0–1). Used for map animation. 0 = periapsis." error={epochPhase !== null && (epochPhase < 0 || epochPhase > 1) ? 'Use a value from 0 to 1' : ''} />
					<DerivedField label="Orbital Velocity" value={computedOrbital.orbitalVelocity} hint="Mean speed along the orbit: 2πa / T. Earth is ~29.78 km/s." />
					<DerivedField label="Hill Sphere" value={computedOrbital.hillSphere} hint="Maximum distance at which this body can hold satellites. Derived from semi-major axis, body mass, and parent mass: a × (m/3M)^⅓." />
				</div>
			</section>
		{:else if activeTab === 'rotation'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Input label="Rotation Period (seconds)" type="number" bind:value={rotationPeriodS} step="any" placeholder="86164.1" hint="Sidereal rotation period in seconds. Earth is 86,164 s (23h 56m 4s). Not the same as a solar day." />
					<DerivedField label="Rotation Period" value={computedDisplay.rotationPeriod} hint="Human-readable rotation period, formatted from the seconds value." />
					<Input label="Axial Tilt (deg)" type="number" bind:value={axialTilt} step="any" placeholder="23.44" hint="Angle between the rotational axis and the orbital plane. Earth is 23.44°. Drives seasons." />
				</div>
			</section>
		{:else if activeTab === 'observation'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Input label="Apparent Magnitude" bind:value={apparentMagnitude} placeholder="-3.86" hint="Brightness as seen from a reference point. Lower = brighter. Venus is about -4.6, full Moon is -12.7." />
					<Input label="Angular Diameter" bind:value={angularDiameter} placeholder="3.5 arcsec" hint="Apparent size in the sky from a reference point. The Moon is ~31 arcminutes." />
					<Input label="Albedo" bind:value={albedo} placeholder="0.306" hint="Fraction of incoming light reflected. 0 = perfectly dark, 1 = perfectly reflective. Earth is 0.306." />
					<Checkbox bind:value={hasRings} label="Has rings" />
				</div>
			</section>
		{:else if activeTab === 'article'}
			<ConfigureFooter
				initialContent={initialWikiContent}
				bind:content
				bind:editSummary
				cancelHref={viewPath}
				{saving}
				dirty={isDirty}
				error={saveError}
				{savedAt}
				onsave={save}
				onsaveandexit={saveAndExit}
				ondiscard={resetDraft}
			/>
		{/if}

		{#if activeTab !== 'article'}
			<div class="space-y-3">
				<StickyActionBar
					dirty={isDirty}
					{saving}
					error={saveError}
					{savedAt}
					saveType="button"
					onsave={save}
					onsaveandexit={saveAndExit}
					ondiscard={resetDraft}
					cancelHref={viewPath}
				/>
			</div>
		{/if}

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
