<script lang="ts">
	import RodderSurfacePreview from '$lib/feature/rodder/components/RodderSurfacePreview.svelte'
	import CoverageInput from '$lib/components/ui/CoverageInput.svelte'
	import type { MapBody } from '$lib/feature/rodder/root-layout.js'

	let surfaceWater = $state<number | null>(0.55)
	let cloudCoverage = $state<number | null>(0.48)
	let vegetationCoverage = $state<number | null>(0.62)
	let snowCoverage = $state<number | null>(0.14)
	let seed = $state(436)
	let previewKind = $state<'planet' | 'star'>('planet')

	const body = $derived<MapBody>({
		id: 100,
		name: 'Saxnat',
		slug: 'saxnat',
		bodyType: 'planet',
		temperatureK: 288,
		surface: {
			version: 5,
			fallback: 'procedural',
			class: 'terrestrial',
			seed,
			coverage: { surfaceWater, vegetation: vegetationCoverage, permanentSnowIce: snowCoverage },
			maps: {},
		},
		weather: {
			version: 1,
			clouds: { mode: 'procedural', meanCover: cloudCoverage, seed: null },
		},
	})
	const star = $derived<MapBody>({
		id: 101,
		name: 'Therne',
		slug: 'therne',
		bodyType: 'star',
		isStar: true,
		spectralType: 'M3V',
		temperatureK: 3_400,
		rotationPeriodS: 2_160_000,
		color: '#B33000',
		stellarSurface: {
			version: 2,
			fallback: 'procedural',
			morphology: 'auto',
			seed: 912,
			activity: 0.68,
			maps: {},
		},
	})
</script>

<svelte:head><title>Rodder surface preview fixture</title></svelte:head>

<main class="min-h-screen bg-page p-6 text-heading" data-testid="surface-preview-fixture">
	<div class="mx-auto grid max-w-4xl items-start gap-6 md:grid-cols-[1fr_320px]">
		<section class="space-y-4 bg-surface p-5">
			<div>
				<h1 class="text-lg font-semibold">Surface editor fixture</h1>
				<p class="mt-1 text-xs text-secondary">Changes below drive the same unsaved preview used by the rodder body editor.</p>
			</div>
			<div class="flex gap-2">
				<button class="bg-raised px-3 py-2 text-xs text-body" onclick={() => previewKind = 'planet'}>Planet</button>
				<button class="bg-raised px-3 py-2 text-xs text-body" onclick={() => previewKind = 'star'}>Star</button>
			</div>
			<CoverageInput label="Surface water" hint="Fixture water target" domain="the entire spherical surface" bind:value={surfaceWater} />
			<CoverageInput label="Illustrative mean cloud cover" hint="Representative weather appearance" domain="a representative atmospheric shell" bind:value={cloudCoverage} />
			<CoverageInput label="Vegetation coverage" hint="Fixture vegetation target" domain="eligible exposed land" bind:value={vegetationCoverage} />
			<CoverageInput label="Permanent snow / ice" hint="Fixture snow target" domain="the entire spherical surface" bind:value={snowCoverage} />
			<label class="block space-y-1 text-xs text-secondary">
				<span>Seed</span>
				<input class="w-full bg-page px-3 py-2 text-body" type="number" step="1" bind:value={seed} />
			</label>
		</section>
		{#if previewKind === 'planet'}
			<RodderSurfacePreview {body} />
		{:else}
			<RodderSurfacePreview body={star} isStar />
		{/if}
	</div>
</main>
