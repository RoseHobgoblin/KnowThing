<script lang="ts">
	import type { PageData } from './$types.js'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import { page } from '$app/stores'
	import InfoboxStar from '$lib/infoboxes/InfoboxStar.svelte'
	import InfoboxPlanet from '$lib/infoboxes/InfoboxPlanet.svelte'
	import InfoboxSystem from '$lib/infoboxes/InfoboxSystem.svelte'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'

	let { data }: { data: PageData } = $props()

	const kind = data.kind
	const isAdmin = data.isAdmin
	const isEditMode = data.isEditMode
	const raw = data.body as any
	const ast = data.ast as import('$lib/parser/types.js').WikiNode | null

	const layoutData = $derived($page.data)

	createKnowContext({
		existingPages: new Set(layoutData.existingPages || []),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: layoutData.calendarDate ?? null,
	})

	// Edit mode state
	let content = $state(data.wikiContent ?? '')
	let showPreview = $state(true)

	// Build the current path without /edit for cancel link
	const viewPath = $derived($page.url.pathname.replace(/\/edit$/, ''))
	const editPath = $derived(viewPath + '/edit')

	// Build FieldMaps from structured data for infobox rendering
	function buildFields(body: any, fieldDefs: [string, string[]][]): Map<string, string> {
		const fields = new Map<string, string>()
		for (const [key, aliases] of fieldDefs) {
			for (const alias of aliases) {
				const val = body[alias]
				if (val != null && val !== '') {
					fields.set(key, String(val))
					break
				}
			}
		}
		const extra = body.extra as Record<string, unknown> | undefined
		if (extra) {
			for (const [k, v] of Object.entries(extra)) {
				if (v != null && v !== '') fields.set(k, String(v))
			}
		}
		return fields
	}

	const starFieldDefs: [string, string[]][] = [
		['name', ['name']], ['spectral_type', ['spectralType', 'spectral_type']],
		['mass', ['mass']], ['radius', ['radius']], ['luminosity', ['luminosity']],
		['luminosity_visual', ['luminosityVisual', 'luminosity_visual']],
		['temperature', ['temperature']], ['age', ['age']], ['color', ['color']],
		['orbital_period', ['orbitalPeriod', 'orbital_period']],
		['orbital_semimajor', ['semiMajorAxis', 'semi_major_axis']],
		['orbital_eccentricity', ['eccentricity']],
		['periastron', ['periastron']], ['apastron', ['apastron']],
		['apparent_magnitude', ['apparentMagnitude', 'apparent_magnitude']],
		['angular_diameter', ['angularDiameter', 'angular_diameter']],
		['companion', ['companion']],
	]

	const planetFieldDefs: [string, string[]][] = [
		['name', ['name']], ['body_type', ['bodyType', 'body_type']],
		['mass', ['mass']], ['radius', ['radius']], ['density', ['density']],
		['surface_gravity', ['surfaceGravity', 'surface_gravity']],
		['escape_velocity', ['escapeVelocity', 'escape_velocity']],
		['temperature', ['temperature']], ['age', ['age']],
		['composition', ['composition']], ['atmosphere', ['atmosphere']],
		['surface_pressure', ['surfacePressure', 'surface_pressure']],
		['orbital_period', ['orbitalPeriod', 'orbital_period']],
		['semi_major_axis', ['semiMajorAxis', 'semi_major_axis']],
		['eccentricity', ['eccentricity']],
		['rotation_period', ['rotationPeriod', 'rotation_period']],
		['axial_tilt', ['axialTilt', 'axial_tilt']],
		['apparent_magnitude', ['apparentMagnitude', 'apparent_magnitude']],
		['angular_diameter', ['angularDiameter', 'angular_diameter']],
		['albedo', ['albedo']], ['satellites', ['satellites']],
	]

	const infoboxFields = $derived(
		kind === 'star' ? buildFields(raw, starFieldDefs) :
		kind === 'planet' ? buildFields(raw, planetFieldDefs) :
		new Map([['name', raw.name ?? ''], ['system_type', raw.systemType ?? raw.system_type ?? '']]),
	)
</script>

<svelte:head>
	<title>{isEditMode ? 'Editing ' : ''}{raw.name} — Celestial — KnowThing</title>
</svelte:head>

{#if isEditMode}
	<!-- EDIT MODE -->
	<div>
		<form method="POST" class="flex flex-col h-[calc(100vh-5rem)]">
			<input type="hidden" name="content" value={content} />
			<input type="hidden" name="contentRecordId" value={data.contentRecordId ?? ''} />

			<!-- Top bar -->
			<div class="flex items-center justify-between px-6 py-2 bg-surface border-b border-border">
				<h1 class="text-sm font-bold text-secondary truncate">
					Editing: <span class="text-heading">{raw.name}</span>
				</h1>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (showPreview = !showPreview)}
						class="px-3 py-1 border border-border text-xs text-secondary hover:bg-raised {showPreview ? 'bg-accent-subtle border-accent-border text-accent' : ''}"
					>
						{showPreview ? 'Hide preview' : 'Show preview'}
					</button>
				</div>
			</div>

			<!-- Editor + Preview -->
			<div class="flex-1 flex flex-col min-h-0 md:flex-row">
				<div class="flex-1 min-h-0 min-w-0 overflow-hidden {showPreview ? 'h-1/2 md:h-auto' : ''}">
					<Editor value={data.wikiContent ?? ''} onchange={v => (content = v)} />
				</div>

				{#if showPreview}
					<div class="w-full h-1/2 border-l border-border bg-surface flex flex-col min-h-0 shrink-0 md:w-[45%] md:max-w-2xl md:h-auto">
						<div class="bg-raised px-6 py-1.5 text-xs font-medium text-faint border-b border-border-subtle uppercase tracking-wide">Preview</div>
						<div class="flex-1 overflow-y-auto px-6 py-4">
							<LivePreview {content} />
						</div>
					</div>
				{/if}
			</div>

			<!-- Bottom bar -->
			<div class="flex flex-col items-stretch gap-2 px-6 py-2.5 bg-surface border-t border-border sm:flex-row sm:items-center sm:gap-3">
				<input
					name="summary"
					type="text"
					placeholder="Edit summary (optional)"
					class="flex-1 border border-border px-3 py-2 text-sm bg-page text-body focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-border"
				/>
				<div class="flex gap-2">
					<button type="submit" class="flex-1 bg-accent text-accent-text px-5 py-2 font-medium transition-colors text-sm sm:flex-none hover:bg-accent-hover">Save</button>
					<a href={viewPath} class="flex-1 text-center px-5 py-2 border border-border text-secondary text-sm sm:flex-none hover:bg-raised">Cancel</a>
				</div>
			</div>
		</form>
	</div>
{:else}
	<!-- VIEW MODE -->
	<div class="max-w-4xl mx-auto">
		<div class="px-4 pt-4 md:px-6">
			<div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
				<div>
					<a href="/celestial" class="text-[10px] font-semibold text-faint uppercase tracking-wider hover:text-link transition-colors">Celestial Registry</a>
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

		<div class="px-4 pt-3 pb-4 md:px-6 md:pb-5">
			<article class="know-article">
				{#if kind === 'system'}
					<InfoboxSystem fields={infoboxFields} />
				{:else if kind === 'star'}
					<InfoboxStar fields={infoboxFields} />
				{:else}
					<InfoboxPlanet fields={infoboxFields} />
				{/if}

				{#if ast}
					<WikiNodeComponent node={ast} />
				{:else if !data.wikiContent}
					<p class="text-dim italic mt-4">No article content yet.</p>
				{/if}
			</article>
		</div>
	</div>
{/if}
