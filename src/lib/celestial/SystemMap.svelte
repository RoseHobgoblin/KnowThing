<script lang="ts">
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import { cn } from '$lib/utils.js'
	import type { LabelMode, ScaleMode, TrailMode, ViewMode, VisibilityMode } from './map-settings.js'
	import type { EntityKey, MapBody, ThemePalette } from './system-layout.js'
	import { keyForBody, timingUnavailable } from './system-layout.js'
	import { composeSurfacePlan, describeSurfacePlan } from './surface-model.js'
	import { composeStellarSurfacePlan, describeStellarSurfacePlan } from './stellar-surface-model.js'
	import { describeStarlightLuminosity, resolveStarlightLuminosity } from './starlight-model.js'
	import type { OverlaySnapshot, SystemMapRenderer } from './renderer-types.js'

	const DEFAULT_THEME: ThemePalette = {
		page: '#12131D', surface: '#1A1B26', accent: '#FFE088', accentLight: '#E9C349',
		secondary: '#A09882', dim: '#7A7264', heading: '#F0E6D0', faint: '#55504A',
	}
	const EMPTY_OVERLAY: OverlaySnapshot = {
		labels: [], indicators: [], scaleLabel: '', legend: null, modeLabel: 'Orrery · Enhanced', projection: 'perspective', status: 'initializing',
	}

	let {
		systemName,
		stars,
		bodies,
		currentAbsoluteDay,
		scale = 'log',
		labels = 'major',
		trails = 'off',
		follow = false,
		view = $bindable('orrery'),
		visibility = 'enhanced',
		selectedId = $bindable(null),
	}: {
		systemName: string
		stars: MapBody[]
		bodies: MapBody[]
		currentAbsoluteDay?: number | null
		scale?: ScaleMode
		labels?: LabelMode
		trails?: TrailMode
		follow?: boolean
		view?: ViewMode
		visibility?: VisibilityMode
		selectedId?: EntityKey | null
	} = $props()

	let wrapperElement: HTMLDivElement | null = null
	let canvasHost: HTMLDivElement | null = null
	let renderer = $state<SystemMapRenderer | null>(null)
	let theme = $state<ThemePalette>(DEFAULT_THEME)
	let displayWidth = $state(800)
	let displayHeight = $state(800)
	let hoveredBody = $state<MapBody | null>(null)
	let hoverPosition = $state<{ x: number, y: number } | null>(null)
	let viewState = $state({ zoomLevel: 1, isMoved: false })
	let overlay = $state.raw<OverlaySnapshot>(EMPTY_OVERLAY)
	let unavailableReason = $state<string | null>(null)

	const fallbackEntities = $derived([
		...stars.map(body => ({ body, key: keyForBody(body, true) })),
		...bodies.map(body => ({ body, key: keyForBody(body, false) })),
	])

	function readTheme() {
		if (!wrapperElement) return
		const style = getComputedStyle(wrapperElement)
		const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
		const next: ThemePalette = {
			page: read('--color-page', DEFAULT_THEME.page),
			surface: read('--color-surface', DEFAULT_THEME.surface),
			accent: read('--color-accent', DEFAULT_THEME.accent),
			accentLight: read('--color-accent-light', DEFAULT_THEME.accentLight),
			secondary: read('--color-secondary', DEFAULT_THEME.secondary),
			dim: read('--color-dim', DEFAULT_THEME.dim),
			heading: read('--color-heading', DEFAULT_THEME.heading),
			faint: read('--color-faint', DEFAULT_THEME.faint),
		}
		if (JSON.stringify(next) !== JSON.stringify(theme)) theme = next
	}

	function formatZoom(zoom: number): string {
		if (zoom >= 1_000_000) return `${(zoom / 1_000_000).toFixed(1)}m`
		if (zoom >= 1_000) return `${(zoom / 1_000).toFixed(1)}k`
		return zoom.toFixed(1)
	}

	function surfaceDescription(body: MapBody): string | null {
		return body.isStar
			? describeStellarSurfacePlan(composeStellarSurfacePlan(body, body.stellarSurface))
			: describeSurfacePlan(composeSurfacePlan(body, body.surface))
	}
	const hoveredSurfaceDescription = $derived(hoveredBody ? surfaceDescription(hoveredBody) : null)
	const hoveredStarlight = $derived.by(() => {
		if (!hoveredBody?.isStar) return null
		return {
			description: describeStarlightLuminosity(hoveredBody),
			fallback: resolveStarlightLuminosity(hoveredBody).source === 'fallback',
		}
	})

	// Three.js remains strictly browser-only.
	onMount(() => {
		let cancelled = false
		let created: SystemMapRenderer | null = null

		;(async () => {
			const { createSystemMapRenderer } = await import('./three/map-renderer.js')
			if (cancelled || !canvasHost) return
			readTheme()
			const instance = await createSystemMapRenderer(canvasHost, theme, {
				onHover: (body, position) => {
					hoveredBody = body
					hoverPosition = position
				},
				onSelect: (id) => { selectedId = id },
				onViewChange: (nextView) => { viewState = nextView },
				onOverlayChange: (snapshot) => { overlay = snapshot },
				onUnavailable: (reason) => { unavailableReason = reason },
			})
			if (cancelled || !canvasHost) {
				instance.destroy()
				return
			}
			created = instance
			instance.canvas.style.display = unavailableReason ? 'none' : 'block'
			instance.canvas.style.width = '100%'
			instance.canvas.style.height = '100%'
			instance.canvas.setAttribute('aria-label', `Interactive system map of ${systemName}`)
			instance.canvas.setAttribute('aria-keyshortcuts', 'W A S D ArrowUp ArrowLeft ArrowDown ArrowRight')
			// The host has no Svelte children; imperative ownership is deliberate.
			// eslint-disable-next-line svelte/no-dom-manipulating
			canvasHost.replaceChildren(instance.canvas)
			renderer = instance
		})()

		return () => {
			cancelled = true
			renderer = null
			created?.destroy()
		}
	})

	$effect(() => {
		const host = canvasHost
		if (!host) return
		const updateRect = () => {
			const rect = host.getBoundingClientRect()
			displayWidth = Math.max(1, Math.round(rect.width))
			displayHeight = Math.max(1, Math.round(rect.height))
			readTheme()
			renderer?.resize(displayWidth, displayHeight)
		}
		updateRect()
		const observer = new ResizeObserver(updateRect)
		observer.observe(host)
		return () => observer.disconnect()
	})

	$effect(() => {
		renderer?.setSettings({ scale, labels, trails, follow, view, visibility })
	})
	$effect(() => {
		renderer?.setDay(currentAbsoluteDay ?? null)
	})
	$effect(() => {
		renderer?.setSelected(selectedId ?? null)
	})
	$effect(() => {
		renderer?.setTheme(theme)
	})
	$effect(() => {
		renderer?.setData(stars, bodies)
	})
	$effect(() => {
		renderer?.canvas.setAttribute('aria-label', `Interactive system map of ${systemName}`)
	})

	const tooltipStyle = $derived.by(() => {
		if (!hoverPosition) return ''
		const tipWidth = 210
		const baseHeight = timingUnavailable(hoveredBody ?? { id: 0, name: '', slug: '', bodyType: '' }) ? 84 : 60
		const tipHeight = baseHeight + (hoveredSurfaceDescription ? 18 : 0) + (hoveredStarlight ? 18 : 0)
		const placeRight = hoverPosition.x + 16 + tipWidth < displayWidth
		const left = placeRight ? hoverPosition.x + 16 : hoverPosition.x - tipWidth - 16
		const top = Math.min(Math.max(hoverPosition.y - tipHeight / 2, 4), displayHeight - tipHeight - 4)
		return `left:${Math.max(4, left)}px;top:${top}px;`
	})
</script>

<div
	class="relative size-full min-h-80 overflow-hidden bg-black"
	bind:this={wrapperElement}
	data-render-state={unavailableReason ? 'unavailable' : overlay.status}
	data-camera-projection={overlay.projection ?? 'unavailable'}
	data-visibility-mode={visibility}
>
	<div bind:this={canvasHost} class="absolute inset-0" aria-hidden={unavailableReason != null}></div>

	<div class="absolute top-2 left-2 z-10 flex overflow-hidden border border-faint/50 bg-surface/85 text-xs" aria-label="Map view">
		<button
			class={cn('px-2 py-1 transition-colors', view === 'plan' ? 'bg-accent text-page' : 'text-secondary hover:text-heading')}
			aria-pressed={view === 'plan'}
			onclick={() => { view = 'plan' }}
		>Plan</button>
		<button
			class={cn('px-2 py-1 transition-colors', view === 'orrery' ? 'bg-accent text-page' : 'text-secondary hover:text-heading')}
			aria-pressed={view === 'orrery'}
			onclick={() => { view = 'orrery' }}
		>Orrery</button>
	</div>

	{#if viewState.isMoved}
		<button
			class="absolute top-2 right-2 z-10 bg-surface/85 px-2 py-1 text-xs font-medium text-dim transition-colors hover:text-accent"
			onclick={() => renderer?.resetView()}
			aria-label="Reset map view"
		>{formatZoom(viewState.zoomLevel)}× · Reset</button>
	{/if}

	{#if !unavailableReason}
		<div class="pointer-events-none absolute inset-0 z-5 overflow-hidden" aria-hidden="true">
			{#each overlay.labels as label (label.key)}
				<div
					class={cn(
						'absolute -translate-x-1/2 text-[0.68rem] whitespace-nowrap drop-shadow-md',
						label.selected ? 'font-semibold text-accent' : 'text-heading',
					)}
					data-entity-key={label.key}
					data-anchor-x={label.anchorX}
					data-anchor-y={label.anchorY}
					style:left="{label.x}px"
					style:top="{label.y}px"
				>{label.name}</div>
			{/each}
			{#each overlay.indicators as indicator (indicator.key)}
				<div
					class="absolute flex -translate-1/2 items-center gap-1 text-xs font-semibold text-accent"
					style:left="{indicator.x}px"
					style:top="{indicator.y}px"
				>
					<span style:transform="rotate({indicator.angle}rad)">➤</span>
					<span>{indicator.name}</span>
				</div>
			{/each}
			<div class="absolute right-2 bottom-2 max-w-[75%] bg-surface/75 px-2 py-1 text-right text-[0.65rem] text-secondary">
				{overlay.modeLabel} · {overlay.scaleLabel}
				{#if overlay.lightingLabel}<span class="ml-2">{overlay.lightingLabel}</span>{/if}
				{#if overlay.exposureLabel}<span class="ml-2">{overlay.exposureLabel}</span>{/if}
				{#if overlay.legend}
					<span class="ml-2 inline-flex items-center gap-1.5">
						{#if overlay.legend.pixels > 0}
							<span class="inline-block border-t border-secondary" style:width="{overlay.legend.pixels}px"></span>
						{/if}
						{overlay.legend.label}
					</span>
				{/if}
			</div>
			<div class="absolute bottom-2 left-2 hidden bg-surface/60 px-2 py-1 text-[0.65rem] text-secondary sm:block">
				{view === 'orrery' ? 'Drag to orbit · WASD / arrows pan' : 'WASD / arrows pan'}
			</div>
		</div>
	{/if}

	{#if hoveredBody && hoverPosition && !unavailableReason}
		<div
			class="pointer-events-none absolute z-20 w-52 border px-2.5 py-1.5 shadow-lg"
			style="{tooltipStyle}background:{theme.surface};border-color:{theme.accentLight};"
			data-testid="map-tooltip"
		>
			<div class="text-xs font-semibold text-heading">
				{hoveredBody.name}
				{#if hoveredBody.spectralType}<span class="font-normal text-secondary"> ({hoveredBody.spectralType})</span>{/if}
			</div>
			{#if hoveredBody.semiMajorAxisAu}<div class="text-xs text-secondary">{hoveredBody.semiMajorAxisAu.toFixed(3)} AU</div>{/if}
			{#if hoveredSurfaceDescription}<div class="mt-1 text-[0.68rem] text-secondary">{hoveredSurfaceDescription}</div>{/if}
			{#if hoveredStarlight}
				<div class={cn('mt-1 text-[0.68rem]', hoveredStarlight.fallback ? 'text-accent' : 'text-secondary')}>
					{hoveredStarlight.description}
				</div>
			{/if}
			{#if timingUnavailable(hoveredBody)}
				<div class="mt-1 text-[0.68rem] text-accent">Timing unavailable—position fixed.</div>
			{/if}
			{#if hoveredBody.placementNote}<div class="mt-1 text-[0.68rem] text-secondary">{hoveredBody.placementNote}</div>{/if}
		</div>
	{/if}

	{#if unavailableReason}
		<div class="absolute inset-0 z-30 overflow-auto bg-page/95 p-5" role="status">
			<h3 class="font-display text-lg font-semibold text-heading">Interactive map unavailable</h3>
			<p class="mt-1 max-w-2xl text-sm text-secondary">{unavailableReason}</p>
			<ul class="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
				{#each fallbackEntities as entity (entity.key)}
					<li class="flex items-center justify-between gap-2 border border-faint/40 bg-surface/60 px-2 py-1.5 text-sm">
						<button class="truncate text-left text-heading hover:text-accent" onclick={() => { selectedId = entity.key }}>
							{entity.body.name}
						</button>
						<a
							class="shrink-0 text-xs text-link hover:text-link-hover"
							href={resolve('/[...ns_path=namespaced]', { ns_path: `Celestial:${entity.body.slug}` })}
						>Open</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
