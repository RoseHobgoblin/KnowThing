<script lang="ts">
	import { untrack } from 'svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
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
	import { updateStarSchema } from '$lib/celestial/schema.js'
	import { summarizeZodIssues } from '$lib/utils.js'
	import { getStarPresets, type StarPreset } from '$lib/celestial/presets.js'
	import { deriveStarOrbitalFields, deriveDisplayStrings } from '$lib/celestial/compute.js'
	import { validateStarPhysics } from '$lib/celestial/validate-physics.js'
	import TabNavigation from '$lib/components/ui/TabNavigation.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import DerivedField from '$lib/components/ui/DerivedField.svelte'

	const starTabs = [
		{ id: 'identity', label: 'Identity' },
		{ id: 'stellar', label: 'Stellar' },
		{ id: 'orbit', label: 'Orbit' },
		{ id: 'observation', label: 'Observation' },
		{ id: 'article', label: 'Article' },
	]
	let activeTab = $state('identity')

	type CelestialCrumb = { label: string, href: string }
	type CelestialSystemOption = { id: number, name: string }
	type StarRecord = {
		name: string
		slug: string
		spectralType?: string | null
		mass?: string | null
		massKg?: number | null
		radius?: string | null
		radiusM?: number | null
		luminosity?: string | null
		luminosityVisual?: string | null
		temperature?: string | null
		age?: string | null
		color?: string | null
		orbitalPeriod?: string | null
		semiMajorAxis?: string | null
		semiMajorAxisAu?: number | null
		eccentricity?: number | null
		epochPhase?: number | null
		periastron?: string | null
		apastron?: string | null
		apparentMagnitude?: string | null
		angularDiameter?: string | null
		companion?: string | null
		systemId?: number | null
		description?: string | null
	}

	type StarDraftSnapshot = {
		spectralType: string
		massKg: number | null
		radiusM: number | null
		luminosity: string
		luminosityVisual: string
		temperature: string
		age: string
		color: string
		semiMajorAxisAu: number | null
		eccentricity: number | null
		epochPhase: number | null
		apparentMagnitude: string
		angularDiameter: string
		companion: string
		systemIdStr: string
		description: string
		content: string
	}

	function buildInitialStarDraft(starRecord: StarRecord, articleContent: string): StarDraftSnapshot {
		return {
			spectralType: starRecord.spectralType ?? '',
			massKg: starRecord.massKg ?? null,
			radiusM: starRecord.radiusM ?? null,
			luminosity: starRecord.luminosity ?? '',
			luminosityVisual: starRecord.luminosityVisual ?? '',
			temperature: starRecord.temperature ?? '',
			age: starRecord.age ?? '',
			color: starRecord.color ?? '',
			semiMajorAxisAu: starRecord.semiMajorAxisAu ?? null,
			eccentricity: starRecord.eccentricity ?? null,
			epochPhase: starRecord.epochPhase ?? null,
			apparentMagnitude: starRecord.apparentMagnitude ?? '',
			angularDiameter: starRecord.angularDiameter ?? '',
			companion: starRecord.companion ?? '',
			systemIdStr: starRecord.systemId ? String(starRecord.systemId) : '',
			description: starRecord.description ?? '',
			content: articleContent,
		}
	}

	let {
		star,
		allSystems,
		wikiContent,
		contentRecordId,
		parentCrumbs,
	}: {
		star: StarRecord
		allSystems: CelestialSystemOption[]
		wikiContent: string
		contentRecordId: number | null
		parentCrumbs: CelestialCrumb[]
	} = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const initialStar = $state.snapshot(untrack(() => star))
	const initialParentCrumbs = $state.snapshot(untrack(() => parentCrumbs))
	const initialWikiContent = untrack(() => wikiContent ?? '')
	const initialDraft = buildInitialStarDraft(initialStar, initialWikiContent)

	const viewPath = $derived.by(() => initialParentCrumbs.length > 0
		? `${initialParentCrumbs.at(-1)!.href}/${initialStar.slug}`
		: `/celestial/${initialStar.slug}`)

	let spectralType = $state(initialDraft.spectralType)
	let massKg = $state<number | null>(initialDraft.massKg)
	let radiusM = $state<number | null>(initialDraft.radiusM)
	let luminosity = $state(initialDraft.luminosity)
	let luminosityVisual = $state(initialDraft.luminosityVisual)
	let temperature = $state(initialDraft.temperature)
	let age = $state(initialDraft.age)
	let color = $state(initialDraft.color)

	let semiMajorAxisAu = $state<number | null>(initialDraft.semiMajorAxisAu)
	let eccentricity = $state<number | null>(initialDraft.eccentricity)
	let epochPhase = $state<number | null>(initialDraft.epochPhase)

	// Auto-computed from numeric inputs
	const computedOrbital = $derived(deriveStarOrbitalFields(semiMajorAxisAu, eccentricity))
	const physicsWarnings = $derived(validateStarPhysics({ massKg, radiusM, semiMajorAxisAu, eccentricity }))
	const computedDisplay = $derived(deriveDisplayStrings(null, semiMajorAxisAu, null))

	let apparentMagnitude = $state(initialDraft.apparentMagnitude)
	let angularDiameter = $state(initialDraft.angularDiameter)
	let companion = $state(initialDraft.companion)

	let systemIdStr = $state(initialDraft.systemIdStr)
	let description = $state(initialDraft.description)

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
		temperature = preset.temperature
		age = preset.age
		color = preset.color
		apparentMagnitude = preset.apparentMagnitude
	}

	let saving = $state(false)
	let saveError = $state('')
	let savedAt = $state<Date | null>(null)
	let initialSnapshot = JSON.stringify(initialDraft)
	const currentSnapshot = $derived(JSON.stringify({
		spectralType,
		massKg,
		radiusM,
		luminosity,
		luminosityVisual,
		temperature,
		age,
		color,
		semiMajorAxisAu,
		eccentricity,
		epochPhase,
		apparentMagnitude,
		angularDiameter,
		companion,
		systemIdStr,
		description,
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
			description,
		})

		if (parsed.success) return []
		return summarizeZodIssues(parsed.error)
	})

	const systemItems = $derived<Array<{ value: string, label: string }>>([
		{ value: '', label: 'None' },
		...allSystems.map(system => ({ value: String(system.id), label: system.name })),
	])

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})

	function resetDraft() {
		spectralType = initialDraft.spectralType
		massKg = initialDraft.massKg
		radiusM = initialDraft.radiusM
		luminosity = initialDraft.luminosity
		luminosityVisual = initialDraft.luminosityVisual
		temperature = initialDraft.temperature
		age = initialDraft.age
		color = initialDraft.color
		semiMajorAxisAu = initialDraft.semiMajorAxisAu
		eccentricity = initialDraft.eccentricity
		epochPhase = initialDraft.epochPhase
		apparentMagnitude = initialDraft.apparentMagnitude
		angularDiameter = initialDraft.angularDiameter
		companion = initialDraft.companion
		systemIdStr = initialDraft.systemIdStr
		description = initialDraft.description
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
			const res = await fetch(`/api/stars/${initialStar.slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
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
					description,
				}),
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				saveError = body.error || 'Failed to save properties'
				pushError(saveError)
				return
			}

			if (content !== initialWikiContent) {
				if (!contentRecordId) {
					saveError = 'Article content is not attached to this star yet. Reload and try again.'
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
					<div><span class="text-xs font-medium text-secondary block mb-1">Name</span><p class="text-sm text-body">{initialStar.name}</p></div>
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
					<Input label="Radius (m)" type="number" bind:value={radiusM} step="any" placeholder="696340000" hint="Mean radius in metres. The Sun is 696,340,000 m." />
					<Input label="Luminosity" bind:value={luminosity} placeholder="1.0 solar luminosities" hint="Total energy output. Free text — include units. Used for habitable zone calculations." />
					<Input label="Visual Luminosity" bind:value={luminosityVisual} placeholder="1.0 solar luminosities (visual)" hint="Luminosity in the visible spectrum only. Can differ from bolometric luminosity for very hot or cool stars." />
					<Input label="Temperature" bind:value={temperature} placeholder="5,778 K" hint="Effective surface temperature. The Sun is 5,778 K. Free text — include units." />
					<Input label="Age" bind:value={age} placeholder="~4.6 billion years" hint="Estimated age. Free text." />
				</div>
			</section>
		{:else if activeTab === 'orbit'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<p class="text-xs text-faint">For binary or multiple star systems. Leave blank for single stars.</p>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Input label="Companion" bind:value={companion} placeholder="Binary partner name" hint="Display name of the binary partner. Informational only — the actual orbital relationship is set via the parent star field." />
					<Input label="Semi-major Axis (AU)" type="number" bind:value={semiMajorAxisAu} step="any" placeholder="23.4" hint="Half the longest diameter of the binary orbit, in AU. Determines the orbit size on the system map." error={semiMajorAxisAu !== null && semiMajorAxisAu < 0 ? 'Must be 0 or greater' : ''} />
					<Input label="Eccentricity" type="number" bind:value={eccentricity} step="any" min={0} max={1} placeholder="0.0" hint="How elliptical the binary orbit is. 0 = circular, approaching 1 = extremely elongated." error={eccentricity !== null && (eccentricity < 0 || eccentricity > 1) ? 'Use a value from 0 to 1' : ''} />
					<Input label="Epoch Phase" type="number" bind:value={epochPhase} step="any" min={0} max={1} placeholder="0.0" hint="Position along the orbit at day 0 (0–1). Used for map animation." error={epochPhase !== null && (epochPhase < 0 || epochPhase > 1) ? 'Use a value from 0 to 1' : ''} />
					<DerivedField label="Semi-major Axis" value={computedDisplay.semiMajorAxis} hint="Same distance converted to kilometres." />
					<DerivedField label="Periastron" value={computedOrbital.periastron} hint="Closest approach: a × (1 − e). The near point of the binary orbit." />
					<DerivedField label="Apastron" value={computedOrbital.apastron} hint="Farthest separation: a × (1 + e). The far point of the binary orbit." />
				</div>
			</section>
		{:else if activeTab === 'observation'}
			<section class="bg-raised border border-border-subtle p-5 space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Input label="Apparent Magnitude" bind:value={apparentMagnitude} placeholder="-26.74" hint="Brightness as seen from a reference point. Lower = brighter. The Sun seen from Earth is -26.74." />
					<Input label="Angular Diameter" bind:value={angularDiameter} placeholder="31.46 arcmin" hint="Apparent size in the sky from a reference point. The Sun is ~31.5 arcminutes from Earth." />
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
