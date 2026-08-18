<script lang="ts">
	import type { Attachment } from 'svelte/attachments'
	import RotateCcw from 'phosphor-svelte/lib/ArrowCounterClockwise'
	import { Debounced, useResizeObserver } from 'runed'
	import {
		composeSurfacePlan,
		describeSurfacePlan,
		summarizeSurfacePlan,
		surfaceMediaUrl,
		type SurfaceMapChannel,
		type SurfacePlan,
	} from '$lib/rodder/surface-model.js'
	import { composeWeatherPlan } from '$lib/rodder/weather-model.js'
	import {
		composeStellarSurfacePlan,
		describeStellarSurfacePlan,
		summarizeStellarSurfacePlan,
		stellarSurfaceMediaUrl,
	} from '$lib/rodder/stellar-surface-model.js'
	import type { MapBody } from '$lib/rodder/root-layout.js'
	import type { SurfacePreviewRenderer } from '$lib/rodder/three/surface-preview-renderer.js'

	let { body, isStar = false }: { body: MapBody, isStar?: boolean } = $props()

	const planetPlan = $derived(composeSurfacePlan(body, body.surface))
	const weatherPlan = $derived(composeWeatherPlan(body, body.weather, body.surface))
	const stellarPlan = $derived(composeStellarSurfacePlan(body, body.stellarSurface))

	const channelLabels: Record<SurfaceMapChannel, string> = {
		albedo: 'Colour',
		elevation: 'Elevation',
		normal: 'Normal',
		roughness: 'Roughness',
		emissive: 'Emissive',
	}
	type PreviewEntry = { key: string, label: string, value: string }
	type PreviewModel = {
		testId: string
		title: string
		loadingLabel: string
		plateLabel: string
		plateSource: string
		plateAriaLabel: string
		description: string
		status: string
		entries: PreviewEntry[]
	}

	const previewModel = $derived.by<PreviewModel>(() => {
		if (isStar) {
			const morphology = stellarPlan.morphology.replace('_', ' ')
			return {
				testId: 'stellar-preview',
				title: 'Photosphere preview',
				loadingLabel: 'Composing photosphere…',
				plateLabel: 'Photosphere plate',
				plateSource: stellarPlan.photosphere.source,
				plateAriaLabel: 'Two-to-one equirectangular preview of the stellar photosphere',
				description: describeStellarSurfacePlan(stellarPlan),
				status: summarizeStellarSurfacePlan(stellarPlan),
				entries: [
					{ key: 'photosphere', label: 'Plate', value: stellarPlan.photosphere.filename ?? stellarPlan.photosphere.source },
					{ key: 'morphology', label: 'Morphology', value: morphology },
					{ key: 'temperature', label: 'Temperature', value: `${Math.round(stellarPlan.temperatureK).toLocaleString('en-US')} K` },
					{ key: 'activity', label: 'Activity', value: `${Math.round(stellarPlan.activity * 100)}%` },
				],
			}
		}

		const entries: PreviewEntry[] = (Object.entries(planetPlan.channels) as [SurfaceMapChannel, SurfacePlan['channels'][SurfaceMapChannel]][])
			.map(([channel, channelPlan]) => ({ key: channel, label: channelLabels[channel], value: channelPlan.filename ?? channelPlan.source }))
		entries.push({
			key: 'weather-clouds',
			label: 'Clouds (weather)',
			value: weatherPlan.clouds.source === 'procedural' && weatherPlan.clouds.meanCover != null
				? `${Math.round(weatherPlan.clouds.meanCover * 100)}% representative cover`
				: 'none',
		})
		return {
			testId: 'surface-preview',
			title: 'Surface preview',
			loadingLabel: 'Composing surface…',
			plateLabel: 'Base color plate',
			plateSource: planetPlan.channels.albedo.source,
			plateAriaLabel: 'Two-to-one equirectangular preview of the base color appearance map',
			description: describeSurfacePlan(planetPlan),
			status: summarizeSurfacePlan(planetPlan),
			entries,
		}
	})
	const debouncedGlobeInput = new Debounced(() => ({ body, isStar }), 180)
	const debouncedPlateInput = new Debounced(() => ({ body, isStar, planetPlan, weatherPlan, stellarPlan }), 180)

	let previewRenderer: SurfacePreviewRenderer | null = null
	let globeState = $state<'loading' | 'ready' | 'unavailable'>('loading')
	let globeMessage = $state('')
	let plateState = $state<'loading' | 'ready' | 'error'>('loading')
	let plateMessage = $state('')
	const globeLoading = $derived(globeState === 'loading' || debouncedGlobeInput.pending)
	const plateLoading = $derived(plateState === 'loading' || debouncedPlateInput.pending)

	function previewState(): string {
		if (globeState === 'unavailable') return plateState === 'ready' ? 'plate-only' : 'unavailable'
		return !globeLoading && !plateLoading && globeState === 'ready' && plateState === 'ready' ? 'ready' : 'loading'
	}

	function attachGlobe(host: HTMLElement): ReturnType<Attachment> {
		let destroyed = false
		let pending: { body: MapBody, isStar: boolean } | null = null
		let updateVersion = 0
		let appliedVersion = 0
		let globeFailed = false

		const { stop: stopResizing } = useResizeObserver(
			() => host,
			(entries) => {
				const entry = entries[0]
				if (entry) previewRenderer?.resize(entry.contentRect.width, entry.contentRect.height)
			},
		)

		async function applyBody(nextBody: MapBody, nextIsStar: boolean, version: number): Promise<void> {
			if (globeFailed) return
			if (!previewRenderer || destroyed) {
				pending = { body: nextBody, isStar: nextIsStar }
				return
			}
			if (version <= appliedVersion) return
			appliedVersion = version
			globeState = 'loading'
			globeMessage = ''
			try {
				await previewRenderer.setBody(nextBody, nextIsStar)
				if (!destroyed && version === updateVersion) globeState = 'ready'
			} catch (error) {
				if (destroyed || version !== updateVersion) return
				globeState = 'unavailable'
				globeMessage = error instanceof Error ? error.message : 'The globe preview could not be rendered.'
			}
		}

		$effect(() => {
			const { body: nextBody, isStar: nextIsStar } = debouncedGlobeInput.current
			const version = ++updateVersion
			pending = { body: nextBody, isStar: nextIsStar }
			if (!globeFailed) globeState = 'loading'
			void applyBody(nextBody, nextIsStar, version)
		})

		void import('$lib/rodder/three/surface-preview-renderer.js')
			.then(({ createSurfacePreviewRenderer }) => {
				if (destroyed) return
				previewRenderer = createSurfacePreviewRenderer(host, (message) => {
					globeFailed = true
					globeState = 'unavailable'
					globeMessage = message
				})
				previewRenderer.resize(host.clientWidth, host.clientHeight)
				if (pending) void applyBody(pending.body, pending.isStar, updateVersion)
			})
			.catch((error: unknown) => {
				if (destroyed) return
				globeFailed = true
				globeState = 'unavailable'
				globeMessage = error instanceof Error ? error.message : 'The globe preview could not be initialized.'
			})

		return () => {
			destroyed = true
			updateVersion += 1
			stopResizing()
			previewRenderer?.dispose()
			previewRenderer = null
		}
	}

	function drawSolidPlate(canvas: HTMLCanvasElement, color: string): void {
		canvas.width = 1_024
		canvas.height = 512
		const context = canvas.getContext('2d')
		if (!context) throw new Error('This browser cannot draw the surface plate.')
		context.fillStyle = color
		context.fillRect(0, 0, canvas.width, canvas.height)
	}

	function drawImagePlate(canvas: HTMLCanvasElement, image: HTMLImageElement): void {
		canvas.width = 1_024
		canvas.height = 512
		const context = canvas.getContext('2d')
		if (!context) throw new Error('This browser cannot draw the surface plate.')
		context.imageSmoothingEnabled = true
		context.imageSmoothingQuality = 'high'
		context.clearRect(0, 0, canvas.width, canvas.height)
		context.drawImage(image, 0, 0, canvas.width, canvas.height)
	}

	function drawPixelPlate(canvas: HTMLCanvasElement, width: number, height: number, pixels: Uint8Array): void {
		canvas.width = width
		canvas.height = height
		const context = canvas.getContext('2d')
		if (!context) throw new Error('This browser cannot draw the texture plate.')
		const image = context.createImageData(width, height)
		image.data.set(pixels)
		context.putImageData(image, 0, 0)
	}

	function loadImage(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const image = new Image()
			image.addEventListener('load', () => resolve(image), { once: true })
			image.addEventListener('error', () => reject(new Error('The uploaded texture plate could not be loaded.')), { once: true })
			image.src = url
		})
	}

	function attachPlate(canvas: HTMLCanvasElement): ReturnType<Attachment> {
		let renderVersion = 0
		$effect(() => {
			const current = debouncedPlateInput.current
			const currentBody = current.body
			const currentIsStar = current.isStar
			const currentPlanetPlan = current.planetPlan
			const currentWeatherPlan = current.weatherPlan
			const currentStellarPlan = current.stellarPlan
			const version = ++renderVersion
			plateState = 'loading'
			plateMessage = ''

			void (async () => {
				try {
					if (currentIsStar) {
						const photosphere = currentStellarPlan.photosphere
						if (photosphere.source === 'uploaded' && photosphere.binding) {
							const image = await loadImage(stellarSurfaceMediaUrl(photosphere.binding))
							if (version !== renderVersion) return
							drawImagePlate(canvas, image)
						} else if (photosphere.source === 'procedural') {
							const { requestProceduralStellarTexture } = await import('$lib/rodder/three/procedural-texture-client.js')
							const generated = await requestProceduralStellarTexture({
								temperatureK: currentStellarPlan.temperatureK,
								morphology: currentStellarPlan.morphology,
								rotationDays: currentStellarPlan.rotationDays,
								activity: currentStellarPlan.activity,
								seed: currentStellarPlan.seed,
							}, { size: 1024, priority: 'foreground' })
							if (version !== renderVersion) return
							drawPixelPlate(canvas, generated.width, generated.height, generated.photosphere)
						} else {
							drawSolidPlate(canvas, currentBody.color ?? '#FFE088')
						}
					} else {
						const albedo = currentPlanetPlan.channels.albedo
						if (albedo.source === 'uploaded' && albedo.binding) {
							const image = await loadImage(surfaceMediaUrl(albedo.binding))
							if (version !== renderVersion) return
							drawImagePlate(canvas, image)
						} else if (albedo.source === 'procedural') {
							const { requestProceduralPlanetTexture } = await import('$lib/rodder/three/procedural-texture-client.js')
							const proceduralClouds = currentWeatherPlan.clouds.source === 'procedural' && currentWeatherPlan.clouds.meanCover != null
								? {
									meanCover: currentWeatherPlan.clouds.meanCover,
									seed: currentWeatherPlan.clouds.seed,
								}
								: null
							const generated = await requestProceduralPlanetTexture({
								class: currentPlanetPlan.class,
								seed: currentPlanetPlan.seed,
								temperatureK: currentPlanetPlan.temperatureK,
								coverage: currentPlanetPlan.coverage,
								clouds: proceduralClouds,
								tint: [202, 225, 255],
							}, { size: 1024, priority: 'foreground' })
							if (version !== renderVersion) return
							if (generated.albedo) drawPixelPlate(canvas, generated.width, generated.height, generated.albedo)
						} else {
							drawSolidPlate(canvas, currentBody.color ?? '#CAE1FF')
						}
					}
					if (version === renderVersion) plateState = 'ready'
				} catch (error) {
					if (version !== renderVersion) return
					plateState = 'error'
					plateMessage = error instanceof Error ? error.message : 'The texture plate could not be rendered.'
					drawSolidPlate(canvas, '#202631')
				}
			})()
		})

		return () => {
			renderVersion += 1
		}
	}
</script>

<div
	class="overflow-hidden border border-border-subtle bg-surface"
	data-testid={previewModel.testId}
	data-render-state={previewState()}
>
	<div class="flex items-start justify-between gap-3 border-b border-border-subtle px-3 py-2.5">
		<div class="min-w-0">
			<h3 class="text-xs font-semibold tracking-wider text-heading uppercase">{previewModel.title}</h3>
		</div>
		<button
			type="button"
			class="shrink-0 p-1 text-secondary transition-colors hover:text-body"
			onclick={() => previewRenderer?.resetView()}
			aria-label={`Reset ${isStar ? 'photosphere' : 'surface'} preview view`}
			title="Reset view"
		>
			<RotateCcw size={14} />
		</button>
	</div>

	<div class="relative aspect-square min-h-56 bg-black" {@attach attachGlobe}>
		{#if globeLoading}
			<div class="pointer-events-none absolute inset-0 grid place-items-center bg-black/25 text-xs text-secondary">
				{previewModel.loadingLabel}
			</div>
		{:else if globeState === 'unavailable'}
			<div class="absolute inset-0 grid place-items-center p-5 text-center text-xs text-secondary">
				{globeMessage}
			</div>
		{/if}
		<div class="pointer-events-none absolute right-2 bottom-2 bg-black/65 px-1.5 py-1 text-[0.625rem] text-secondary">
			Drag to rotate · wheel to zoom
		</div>
	</div>

	<div class="border-t border-border-subtle">
		<div class="flex items-center justify-between px-3 py-2 text-[0.625rem] tracking-wide text-secondary uppercase">
			<span>{previewModel.plateLabel}</span>
			<span>{previewModel.plateSource}</span>
		</div>
		<div class="relative aspect-2/1 overflow-hidden bg-black">
			<canvas
				class="block size-full object-cover"
				aria-label={previewModel.plateAriaLabel}
				{@attach attachPlate}
			></canvas>
			{#if plateLoading}
				<div class="pointer-events-none absolute inset-0 grid place-items-center bg-black/35 text-[0.625rem] text-secondary">Generating plate…</div>
			{:else if plateState === 'error'}
				<div class="absolute inset-0 grid place-items-center p-3 text-center text-[0.625rem] text-error">{plateMessage}</div>
			{/if}
		</div>
	</div>

	<div class="space-y-2 border-t border-border-subtle p-3">
		<div class="flex items-start justify-between gap-3 text-xs">
			<span class="font-semibold text-body">{previewModel.status}</span>
			<span class="text-right text-secondary">{previewModel.description}</span>
		</div>
		<details class="border-t border-border-subtle pt-2">
			<summary class="cursor-pointer text-xs text-secondary hover:text-body">Channel details</summary>
			<div class="mt-2 grid grid-cols-2 gap-1.5">
				{#each previewModel.entries as entry (entry.key)}
					<div class="flex items-center justify-between gap-2 bg-page px-2 py-1.5 text-[0.625rem]">
						<span class="text-secondary">{entry.label}</span>
						<span class="truncate font-medium text-body">{entry.value}</span>
					</div>
				{/each}
			</div>
		</details>
	</div>
</div>
