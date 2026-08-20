<script lang="ts">
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import RootMapView from '$lib/rodder/RootMap.svelte'
	import { resolveRootMapEmbedConfiguration } from '$lib/rodder/embed-config.js'
	import {
		defaultRootCameraState,
		rodderViewUrl,
		type RootCameraState,
		type RootViewState,
	} from '$lib/rodder/view-state.js'
	import type { RootSelectionKey } from '$lib/rodder/apparent-sky.js'
	import type { EntityKey, MapBody } from '$lib/rodder/root-layout.js'
	import {
		advanceEmbedDay,
		EMBED_PLAYBACK_RATE_OPTIONS,
		formatEmbedDay,
		formatEmbedPlaybackRate,
	} from '$lib/rodder/embed-clock.js'

	let { args }: { args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const slug = $derived(positionalArg(args, 0)?.trim() || '')
	const document = $derived(slug ? ctx.rodderEntities?.get(slug) : null)
	const pageHref = $derived(document
		? resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${document.identity.slug}` })
		: '')
	const display = $derived(document?.displays.rootMap ?? null)
	const stars = $derived((display?.stars ?? []) as unknown as MapBody[])
	const bodies = $derived((display?.bodies ?? []) as unknown as MapBody[])
	const config = $derived(display
		? resolveRootMapEmbedConfiguration(args, document!.identity.slug, stars, bodies, display.apparentSky)
		: null)
	let selected = $derived<RootSelectionKey | null>(config?.selected ?? null)
	let focus = $derived<EntityKey | null>(config?.focus ?? null)
	let view = $derived(config?.mode ?? 'orrery')
	let follow = $derived(config?.follow ?? false)
	let host = $state<HTMLElement | null>(null)
	let active = $state(false)
	let inViewport = $state(false)
	let documentVisible = $state(true)
	let playing = $state(true)
	let playbackChosen = $state(false)
	let elapsedDays = $state(0)
	let playbackRateOverride = $state<number | null>(null)
	let map = $state<{ getCameraState(): RootCameraState | null } | null>(null)
	const playbackRate = $derived(playbackRateOverride ?? config?.playbackRate ?? 10)
	const currentDay = $derived.by(() => {
		if (!config) return null
		if (config.day == null && !config.interaction.timeMovement) return null
		return (config.day ?? 0) + elapsedDays
	})
	const advancing = $derived(Boolean(
		config?.interaction.timeMovement
		&& playing
		&& active
		&& inViewport
		&& documentVisible,
	))
	const playbackRates = $derived.by(() => [...new Set([
		...EMBED_PLAYBACK_RATE_OPTIONS,
		playbackRate,
	])].toSorted((a, b) => a - b))

	const selectedLocal = $derived(selected?.startsWith('star:')
		? stars.find(star => `star:${star.id}` === selected) ?? null
		: (selected?.startsWith('body:') ? bodies.find(body => `body:${body.id}` === selected) ?? null : null))
	const selectedSky = $derived(selected?.startsWith('sky-root:')
		? display?.apparentSky.sources.find(source => source.key === selected) ?? null
		: null)

	onMount(() => {
		documentVisible = globalThis.document.visibilityState === 'visible'
		const reducedMotion = globalThis.matchMedia('(prefers-reduced-motion: reduce)')
		if (!playbackChosen) playing = !reducedMotion.matches
		const handleMotionPreference = (event: MediaQueryListEvent) => {
			if (!playbackChosen) playing = !event.matches
		}
		reducedMotion.addEventListener('change', handleMotionPreference)

		let preloadObserver: IntersectionObserver | null = null
		let visibilityObserver: IntersectionObserver | null = null
		if (!host || typeof IntersectionObserver === 'undefined') {
			active = true
			inViewport = true
		} else {
			preloadObserver = new IntersectionObserver((entries) => {
				if (entries.some(entry => entry.isIntersecting)) {
					active = true
					preloadObserver?.disconnect()
				}
			}, { rootMargin: '400px' })
			visibilityObserver = new IntersectionObserver((entries) => {
				inViewport = entries.some(entry => entry.isIntersecting)
			}, { threshold: 0.01 })
			preloadObserver.observe(host)
			visibilityObserver.observe(host)
		}

		let frame = 0
		let previousTime = performance.now()
		let accumulatedMilliseconds = 0
		const tick = (time: number) => {
			const elapsedMilliseconds = Math.min(Math.max(time - previousTime, 0), 250)
			previousTime = time
			if (
				config?.interaction.timeMovement
				&& playing
				&& active
				&& inViewport
				&& documentVisible
			) {
				accumulatedMilliseconds += elapsedMilliseconds
				if (accumulatedMilliseconds >= 50) {
					elapsedDays = advanceEmbedDay(elapsedDays, accumulatedMilliseconds, playbackRate)
					accumulatedMilliseconds = 0
				}
			} else {
				accumulatedMilliseconds = 0
			}
			frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)

		return () => {
			preloadObserver?.disconnect()
			visibilityObserver?.disconnect()
			cancelAnimationFrame(frame)
			reducedMotion.removeEventListener('change', handleMotionPreference)
		}
	})

	function handleVisibilityChange() {
		documentVisible = globalThis.document.visibilityState === 'visible'
	}

	function togglePlayback() {
		playbackChosen = true
		playing = !playing
	}

	function stepDay(amount: number) {
		elapsedDays += amount
	}

	function selectPlaybackRate(event: Event) {
		playbackRateOverride = Number((event.currentTarget as HTMLSelectElement).value)
	}

	function openFullView(event: MouseEvent) {
		if (!document || !display || !config) return
		const camera = map?.getCameraState() ?? config.camera ?? defaultRootCameraState(view)
		event.preventDefault()
		const state: RootViewState = {
			version: 1,
			renderer: 'root',
			space: { slug: document.identity.slug },
			selected,
			focus,
			camera,
			mode: view,
			time: currentDay,
			labels: config.labels,
			skyLabels: config.skyLabels,
			trails: config.trails,
			visibility: config.visibility,
			exposure: config.visibility === 'physical' ? 'fixed' : 'auto',
			scale: config.scale,
			follow,
		}
		location.assign(rodderViewUrl(new URL(pageHref, location.origin), state))
	}
</script>

<svelte:document onvisibilitychange={handleVisibilityChange} />

{#if document && display && config}
	<figure
		class="my-4 overflow-hidden border border-border-subtle bg-surface"
		bind:this={host}
		data-rodder-embed="root"
		data-time-enabled={config.interaction.timeMovement}
		data-current-day={currentDay?.toFixed(4)}
		data-advancing={advancing}
	>
		<div class="relative min-h-64 w-full bg-black" style:aspect-ratio={String(config.aspectRatio)}>
			{#if active}
				<RootMapView
					bind:this={map}
					rootName={display.rootName}
					{stars}
					{bodies}
					apparentSky={display.apparentSky}
					currentAbsoluteDay={currentDay}
					scale={config.scale}
					labels={config.labels}
					skyLabels={config.skyLabels}
					trails={config.trails}
					visibility={config.visibility}
					bind:follow
					bind:view
					bind:selectedId={selected}
					bind:focusId={focus}
					initialCameraState={config.camera}
					interaction={config.interaction}
				/>
			{:else}
				<div class="absolute inset-0 grid place-items-center p-5 text-center text-sm text-secondary">
					<span>Interactive map of {document.identity.name} loads when it approaches the viewport.</span>
				</div>
			{/if}

			{#if config.interaction.selectionInspection && (selectedLocal || selectedSky)}
				<div class="absolute right-2 bottom-2 z-30 max-w-64 border border-accent/60 bg-surface/95 px-3 py-2 text-xs shadow-lg">
					<div class="font-semibold text-heading">{selectedLocal?.name ?? selectedSky?.rootName}</div>
					{#if selectedSky}
						<div class="text-secondary">{selectedSky.distance.toLocaleString('en-US', { maximumFractionDigits: 2 })} {selectedSky.units}</div>
					{:else if selectedLocal?.semiMajorAxisAu != null}
						<div class="text-secondary">{selectedLocal.semiMajorAxisAu.toLocaleString('en-US', { maximumSignificantDigits: 3 })} AU</div>
					{/if}
				</div>
			{/if}

			{#if config.interaction.timeMovement && config.interaction.controlsVisible}
				<div class="absolute bottom-2 left-2 z-30 flex items-center gap-1 border border-faint/60 bg-surface/90 p-1 text-xs text-secondary shadow-lg backdrop-blur-sm" data-rodder-time-controls>
					<button type="button" class="px-2 py-1 hover:bg-raised hover:text-heading" aria-label="Step back one simulated day" onclick={() => stepDay(-1)}>−1 d</button>
					<button type="button" class="min-w-14 px-2 py-1 hover:bg-raised hover:text-heading" aria-pressed={playing} onclick={togglePlayback}>{playing ? 'Pause' : 'Play'}</button>
					<button type="button" class="px-2 py-1 hover:bg-raised hover:text-heading" aria-label="Step forward one simulated day" onclick={() => stepDay(1)}>+1 d</button>
					<span class="border-l border-border-subtle px-2 tabular-nums" data-rodder-clock>{formatEmbedDay(currentDay)}</span>
					<label>
						<span class="sr-only">Playback speed</span>
						<select
							class="bg-raised p-1 text-body"
							value={String(playbackRate)}
							onchange={selectPlaybackRate}
						>
							{#each playbackRates as rate (rate)}
								<option value={rate}>{formatEmbedPlaybackRate(rate)}</option>
							{/each}
						</select>
					</label>
				</div>
			{/if}
		</div>

		{#if config.errors.length > 0}
			<ul class="border-t border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">
				{#each config.errors as issue (`${issue.argument}:${issue.message}`)}
					<li><code>{issue.argument}</code>: {issue.message}</li>
				{/each}
			</ul>
		{/if}

		<noscript>
			<div class="border-t border-border-subtle p-3 text-sm text-secondary">
				Interactive rendering requires JavaScript. <a class="text-link" href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${document.identity.slug}` })}>Open {document.identity.name}</a>.
			</div>
		</noscript>

		<figcaption class="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-3 py-2 text-xs text-secondary">
			<span>{document.identity.name} · {stars.length} {stars.length === 1 ? 'star' : 'stars'} · {bodies.length} {bodies.length === 1 ? 'body' : 'bodies'}</span>
			{#if config.interaction.objectNavigation}
				<a href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${document.identity.slug}` })} onclick={openFullView} class="text-link hover:text-link-hover">Open full viewer</a>
			{/if}
		</figcaption>
	</figure>
{:else if document}
	<div class="my-4 border border-border-subtle bg-surface p-4 text-sm text-secondary" role="status">
		<strong class="text-heading">Root map unavailable for {document.identity.name}.</strong>
		{document.diagnostics.find(diagnostic => diagnostic.path === 'displays.rootMap')?.message ?? 'This entity is not a renderable sector root.'}
		<a class="ml-1 text-link" href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${document.identity.slug}` })}>Open entity</a>
	</div>
{:else}
	<div class="my-4 border border-error-border bg-error-bg p-4 text-sm text-error-text" role="status">
		Root map target <code>{slug || '?'}</code> is missing or was not prefetched.
	</div>
{/if}
