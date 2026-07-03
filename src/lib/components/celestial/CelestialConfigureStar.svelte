<script lang="ts">
	import { untrack } from 'svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import { celestialConfigureBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import { updateStarSchema } from '$lib/celestial/schema.js'
	import { summarizeZodIssues } from '$lib/utils.js'
	import { getStarPresets, type StarPreset } from '$lib/celestial/presets.js'
	import { deriveBodyFields, deriveStarOrbitalFields, deriveDisplayStrings, computeLuminosity, formatLuminosity, computeHabitableZoneAu } from '$lib/celestial/compute.js'
	import { validateStarPhysics } from '$lib/celestial/validate-physics.js'
	import TabNavigation from '$lib/components/ui/TabNavigation.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import DerivedField from '$lib/components/ui/DerivedField.svelte'
	import LockableDerivedField from '$lib/components/ui/LockableDerivedField.svelte'
	import { formatMass, formatRadius, formatTemperatureK } from '$lib/celestial/compute.js'

	const starTabs = [
		{ id: 'identity', label: 'Identity' },
		{ id: 'stellar', label: 'Stellar' },
		{ id: 'rotation', label: 'Rotation' },
		{ id: 'orbit', label: 'Orbit' },
		{ id: 'observation', label: 'Observation' },
	]
	let activeTab = $state('identity')

	type CelestialCrumb = { label: string, href: string }
	type CelestialSystemOption = { id: number, name: string }
	type CelestialStarOption = { id: number, name: string, systemId?: number | null }
	type StarRecord = {
		id?: number
		name: string
		slug: string
		spectralType?: string | null
		mass?: string | null
		massKg?: number | null
		radius?: string | null
		radiusM?: number | null
		luminosity?: string | null
		luminosityW?: number | null
		luminosityVisual?: string | null
		temperature?: string | null
		temperatureK?: number | null
		age?: string | null
		color?: string | null
		rotationPeriodS?: number | null
		axialTilt?: number | null
		orbitalPeriod?: string | null
		orbitalPeriodDays?: number | null
		semiMajorAxis?: string | null
		semiMajorAxisAu?: number | null
		eccentricity?: number | null
		epochPhase?: number | null
		periastron?: string | null
		apastron?: string | null
		apparentMagnitude?: string | null
		absoluteMagnitude?: string | null
		angularDiameter?: string | null
		metallicity?: string | null
		companion?: string | null
		systemId?: number | null
		parentStarId?: number | null
		description?: string | null
		extra?: Record<string, unknown> | null
	}

	type StarDraftSnapshot = {
		name: string
		slug: string
		spectralType: string
		massKg: number | null
		radiusM: number | null
		luminosity: string
		luminosityW: number | null
		luminosityVisual: string
		temperature: string
		temperatureK: number | null
		age: string
		color: string
		rotationPeriodS: number | null
		axialTilt: number | null
		orbitalPeriodDays: number | null
		semiMajorAxisAu: number | null
		eccentricity: number | null
		epochPhase: number | null
		apparentMagnitude: string
		absoluteMagnitude: string
		angularDiameter: string
		metallicity: string
		companion: string
		systemIdStr: string
		parentStarIdStr: string
		description: string
		content: string
	}

	function buildInitialStarDraft(starRecord: StarRecord, articleContent: string): StarDraftSnapshot {
		return {
			name: starRecord.name,
			slug: starRecord.slug,
			spectralType: starRecord.spectralType ?? '',
			massKg: starRecord.massKg ?? null,
			radiusM: starRecord.radiusM ?? null,
			luminosity: starRecord.luminosity ?? '',
			luminosityW: starRecord.luminosityW ?? null,
			luminosityVisual: starRecord.luminosityVisual ?? '',
			temperature: starRecord.temperature ?? '',
			temperatureK: starRecord.temperatureK ?? null,
			age: starRecord.age ?? '',
			color: starRecord.color ?? '',
			rotationPeriodS: starRecord.rotationPeriodS ?? null,
			axialTilt: starRecord.axialTilt ?? null,
			orbitalPeriodDays: starRecord.orbitalPeriodDays ?? null,
			semiMajorAxisAu: starRecord.semiMajorAxisAu ?? null,
			eccentricity: starRecord.eccentricity ?? null,
			epochPhase: starRecord.epochPhase ?? null,
			apparentMagnitude: starRecord.apparentMagnitude ?? '',
			absoluteMagnitude: starRecord.absoluteMagnitude ?? '',
			angularDiameter: starRecord.angularDiameter ?? '',
			metallicity: starRecord.metallicity ?? '',
			companion: starRecord.companion ?? '',
			systemIdStr: starRecord.systemId ? String(starRecord.systemId) : '',
			parentStarIdStr: starRecord.parentStarId ? String(starRecord.parentStarId) : '',
			description: starRecord.description ?? '',
			content: articleContent,
		}
	}

	let {
		star,
		allSystems,
		allStars = [],
		wikiContent,
		contentRecordId,
		parentCrumbs = [],
	}: {
		star: StarRecord
		allSystems: CelestialSystemOption[]
		allStars?: CelestialStarOption[]
		wikiContent: string
		contentRecordId: number | null
		parentCrumbs?: CelestialCrumb[]
	} = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const initialStar = $state.snapshot(untrack(() => star))
	const initialParentCrumbs = $state.snapshot(untrack(() => parentCrumbs))
	const initialWikiContent = untrack(() => wikiContent ?? '')
	const initialDraft = buildInitialStarDraft(initialStar, initialWikiContent)

	// Hydrate "lock to override" fields from the persisted `extra` overflow so the
	// override UI round-trips instead of resetting on every reload.
	const initialExtra = (initialStar.extra ?? {}) as Record<string, unknown>
	const extraString = (key: string) => (typeof initialExtra[key] === 'string' ? (initialExtra[key] as string) : null)
	const initialDensityOverride = extraString('density')
	const initialGravityOverride = extraString('surface_gravity')
	const initialEscapeOverride = extraString('escape_velocity')
	const initialLuminosityOverride = extraString('luminosity')

	// Celestial canonical URLs are flat /Celestial:Slug — parent path is for breadcrumbs only.
	const viewPath = $derived(`/Celestial:${initialStar.slug}`)

	let name = $state(initialDraft.name)
	let slug = $state(initialDraft.slug)
	let spectralType = $state(initialDraft.spectralType)
	let massKg = $state<number | null>(initialDraft.massKg)
	let radiusM = $state<number | null>(initialDraft.radiusM)
	let luminosity = $state(initialDraft.luminosity)
	let luminosityW = $state<number | null>(initialDraft.luminosityW)
	let luminosityVisual = $state(initialDraft.luminosityVisual)
	let temperature = $state(initialDraft.temperature)
	let temperatureK = $state<number | null>(initialDraft.temperatureK)
	let age = $state(initialDraft.age)
	let color = $state(initialDraft.color)

	let rotationPeriodS = $state<number | null>(initialDraft.rotationPeriodS)
	let axialTilt = $state<number | null>(initialDraft.axialTilt)

	let orbitalPeriodDays = $state<number | null>(initialDraft.orbitalPeriodDays)
	let semiMajorAxisAu = $state<number | null>(initialDraft.semiMajorAxisAu)
	let eccentricity = $state<number | null>(initialDraft.eccentricity)
	let epochPhase = $state<number | null>(initialDraft.epochPhase)

	let apparentMagnitude = $state(initialDraft.apparentMagnitude)
	let absoluteMagnitude = $state(initialDraft.absoluteMagnitude)
	let angularDiameter = $state(initialDraft.angularDiameter)
	let metallicity = $state(initialDraft.metallicity)
	let companion = $state(initialDraft.companion)

	let systemIdStr = $state(initialDraft.systemIdStr)
	let parentStarIdStr = $state(initialDraft.parentStarIdStr)
	let description = $state(initialDraft.description)

	// Lock states for overridable derived fields
	let densityUnlocked = $state(initialDensityOverride != null)
	let densityOverride = $state<string | null>(initialDensityOverride)
	let gravityUnlocked = $state(initialGravityOverride != null)
	let gravityOverride = $state<string | null>(initialGravityOverride)
	let escapeUnlocked = $state(initialEscapeOverride != null)
	let escapeOverride = $state<string | null>(initialEscapeOverride)
	let luminosityUnlocked = $state(initialLuminosityOverride != null)
	let luminosityOverride = $state<string | null>(initialLuminosityOverride)

	// Always-derived display fields
	const massDisplay = $derived(massKg ? formatMass(massKg) : null)
	const radiusDisplay = $derived(radiusM ? formatRadius(radiusM) : null)
	const tempDisplay = $derived(temperatureK ? formatTemperatureK(temperatureK) : null)

	// Auto-computed from numeric inputs
	const computedPhysical = $derived(deriveBodyFields(massKg, radiusM))
	const computedOrbital = $derived(deriveStarOrbitalFields(semiMajorAxisAu, eccentricity))
	const physicsWarnings = $derived(validateStarPhysics({ massKg, radiusM, semiMajorAxisAu, eccentricity, temperatureK, spectralType }))
	const computedDisplay = $derived(deriveDisplayStrings(orbitalPeriodDays, semiMajorAxisAu, rotationPeriodS))
	const derivedLuminosityW = $derived(
		radiusM != null && temperatureK != null && radiusM > 0 && temperatureK > 0
			? computeLuminosity(radiusM, temperatureK)
			: null,
	)
	const effectiveLuminosityW = $derived(luminosityW ?? derivedLuminosityW)
	const derivedLuminosityLabel = $derived(effectiveLuminosityW != null ? formatLuminosity(effectiveLuminosityW) : null)
	const habitableZone = $derived(effectiveLuminosityW != null ? computeHabitableZoneAu(effectiveLuminosityW) : null)

	let content = $state(initialDraft.content)
	let editSummary = $state('')

	// Preset population
	const starPresets = getStarPresets()
	const presetItems = [
		{ value: '', label: 'Choose a star...' },
		...[...starPresets.keys()].map(name => ({ value: name, label: name })),
	]
	let selectedPreset = $state('')

	function applyPreset(preset: StarPreset) {
		spectralType = preset.spectralType
		massKg = preset.massKg
		radiusM = preset.radiusM
		luminosity = preset.luminosity
		luminosityW = preset.luminosityW ?? null
		temperature = preset.temperature
		temperatureK = preset.temperatureK ?? null
		age = preset.age
		color = preset.color
		apparentMagnitude = preset.apparentMagnitude
		// Reset lock states — preset values are canonical
		densityUnlocked = false
		densityOverride = null
		gravityUnlocked = false
		gravityOverride = null
		escapeUnlocked = false
		escapeOverride = null
		luminosityUnlocked = false
		luminosityOverride = null
	}

	let saving = $state(false)
	let saveError = $state('')
	let savedAt = $state<Date | null>(null)
	// initialSnapshot MUST mirror currentSnapshot's exact key set and order, or the
	// form reads as permanently dirty and the unsaved-changes guard fires on exit.
	let initialSnapshot = JSON.stringify({
		name: initialDraft.name,
		slug: initialDraft.slug,
		spectralType: initialDraft.spectralType,
		massKg: initialDraft.massKg,
		radiusM: initialDraft.radiusM,
		luminosityW: initialDraft.luminosityW,
		luminosityVisual: initialDraft.luminosityVisual,
		temperatureK: initialDraft.temperatureK,
		age: initialDraft.age,
		color: initialDraft.color,
		rotationPeriodS: initialDraft.rotationPeriodS,
		axialTilt: initialDraft.axialTilt,
		orbitalPeriodDays: initialDraft.orbitalPeriodDays,
		semiMajorAxisAu: initialDraft.semiMajorAxisAu,
		eccentricity: initialDraft.eccentricity,
		epochPhase: initialDraft.epochPhase,
		apparentMagnitude: initialDraft.apparentMagnitude,
		absoluteMagnitude: initialDraft.absoluteMagnitude,
		angularDiameter: initialDraft.angularDiameter,
		metallicity: initialDraft.metallicity,
		companion: initialDraft.companion,
		systemIdStr: initialDraft.systemIdStr,
		parentStarIdStr: initialDraft.parentStarIdStr,
		description: initialDraft.description,
		densityUnlocked: initialDensityOverride != null, densityOverride: initialDensityOverride,
		gravityUnlocked: initialGravityOverride != null, gravityOverride: initialGravityOverride,
		escapeUnlocked: initialEscapeOverride != null, escapeOverride: initialEscapeOverride,
		luminosityUnlocked: initialLuminosityOverride != null, luminosityOverride: initialLuminosityOverride,
		content: initialDraft.content,
	})
	const currentSnapshot = $derived(JSON.stringify({
		name,
		slug,
		spectralType,
		massKg,
		radiusM,
		luminosityW,
		luminosityVisual,
		temperatureK,
		age,
		color,
		rotationPeriodS,
		axialTilt,
		orbitalPeriodDays,
		semiMajorAxisAu,
		eccentricity,
		epochPhase,
		apparentMagnitude,
		absoluteMagnitude,
		angularDiameter,
		metallicity,
		companion,
		systemIdStr,
		parentStarIdStr,
		description,
		densityUnlocked, densityOverride,
		gravityUnlocked, gravityOverride,
		escapeUnlocked, escapeOverride,
		luminosityUnlocked, luminosityOverride,
		content,
	}))
	const isDirty = $derived(currentSnapshot !== initialSnapshot || editSummary.trim().length > 0)
	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)
	const validationIssues = $derived.by(() => {
		const parsed = updateStarSchema.safeParse({
			spectralType: spectralType || null,
			massKg,
			radiusM,
			luminosity: luminosity || null,
			luminosityVisual: luminosityVisual || null,
			temperature: temperature || null,
			age: age || null,
			color: color || null,
			semiMajorAxisAu,
			eccentricity,
			epochPhase,
			apparentMagnitude: apparentMagnitude || null,
			angularDiameter: angularDiameter || null,
			companion: companion || null,
			systemId: systemIdStr ? Number(systemIdStr) : null,
			parentStarId: parentStarIdStr ? Number(parentStarIdStr) : null,
			description,
		})

		if (parsed.success) return []
		return summarizeZodIssues(parsed.error)
	})

	const systemItems = $derived<Array<{ value: string, label: string }>>([
		{ value: '', label: 'None' },
		...allSystems.map(system => ({ value: String(system.id), label: system.name })),
	])

	// A companion star orbits another star in the same system; you can't be your own
	// parent, and the pair must share a system.
	const parentStarItems = $derived<Array<{ value: string, label: string }>>([
		{ value: '', label: 'None (primary star)' },
		...allStars
			.filter(option => option.id !== initialStar.id)
			.filter(option => (systemIdStr ? String(option.systemId ?? '') === systemIdStr : false))
			.map(option => ({ value: String(option.id), label: option.name })),
	])

	// Clear an orphaned parent selection when the system changes out from under it.
	$effect(() => {
		if (!parentStarIdStr) return
		if (!parentStarItems.some(item => item.value === parentStarIdStr)) parentStarIdStr = ''
	})

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})

	function resetDraft() {
		name = initialDraft.name
		slug = initialDraft.slug
		spectralType = initialDraft.spectralType
		massKg = initialDraft.massKg
		radiusM = initialDraft.radiusM
		luminosity = initialDraft.luminosity
		luminosityW = initialDraft.luminosityW
		luminosityVisual = initialDraft.luminosityVisual
		temperature = initialDraft.temperature
		temperatureK = initialDraft.temperatureK
		age = initialDraft.age
		color = initialDraft.color
		rotationPeriodS = initialDraft.rotationPeriodS
		axialTilt = initialDraft.axialTilt
		orbitalPeriodDays = initialDraft.orbitalPeriodDays
		semiMajorAxisAu = initialDraft.semiMajorAxisAu
		eccentricity = initialDraft.eccentricity
		epochPhase = initialDraft.epochPhase
		apparentMagnitude = initialDraft.apparentMagnitude
		absoluteMagnitude = initialDraft.absoluteMagnitude
		angularDiameter = initialDraft.angularDiameter
		metallicity = initialDraft.metallicity
		companion = initialDraft.companion
		systemIdStr = initialDraft.systemIdStr
		parentStarIdStr = initialDraft.parentStarIdStr
		description = initialDraft.description
		content = initialDraft.content
		densityUnlocked = initialDensityOverride != null
		densityOverride = initialDensityOverride
		gravityUnlocked = initialGravityOverride != null
		gravityOverride = initialGravityOverride
		escapeUnlocked = initialEscapeOverride != null
		escapeOverride = initialEscapeOverride
		luminosityUnlocked = initialLuminosityOverride != null
		luminosityOverride = initialLuminosityOverride
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
			const res = await fetch(`/api/stars/${initialStar.slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					spectralType: spectralType || null,
					massKg,
					mass: massDisplay,
					radiusM,
					radius: radiusDisplay,
					density: densityUnlocked ? densityOverride : null,
					surfaceGravity: gravityUnlocked ? gravityOverride : null,
					escapeVelocity: escapeUnlocked ? escapeOverride : null,
					luminosity: luminosityUnlocked ? luminosityOverride : null,
					luminosityW,
					luminosityVisual: luminosityVisual || null,
					temperature: tempDisplay,
					temperatureK,
					age: age || null,
					color: color || null,
					rotationPeriodS,
					axialTilt,
					orbitalPeriodDays,
					semiMajorAxisAu,
					eccentricity,
					epochPhase,
					apparentMagnitude: apparentMagnitude || null,
					absoluteMagnitude: absoluteMagnitude || null,
					angularDiameter: angularDiameter || null,
					metallicity: metallicity || null,
					companion: companion || null,
					systemId: systemIdStr ? Number(systemIdStr) : null,
					description,
				}),
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				saveError = body.error || 'Failed to save properties'
				pushError(saveError)
				return
			}

			const saved = await res.json().catch(() => null)
			if (saved?.slug && saved.slug !== initialStar.slug) {
				slug = saved.slug
				globalThis.history.replaceState({}, '', globalThis.location.pathname.replace(initialStar.slug, saved.slug))
			}

			savedAt = new Date()
			initialSnapshot = currentSnapshot
			editSummary = ''
			pushSuccess('Star saved')
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

	async function deleteStar() {
		const ok = await confirmDialog.confirm(
			'Delete star',
			`Delete "${initialStar.name}"? This cannot be undone and may affect child records.`,
			'Delete Star',
			'Cancel',
		)
		if (!ok) return

		const response = await fetch(`/api/stars/${initialStar.slug}`, { method: 'DELETE' })
		if (!response.ok) {
			const body = await response.json().catch(() => ({}))
			pushError(body.error || 'Failed to delete star')
			return
		}

		pushSuccess('Star deleted')
		goto(initialParentCrumbs.at(-1)?.href ?? '/celestial')
	}
</script>

<ArticleShell
	breadcrumbs={celestialConfigureBreadcrumbs(initialParentCrumbs, { name: initialStar.name, slug: initialStar.slug })}
	title="Configure {initialStar.name}"
>
	<UnsavedChangesGuard when={isDirty && !saving} />
	<div class="space-y-6">
		<div class="flex items-center justify-between gap-3 bg-surface border border-border px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold text-heading">Configure Record</h2>
				<p class="text-xs text-faint">Structured star properties and article content are managed here.</p>
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
					const preset = starPresets.get(selectedPreset)
					if (preset) applyPreset(preset)
				}}
				class="px-4 py-2 text-sm border border-accent-border text-accent hover:bg-accent-subtle disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Apply
			</button>
		</section>

		{#if saveError}
			<FormNotice title="Star changes were not saved" message={saveError} />
		{/if}
		{#if validationIssues.length > 0}
			<FormNotice tone="warning" title="Star draft needs attention" messages={validationIssues} />
		{/if}
		{#if physicsWarnings.length > 0}
			<FormNotice
				tone="warning"
				title="Physics plausibility"
				messages={physicsWarnings.map(w => `${w.severity === 'impossible' ? '🚫' : '⚠️'} ${w.message}`)}
			/>
		{/if}
		<TabNavigation navItems={starTabs} bind:activeSectionId={activeTab} fullWidth size="sm" />

		{#if activeTab === 'identity'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Input label="Name" bind:value={name} placeholder="Star name" />
					<DerivedField label="Slug" value={slug} hint="URL identifier. Changes when the star is renamed." />
					<Select label="System" type="single" bind:value={systemIdStr} items={systemItems} />
					<Input label="Color" bind:value={color} placeholder="Yellow-white" hint="Descriptive color name used for map rendering. Examples: yellow-white, orange-red, blue-white." />
				</div>
				<Input label="Description" bind:value={description} placeholder="Brief description..." />
			</section>
		{:else if activeTab === 'stellar'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Input label="Spectral Type" bind:value={spectralType} placeholder="G2V" hint="Morgan-Keenan classification. Letter = temperature class (O B A F G K M), number = subclass, roman numeral = luminosity class. The Sun is G2V." />
					<Input label="Mass (kg)" type="number" bind:value={massKg} step="any" placeholder="1.989e30" hint="Total mass in kilograms. The Sun is 1.989 × 10³⁰ kg. Used by orbiting bodies to derive orbital periods via Kepler's law." />
					<DerivedField label="Mass" value={massDisplay} hint="Auto-formatted from the numeric mass value. Shows Solar reference units." />
					<Input label="Radius (m)" type="number" bind:value={radiusM} step="any" placeholder="696340000" hint="Mean radius in metres. The Sun is 696,340,000 m." />
					<DerivedField label="Radius" value={radiusDisplay} hint="Auto-formatted from the numeric radius value. Shows Solar reference units." />
					<LockableDerivedField label="Density" derivedValue={computedPhysical.density} bind:value={densityOverride} bind:unlocked={densityUnlocked} hint="Mass / volume. Derived from mass and radius. Lock to override." />
					<LockableDerivedField label="Surface Gravity" derivedValue={computedPhysical.surfaceGravity} bind:value={gravityOverride} bind:unlocked={gravityUnlocked} hint="GM/r². Derived from mass and radius. The Sun is 274 m/s²." />
					<LockableDerivedField label="Escape Velocity" derivedValue={computedPhysical.escapeVelocity} bind:value={escapeOverride} bind:unlocked={escapeUnlocked} hint="√(2GM/r). The Sun is 617.7 km/s." />
					<Input label="Temperature (K)" type="number" bind:value={temperatureK} step="any" placeholder="5778" hint="Effective surface temperature in Kelvin. The Sun is 5,778 K. Used with radius to derive luminosity via Stefan-Boltzmann law." />
					<DerivedField label="Temperature" value={tempDisplay} hint="Auto-formatted from the numeric Kelvin value." />
					<LockableDerivedField label="Luminosity{!luminosityUnlocked && derivedLuminosityW ? ' (Stefan-Boltzmann)' : ''}" derivedValue={derivedLuminosityLabel} bind:value={luminosityOverride} bind:unlocked={luminosityUnlocked} hint="L = 4πR²σT⁴. Derived from radius and temperature. The Sun is 1.0 L☉. Lock to set a custom value for magically dim/bright stars." />
					<Input label="Visual Luminosity" bind:value={luminosityVisual} placeholder="1.0 L☉ (visual)" hint="Luminosity in the visible spectrum only. Can differ from bolometric luminosity for very hot or cool stars." />
					{#if habitableZone}
						<DerivedField label="Habitable Zone" value="{habitableZone.inner.toFixed(2)} – {habitableZone.outer.toFixed(2)} AU" hint="Conservative HZ from luminosity: inner = √(L/1.1), outer = √(L/0.53). Where liquid water could exist on a rocky planet." />
					{/if}
					<Input label="Metallicity" bind:value={metallicity} placeholder="[Fe/H] = 0.0" hint="Metal content relative to the Sun. [Fe/H] = 0 is solar. Higher values mean more metals, increasing rocky planet likelihood." />
					<Input label="Age" bind:value={age} placeholder="~4.6 billion years" hint="Estimated age. Free text." />
					<Input label="Color" bind:value={color} placeholder="Yellow-white" hint="Descriptive color name used for map rendering. Examples: yellow-white, orange-red, blue-white." />
				</div>
			</section>
		{:else if activeTab === 'rotation'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Input label="Rotation Period (seconds)" type="number" bind:value={rotationPeriodS} step="any" placeholder="2160000" hint="Sidereal rotation period in seconds. The Sun's equatorial period is ~25.05 days (2,164,320 s). Stars rotate differentially." />
					<DerivedField label="Rotation Period" value={computedDisplay.rotationPeriod} hint="Human-readable rotation period, formatted from the seconds value." />
					<Input label="Axial Tilt (deg)" type="number" bind:value={axialTilt} step="any" placeholder="7.25" hint="Angle between the rotational axis and the ecliptic. The Sun is 7.25°." />
				</div>
			</section>
		{:else if activeTab === 'orbit'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<p class="text-xs text-faint">For binary or multiple star systems. Leave blank for single stars.</p>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Select
						label="Orbits Star"
						type="single"
						bind:value={parentStarIdStr}
						items={parentStarItems}
					/>
					<Input label="Companion" bind:value={companion} placeholder="Binary partner name" hint="Display name of the binary partner, shown in the infobox. The orbital hierarchy itself is set by the “Orbits Star” field." />
					<Input label="Orbital Period (days)" type="number" bind:value={orbitalPeriodDays} step="any" placeholder="79.91" hint="Orbital period in days for binary/multiple systems. Leave blank to auto-derive from semi-major axis and combined mass." />
					<DerivedField label="Orbital Period" value={computedDisplay.orbitalPeriod} hint="Human-readable period, formatted from the days value." />
					<Input label="Semi-major Axis (AU)" type="number" bind:value={semiMajorAxisAu} step="any" placeholder="23.4" hint="Half the longest diameter of the binary orbit, in AU. Determines the orbit size on the system map." error={semiMajorAxisAu !== null && semiMajorAxisAu < 0 ? 'Must be 0 or greater' : ''} />
					<DerivedField label="Semi-major Axis" value={computedDisplay.semiMajorAxis} hint="Same distance converted to kilometres." />
					<Input label="Eccentricity" type="number" bind:value={eccentricity} step="any" min={0} max={1} placeholder="0.0" hint="How elliptical the binary orbit is. 0 = circular, approaching 1 = extremely elongated." error={eccentricity !== null && (eccentricity < 0 || eccentricity > 1) ? 'Use a value from 0 to 1' : ''} />
					<Input label="Epoch Phase" type="number" bind:value={epochPhase} step="any" min={0} max={1} placeholder="0.0" hint="Position along the orbit at day 0 (0–1). Used for map animation." error={epochPhase !== null && (epochPhase < 0 || epochPhase > 1) ? 'Use a value from 0 to 1' : ''} />
					<DerivedField label="Periastron" value={computedOrbital.periastron} hint="Closest approach: a × (1 − e). The near point of the binary orbit." />
					<DerivedField label="Apastron" value={computedOrbital.apastron} hint="Farthest separation: a × (1 + e). The far point of the binary orbit." />
				</div>
			</section>
		{:else if activeTab === 'observation'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Input label="Apparent Magnitude" bind:value={apparentMagnitude} placeholder="-26.74" hint="Brightness as seen from a reference point. Lower = brighter. The Sun seen from Earth is -26.74." />
					<Input label="Absolute Magnitude" bind:value={absoluteMagnitude} placeholder="4.83" hint="Intrinsic brightness at a standard distance of 10 parsecs. The Sun is 4.83." />
					<Input label="Angular Diameter" bind:value={angularDiameter} placeholder="31.46 arcmin" hint="Apparent size in the sky from a reference point. The Sun is ~31.5 arcminutes from Earth." />
				</div>
			</section>
		{/if}

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

		{#if permissions.canManageSettings}
			<section class="border border-error-border bg-error-subtle/40 p-5 space-y-3">
				<div>
					<h2 class="text-sm font-semibold text-error">Danger Zone</h2>
					<p class="text-xs text-faint mt-1">Delete this star record. Child records that depend on it may also be affected.</p>
				</div>
				<div>
					<button
						type="button"
						onclick={deleteStar}
						class="px-4 py-2 text-sm border border-error-border text-error hover:bg-error-subtle"
					>
						Delete Star
					</button>
				</div>
			</section>
		{/if}
	</div>
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
