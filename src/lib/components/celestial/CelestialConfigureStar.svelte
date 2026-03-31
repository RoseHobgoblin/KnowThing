<script lang="ts">
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfigureFooter from '$lib/components/ConfigureFooter.svelte'
	import { celestialConfigureBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'

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

	const systemItems = $derived([
		{ value: '', label: 'None' },
		...allSystems.map(s => ({ value: String(s.id), label: s.name })),
	])

	async function save() {
		saving = true
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
				pushError(body.error || 'Failed to save properties')
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

			pushSuccess('Star saved')
			goto(viewPath)
		} catch {
			pushError('Failed to save')
		} finally {
			saving = false
		}
	}
</script>

<ArticleShell
	breadcrumbs={celestialConfigureBreadcrumbs(parentCrumbs, { name: star.name, slug: star.slug })}
	title="Configure {star.name}"
>
	<div class="space-y-6">
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
				<Input label="Semi-major Axis (AU)" type="number" bind:value={semiMajorAxisAu} step="any" placeholder="23.4" />
				<Input label="Eccentricity" type="number" bind:value={eccentricity} step="any" min={0} max={1} placeholder="0.0" />
				<Input label="Epoch Phase" type="number" bind:value={epochPhase} step="any" placeholder="0.0" />
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
			onsave={save}
		/>
	</div>
</ArticleShell>
