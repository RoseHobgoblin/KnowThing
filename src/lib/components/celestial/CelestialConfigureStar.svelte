<script lang="ts">
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

	let {
		star,
		allSystems,
		wikiContent,
		contentRecordId,
		parentCrumbs,
	}: {
		star: Record<string, any>
		allSystems: { id: number, name: string }[]
		wikiContent: string
		contentRecordId: number | null
		parentCrumbs: { label: string, href: string }[]
	} = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const viewPath = parentCrumbs.length > 0
		? `${parentCrumbs.at(-1)!.href}/${star.slug}`
		: `/celestial/${star.slug}`

	// ── Form state (scalars) ────────────────────────────────
	let spectralType = $state(star.spectralType ?? '')
	let mass = $state(star.mass ?? '')
	let radius = $state(star.radius ?? '')
	let luminosity = $state(star.luminosity ?? '')
	let luminosityVisual = $state(star.luminosityVisual ?? '')
	let temperature = $state(star.temperature ?? '')
	let age = $state(star.age ?? '')
	let color = $state(star.color ?? '')

	let orbitalPeriod = $state(star.orbitalPeriod ?? '')
	let semiMajorAxis = $state(star.semiMajorAxis ?? '')
	let semiMajorAxisAu = $state<number | null>(star.semiMajorAxisAu ?? null)
	let eccentricity = $state<number | null>(star.eccentricity ?? null)
	let epochPhase = $state<number | null>(star.epochPhase ?? null)
	let periastron = $state(star.periastron ?? '')
	let apastron = $state(star.apastron ?? '')

	let apparentMagnitude = $state(star.apparentMagnitude ?? '')
	let angularDiameter = $state(star.angularDiameter ?? '')
	let companion = $state(star.companion ?? '')

	let systemIdStr = $state(star.systemId ? String(star.systemId) : '')
	let description = $state(star.description ?? '')

	// ── Wiki content ────────────────────────────────────────
	let content = $state(wikiContent ?? '')
	let editSummary = $state('')

	// ── Save state ──────────────────────────────────────────
	let saving = $state(false)
	let saveError = $state('')
	let savedAt = $state<Date | null>(null)
	const initialSnapshot = JSON.stringify({
		spectralType: star.spectralType ?? '',
		mass: star.mass ?? '',
		radius: star.radius ?? '',
		luminosity: star.luminosity ?? '',
		luminosityVisual: star.luminosityVisual ?? '',
		temperature: star.temperature ?? '',
		age: star.age ?? '',
		color: star.color ?? '',
		orbitalPeriod: star.orbitalPeriod ?? '',
		semiMajorAxis: star.semiMajorAxis ?? '',
		semiMajorAxisAu: star.semiMajorAxisAu ?? null,
		eccentricity: star.eccentricity ?? null,
		epochPhase: star.epochPhase ?? null,
		periastron: star.periastron ?? '',
		apastron: star.apastron ?? '',
		apparentMagnitude: star.apparentMagnitude ?? '',
		angularDiameter: star.angularDiameter ?? '',
		companion: star.companion ?? '',
		systemId: star.systemId ? String(star.systemId) : '',
		description: star.description ?? '',
		content: wikiContent ?? '',
	})
	const currentSnapshot = $derived(JSON.stringify({
		spectralType, mass, radius, luminosity, luminosityVisual, temperature, age, color,
		orbitalPeriod, semiMajorAxis, semiMajorAxisAu, eccentricity, epochPhase, periastron, apastron,
		apparentMagnitude, angularDiameter, companion, systemId: systemIdStr, description, content,
	}))
	const isDirty = $derived(currentSnapshot !== initialSnapshot || editSummary.trim().length > 0)
	const permissions = $derived($page.data.permissions)
	const validationIssues = $derived.by(() => {
		const issues: string[] = []
		if (semiMajorAxisAu !== null && semiMajorAxisAu < 0) issues.push('Semi-major axis must be zero or greater.')
		if (eccentricity !== null && (eccentricity < 0 || eccentricity > 1)) issues.push('Eccentricity must be between 0 and 1.')
		if (epochPhase !== null && (epochPhase < 0 || epochPhase > 1)) issues.push('Epoch phase must be between 0 and 1.')
		return issues
	})

	const systemItems = $derived([
		{ value: '', label: 'None' },
		...allSystems.map(s => ({ value: String(s.id), label: s.name })),
	])

	function resetDraft() {
		spectralType = star.spectralType ?? ''
		mass = star.mass ?? ''
		radius = star.radius ?? ''
		luminosity = star.luminosity ?? ''
		luminosityVisual = star.luminosityVisual ?? ''
		temperature = star.temperature ?? ''
		age = star.age ?? ''
		color = star.color ?? ''
		orbitalPeriod = star.orbitalPeriod ?? ''
		semiMajorAxis = star.semiMajorAxis ?? ''
		semiMajorAxisAu = star.semiMajorAxisAu ?? null
		eccentricity = star.eccentricity ?? null
		epochPhase = star.epochPhase ?? null
		periastron = star.periastron ?? ''
		apastron = star.apastron ?? ''
		apparentMagnitude = star.apparentMagnitude ?? ''
		angularDiameter = star.angularDiameter ?? ''
		companion = star.companion ?? ''
		systemIdStr = star.systemId ? String(star.systemId) : ''
		description = star.description ?? ''
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
			// 1. Save structured data via PUT
			const res = await fetch(`/api/stars/${star.slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					spectralType: spectralType || null,
					mass: mass || null,
					radius: radius || null,
					luminosity: luminosity || null,
					luminosityVisual: luminosityVisual || null,
					temperature: temperature || null,
					age: age || null,
					color: color || null,
					orbitalPeriod: orbitalPeriod || null,
					semiMajorAxis: semiMajorAxis || null,
					semiMajorAxisAu,
					eccentricity,
					periastron: periastron || null,
					apastron: apastron || null,
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

			// 2. Save wiki content via form action POST
			if (contentRecordId && content !== wikiContent) {
				const formData = new FormData()
				formData.set('contentRecordId', String(contentRecordId))
				formData.set('content', content)
				formData.set('summary', editSummary)
				await fetch(window.location.pathname, { method: 'POST', body: formData })
			}

			savedAt = new Date()
			pushSuccess('Star saved')
			goto(viewPath)
		} catch {
			saveError = 'Failed to save'
			pushError('Failed to save')
		} finally {
			saving = false
		}
	}

	async function deleteStar() {
		const ok = await confirmDialog.confirm(
			'Delete star',
			`Delete "${star.name}"? This cannot be undone and may affect child records.`,
			'Delete Star',
			'Cancel',
		)
		if (!ok) return

		const response = await fetch(`/api/stars/${star.slug}`, { method: 'DELETE' })
		if (!response.ok) {
			const body = await response.json().catch(() => ({}))
			pushError(body.error || 'Failed to delete star')
			return
		}

		pushSuccess('Star deleted')
		goto(parentCrumbs.at(-1)?.href ?? '/celestial')
	}
</script>

<ArticleShell
	breadcrumbs={celestialConfigureBreadcrumbs(parentCrumbs, { name: star.name, slug: star.slug })}
	title="Configure {star.name}"
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
		{#if saveError}
			<FormNotice title="Star changes were not saved" message={saveError} />
		{/if}
		{#if validationIssues.length > 0}
			<FormNotice tone="warning" title="Star draft needs attention" messages={validationIssues} />
		{/if}
		<section class="bg-page border border-border-subtle p-5">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Current Summary</h2>
			<div class="grid grid-cols-1 gap-4 pt-3 md:grid-cols-4">
				<div>
					<div class="text-xs font-medium text-secondary">System</div>
					<div class="text-sm text-body">{systemItems.find(item => item.value === systemIdStr)?.label || 'Standalone'}</div>
				</div>
				<div>
					<div class="text-xs font-medium text-secondary">Classification</div>
					<div class="text-sm text-body">{spectralType || 'Unspecified star'}</div>
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
				<div><span class="text-xs font-medium text-secondary block mb-1">Name</span><p class="text-sm text-body">{star.name}</p></div>
				<Select label="System" type="single" bind:value={systemIdStr} items={systemItems} />
				<Input label="Color" bind:value={color} placeholder="Yellow-white" />
			</div>
			<Input label="Description" bind:value={description} placeholder="Brief description..." />
		</section>

		<!-- Stellar Properties -->
		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Stellar Properties</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Spectral Type" bind:value={spectralType} placeholder="G2V" />
				<Input label="Mass" bind:value={mass} placeholder="1.0 M☉" />
				<Input label="Radius" bind:value={radius} placeholder="1.0 R☉" />
				<Input label="Luminosity" bind:value={luminosity} placeholder="1.0 L☉" />
				<Input label="Visual Luminosity" bind:value={luminosityVisual} placeholder="1.0 L☉ (visual)" />
				<Input label="Temperature" bind:value={temperature} placeholder="5,778 K" />
				<Input label="Age" bind:value={age} placeholder="~4.6 billion years" />
			</div>
		</section>

		<!-- Orbital Parameters (for binaries) -->
		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Orbital Parameters</h2>
			<p class="text-xs text-faint">For binary/multiple star systems. Leave blank for single stars.</p>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Companion" bind:value={companion} placeholder="Binary partner name" />
				<Input label="Orbital Period" bind:value={orbitalPeriod} placeholder="79.91 years" />
				<Input label="Semi-major Axis" bind:value={semiMajorAxis} placeholder="23.4 AU" />
				<Input label="Semi-major Axis (AU)" type="number" bind:value={semiMajorAxisAu} step="any" placeholder="23.4" error={semiMajorAxisAu !== null && semiMajorAxisAu < 0 ? 'Must be 0 or greater' : ''} />
				<Input label="Eccentricity" type="number" bind:value={eccentricity} step="any" min={0} max={1} placeholder="0.0" error={eccentricity !== null && (eccentricity < 0 || eccentricity > 1) ? 'Use a value from 0 to 1' : ''} />
				<Input label="Epoch Phase" type="number" bind:value={epochPhase} step="any" placeholder="0.0" error={epochPhase !== null && (epochPhase < 0 || epochPhase > 1) ? 'Use a value from 0 to 1' : ''} />
				<Input label="Periastron" bind:value={periastron} placeholder="Closest approach" />
				<Input label="Apastron" bind:value={apastron} placeholder="Furthest distance" />
			</div>
		</section>

		<!-- Observation -->
		<section class="bg-raised border border-border-subtle p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading border-b border-border-subtle pb-2">Observation</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Apparent Magnitude" bind:value={apparentMagnitude} placeholder="-26.74" />
				<Input label="Angular Diameter" bind:value={angularDiameter} placeholder="31.46 arcmin" />
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
