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
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import { updatePlanetaryBodySchema } from '$lib/celestial/schema.js'
	import { summarizeZodIssues } from '$lib/utils.js'
	import { getBodyPresets, type BodyPreset } from '$lib/celestial/presets.js'
	import { deriveBodyFields, deriveDisplayStrings } from '$lib/celestial/compute.js'

	type CelestialCrumb = { label: string, href: string }
	type BodyType = 'planet' | 'moon' | 'dwarf_planet' | 'asteroid' | 'ring_system'
	type CelestialStarOption = { id: number, name: string, slug: string }
	type CelestialBodyOption = { id: number, name: string, slug: string }
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
	const initialSnapshot = JSON.stringify(initialDraft)
	// Auto-computed derived fields
	const computedPhysical = $derived(deriveBodyFields(massKg, radiusM))
	const computedDisplay = $derived(deriveDisplayStrings(orbitalPeriodDays, semiMajorAxisAu, rotationPeriodS))

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
		{ value: 'moon', label: 'Moon' },
		{ value: 'dwarf_planet', label: 'Dwarf Planet' },
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
		<div class="flex items-center justify-between gap-3 bg-surface border border-border px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold text-heading">Configure Record</h2>
				<p class="text-xs text-faint">Structured body properties and article content are managed here.</p>
			</div>
			<SaveStatusBadge dirty={isDirty} {saving} error={saveError} {savedAt} />
		</div>
		<section class="bg-accent-subtle/30 border border-accent-border/50 p-4 flex flex-col gap-2 sm:flex-row sm:items-end">
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
					<div class="text-sm text-body">{semiMajorAxisAu ?? '-'} AU, e={eccentricity ?? '-'}</div>
				</div>
				<div>
					<div class="text-xs font-medium text-secondary">Article State</div>
					<div class="text-sm text-body">{content.trim() ? 'Article content present' : 'No article content yet'}</div>
				</div>
			</div>
		</section>

		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Identity</h2>
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

		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Physical Characteristics</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Mass (kg)" type="number" bind:value={massKg} step="any" placeholder="5.972e24" />
				<Input label="Radius (m)" type="number" bind:value={radiusM} step="any" placeholder="6371000" />
				<div>
					<span class="text-xs font-medium text-secondary block mb-1">Density</span>
					<p class="text-sm text-dim italic">{computedPhysical.density ?? '—'}</p>
				</div>
				<div>
					<span class="text-xs font-medium text-secondary block mb-1">Surface Gravity</span>
					<p class="text-sm text-dim italic">{computedPhysical.surfaceGravity ?? '—'}</p>
				</div>
				<div>
					<span class="text-xs font-medium text-secondary block mb-1">Escape Velocity</span>
					<p class="text-sm text-dim italic">{computedPhysical.escapeVelocity ?? '—'}</p>
				</div>
				<Input label="Temperature" bind:value={temperature} placeholder="288 K (mean)" />
				<Input label="Age" bind:value={age} placeholder="~4.5 billion years" />
			</div>
		</section>

		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Composition</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Composition" bind:value={composition} placeholder="Iron, nickel, silicates" />
				<Input label="Atmosphere" bind:value={atmosphere} placeholder="N2 78%, O2 21%" />
				<Input label="Surface Pressure" bind:value={surfacePressure} placeholder="101.325 kPa" />
			</div>
		</section>

		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Orbital Parameters</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Orbital Period (days)" type="number" bind:value={orbitalPeriodDays} step="any" placeholder="365.25" />
				<div>
					<span class="text-xs font-medium text-secondary block mb-1">Orbital Period</span>
					<p class="text-sm text-dim italic">{computedDisplay.orbitalPeriod ?? '—'}</p>
				</div>
				<Input label="Semi-major Axis (AU)" type="number" bind:value={semiMajorAxisAu} step="any" placeholder="1.0" error={semiMajorAxisAu !== null && semiMajorAxisAu < 0 ? 'Must be 0 or greater' : ''} />
				<div>
					<span class="text-xs font-medium text-secondary block mb-1">Semi-major Axis</span>
					<p class="text-sm text-dim italic">{computedDisplay.semiMajorAxis ?? '—'}</p>
				</div>
				<Input label="Eccentricity" type="number" bind:value={eccentricity} step="any" min={0} max={1} placeholder="0.0167" error={eccentricity !== null && (eccentricity < 0 || eccentricity > 1) ? 'Use a value from 0 to 1' : ''} />
				<Input label="Inclination (deg)" type="number" bind:value={inclination} step="any" placeholder="0.0" />
				<Input label="Epoch Phase" type="number" bind:value={epochPhase} step="any" min={0} max={1} placeholder="0.0" error={epochPhase !== null && (epochPhase < 0 || epochPhase > 1) ? 'Use a value from 0 to 1' : ''} />
			</div>
		</section>

		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Rotation</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Rotation Period (seconds)" type="number" bind:value={rotationPeriodS} step="any" placeholder="86164.1" />
				<div>
					<span class="text-xs font-medium text-secondary block mb-1">Rotation Period</span>
					<p class="text-sm text-dim italic">{computedDisplay.rotationPeriod ?? '—'}</p>
				</div>
				<Input label="Axial Tilt (deg)" type="number" bind:value={axialTilt} step="any" placeholder="23.44" />
			</div>
		</section>

		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Observation and System</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Apparent Magnitude" bind:value={apparentMagnitude} placeholder="-3.86" />
				<Input label="Angular Diameter" bind:value={angularDiameter} placeholder="3.5 arcsec" />
				<Input label="Albedo" bind:value={albedo} placeholder="0.306" />
				<Checkbox bind:value={hasRings} label="Has rings" />
			</div>
		</section>

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
