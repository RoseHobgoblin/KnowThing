<script lang="ts">
	import CelestialSurfacePreview from '$lib/components/celestial/CelestialSurfacePreview.svelte'
	import type { MapBody } from '$lib/celestial/system-layout.js'

	let hydrosphereFraction = $state(0.55)
	let cloudCoverage = $state(0.48)
	let seed = $state(436)
	let previewKind = $state<'planet' | 'star'>('planet')

	const body = $derived<MapBody>({
		id: 100,
		name: 'Saxnat',
		slug: 'saxnat',
		bodyType: 'planet',
		temperature: '288 K',
		composition: 'iron core and silicate mantle',
		atmosphere: 'N2 78%, O2 21%',
		surface: {
			version: 1,
			fallback: 'procedural',
			class: 'terrestrial',
			seed,
			hydrosphereFraction,
			cloudCoverage,
			maps: {},
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
			version: 1,
			fallback: 'procedural',
			morphology: 'auto',
			seed: 912,
			activity: 0.68,
			maps: {},
		},
	})
</script>

<svelte:head><title>Celestial surface preview fixture</title></svelte:head>

<main class="min-h-screen bg-page p-6 text-heading" data-testid="surface-preview-fixture">
	<div class="mx-auto grid max-w-4xl items-start gap-6 md:grid-cols-[1fr_320px]">
		<section class="space-y-4 bg-surface p-5">
			<div>
				<h1 class="text-lg font-semibold">Surface editor fixture</h1>
				<p class="mt-1 text-xs text-secondary">Changes below drive the same unsaved preview used by the celestial body editor.</p>
			</div>
			<div class="flex gap-2">
				<button class="bg-raised px-3 py-2 text-xs text-body" onclick={() => previewKind = 'planet'}>Planet</button>
				<button class="bg-raised px-3 py-2 text-xs text-body" onclick={() => previewKind = 'star'}>Star</button>
			</div>
			<label class="block space-y-1 text-xs text-secondary">
				<span>Surface water fraction</span>
				<input class="w-full bg-page px-3 py-2 text-body" type="number" min="0" max="1" step="0.05" bind:value={hydrosphereFraction} />
			</label>
			<label class="block space-y-1 text-xs text-secondary">
				<span>Cloud coverage</span>
				<input class="w-full bg-page px-3 py-2 text-body" type="number" min="0" max="1" step="0.05" bind:value={cloudCoverage} />
			</label>
			<label class="block space-y-1 text-xs text-secondary">
				<span>Seed</span>
				<input class="w-full bg-page px-3 py-2 text-body" type="number" step="1" bind:value={seed} />
			</label>
		</section>
		{#if previewKind === 'planet'}
			<CelestialSurfacePreview {body} />
		{:else}
			<CelestialSurfacePreview body={star} isStar />
		{/if}
	</div>
</main>
