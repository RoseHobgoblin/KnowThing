<script lang="ts">
	import { onMount, untrack } from 'svelte'
	import { goto } from '$app/navigation'
	import { useResizeObserver } from 'runed'
	import { resolve } from '$app/paths'
	import { cn } from '$lib/utils.js'
	import type { LabelMode, ScaleMode, TrailMode, ViewMode, VisibilityMode } from '../map-settings.js'
	import type { EntityKey, MapBody, ThemePalette } from '../root-layout.js'
	import { keyForBody, timingUnavailable } from '../root-layout.js'
	import { composeSurfacePlan, describeSurfacePlan } from '../surface-model.js'
	import { composeStellarSurfacePlan, describeStellarSurfacePlan } from '../stellar-surface-model.js'
	import { describeStarlightLuminosity, resolveStarlightLuminosity } from '../starlight-model.js'
	import type { OverlaySnapshot, RootMapRenderer } from '../renderer-types.js'
	import type { RootCameraState } from '../view-state.js'
	import type { ApparentSkyResult, ApparentSkySource, RootSelectionKey } from '../apparent-sky.js'
	import { FULL_VIEW_INTERACTION, type DisplayInteractionPolicy } from '../consumer-contract.js'

	const DEFAULT_THEME: ThemePalette = {
		page: '#12131D', surface: '#1A1B26', accent: '#FFE088', accentLight: '#E9C349',
		secondary: '#A09882', dim: '#7A7264', heading: '#F0E6D0', faint: '#55504A',
	}
	const EMPTY_OVERLAY: OverlaySnapshot = {
		labels: [], indicators: [], legend: null, projection: 'perspective', status: 'initializing',
	}

	let {
		rootName,
		stars,
		bodies,
		apparentSky,
		currentAbsoluteDay,
		scale = 'log',
		labels = 'major',
		skyLabels = 'off',
		trails = 'off',
		follow = $bindable(false),
		view = $bindable('orrery'),
		visibility = 'enhanced',
		selectedId = $bindable(null),
		focusId = $bindable(null),
		initialCameraState = null,
		interaction = FULL_VIEW_INTERACTION,
	}: {
		rootName: string
		stars: MapBody[]
		bodies: MapBody[]
		apparentSky: ApparentSkyResult
		currentAbsoluteDay?: number | null
		scale?: ScaleMode
		labels?: LabelMode
		skyLabels?: LabelMode
		trails?: TrailMode
		follow?: boolean
		view?: ViewMode
		visibility?: VisibilityMode
		selectedId?: RootSelectionKey | null
		focusId?: EntityKey | null
		initialCameraState?: RootCameraState | null
		interaction?: DisplayInteractionPolicy
	} = $props()

	let wrapperElement: HTMLDivElement | null = null
	let canvasHost: HTMLDivElement | null = null
	let renderer = $state<RootMapRenderer | null>(null)
	let theme = $state<ThemePalette>(DEFAULT_THEME)
	let displayWidth = $state(800)
	let displayHeight = $state(800)
	let hoveredBody = $state<MapBody | null>(null)
	let hoveredSkySource = $state<ApparentSkySource | null>(null)
	let hoverPosition = $state<{ x: number, y: number } | null>(null)
	let viewState = $state({ isMoved: false })
	let overlay = $state.raw<OverlaySnapshot>(EMPTY_OVERLAY)
	let unavailableReason = $state<string | null>(null)

	export function getCameraState(): RootCameraState | null {
		return renderer?.getCameraState() ?? null
	}

	const fallbackEntities = $derived([
		...stars.map(body => ({ kind: 'local' as const, name: body.name, slug: body.slug, key: keyForBody(body, true) })),
		...bodies.map(body => ({ kind: 'local' as const, name: body.name, slug: body.slug, key: keyForBody(body, false) })),
		...apparentSky.sources.map(source => ({
			kind: 'sky' as const,
			name: source.rootName,
			slug: source.rootSlug,
			key: source.key,
		})),
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

	function resizeRenderer(width?: number, height?: number) {
		const nextWidth = Math.max(1, Math.round(width ?? canvasHost?.clientWidth ?? displayWidth))
		const nextHeight = Math.max(1, Math.round(height ?? canvasHost?.clientHeight ?? displayHeight))
		displayWidth = nextWidth
		displayHeight = nextHeight
		readTheme()
		renderer?.resize(nextWidth, nextHeight)
	}

	useResizeObserver(
		() => canvasHost,
		(entries) => {
			const entry = entries[0]
			if (entry) resizeRenderer(entry.contentRect.width, entry.contentRect.height)
		},
	)

	function surfaceDescription(body: MapBody): string | null {
		if (body.bodyType === 'ring_system') return null
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
	const effectiveFocusId = $derived(focusId ?? (
		follow && selectedId && !selectedId.startsWith('sky-root:')
			? selectedId as EntityKey
			: null
	))
	const focusedName = $derived.by(() => {
		if (!effectiveFocusId) return null
		const [kind, rawId] = effectiveFocusId.split(':')
		const id = Number(rawId)
		return (kind === 'star' ? stars : bodies).find(body => body.id === id)?.name ?? null
	})

	// Three.js remains strictly browser-only.
	onMount(() => {
		let cancelled = false
		let created: RootMapRenderer | null = null

		;(async () => {
			const { createRootMapRenderer } = await import('../three/map-renderer.js')
			if (cancelled || !canvasHost) return
			readTheme()
			const instance = await createRootMapRenderer(canvasHost, theme, {
				onHover: (target, position) => {
					hoveredBody = target?.kind === 'local' ? target.body : null
					hoveredSkySource = target?.kind === 'sky' ? target.source : null
					hoverPosition = position
				},
				onSelect: (id) => {
					selectedId = id
					if (id?.startsWith('sky-root:')) {
						follow = false
						focusId = null
					}
				},
				onFocusChange: (id) => {
					focusId = id
					follow = id != null
				},
				onActivateSkySource: (rootSlug) => {
					goto(resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${rootSlug}` }))
				},
				onViewChange: (nextView) => { viewState = nextView },
				onOverlayChange: (snapshot) => { overlay = snapshot },
				onUnavailable: (reason) => { unavailableReason = reason },
				onAvailable: () => { unavailableReason = null },
			})
			if (cancelled || !canvasHost) {
				instance.destroy()
				return
			}
			created = instance
			instance.canvas.style.display = unavailableReason ? 'none' : 'block'
			instance.canvas.style.width = '100%'
			instance.canvas.style.height = '100%'
			instance.canvas.setAttribute('aria-label', `Interactive root map of ${rootName}`)
			if (interaction.cameraMovement) instance.canvas.setAttribute('aria-keyshortcuts', 'W A S D ArrowUp ArrowLeft ArrowDown ArrowRight')
			// The host has no Svelte children; imperative ownership is deliberate.
			// eslint-disable-next-line svelte/no-dom-manipulating
			canvasHost.replaceChildren(instance.canvas)
			renderer = instance
			resizeRenderer()
		})()

		return () => {
			cancelled = true
			renderer = null
			created?.destroy()
		}
	})

	$effect(() => {
		renderer?.setSettings({ scale, labels, skyLabels, trails, follow, view, visibility })
	})
	$effect(() => {
		renderer?.setInteraction(interaction)
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
		renderer?.setData(stars, bodies, apparentSky)
	})
	$effect(() => {
		renderer?.setFocus(effectiveFocusId)
	})
	$effect(() => {
		const instance = renderer
		void rootName
		if (!instance) return
		if (initialCameraState) instance.setCameraState(initialCameraState)
		else if (untrack(() => effectiveFocusId) == null) instance.resetView()
	})
	$effect(() => {
		renderer?.canvas.setAttribute('aria-label', `Interactive root map of ${rootName}`)
	})

	const tooltipStyle = $derived.by(() => {
		if (!hoverPosition) return ''
		const tipWidth = 210
		let baseHeight = 60
		if (hoveredSkySource) baseHeight = 92 + Math.min(hoveredSkySource.stars.length, 3) * 14
		else if (hoveredBody && timingUnavailable(hoveredBody)) baseHeight = 84
		const tipHeight = baseHeight + (hoveredSurfaceDescription ? 18 : 0) + (hoveredStarlight ? 18 : 0)
		const placeRight = hoverPosition.x + 16 + tipWidth < displayWidth
		const left = placeRight ? hoverPosition.x + 16 : hoverPosition.x - tipWidth - 16
		const top = Math.min(Math.max(hoverPosition.y - tipHeight / 2, 4), displayHeight - tipHeight - 4)
		return `left:${Math.max(4, left)}px;top:${top}px;`
	})

	const hoveredSkyDistance = $derived(hoveredSkySource
		? `${hoveredSkySource.distance.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${hoveredSkySource.units}`
		: null)
	const hoveredSkyMagnitude = $derived(hoveredSkySource?.apparentMagnitude == null
		? null
		: hoveredSkySource.apparentMagnitude.toFixed(2))
</script>

<div
	class="relative size-full min-h-80 overflow-hidden bg-black"
	bind:this={wrapperElement}
	data-render-state={unavailableReason ? 'unavailable' : overlay.status}
	data-camera-projection={overlay.projection ?? 'unavailable'}
	data-visibility-mode={visibility}
	data-focus-id={focusId ?? undefined}
	data-authored-sky-source-count={apparentSky.sources.length}
>
	<div bind:this={canvasHost} class="absolute inset-0" aria-hidden={unavailableReason != null}></div>

	{#if interaction.controlsVisible && interaction.displayChanges}
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
	{/if}

	{#if interaction.controlsVisible && interaction.cameraMovement && viewState.isMoved}
		<button
			class="absolute top-2 right-2 z-10 bg-surface/85 px-2 py-1 text-xs font-medium text-dim transition-colors hover:text-accent"
			onclick={() => renderer?.resetView()}
			aria-label="Return to system view"
		>System view</button>
	{/if}

	{#if !unavailableReason}
		<div class="pointer-events-none absolute inset-0 z-5 overflow-hidden" aria-hidden="true">
			{#each overlay.labels as label (label.key)}
				{#if label.pillar}
					<div
						class={cn(
							'absolute w-px -translate-x-1/2',
							label.selected ? 'bg-accent/80' : 'bg-secondary/55',
						)}
						data-label-pillar={label.key}
						style:left="{label.pillar.x}px"
						style:top="{Math.min(label.pillar.fromY, label.pillar.toY)}px"
						style:height="{Math.abs(label.pillar.toY - label.pillar.fromY)}px"
					></div>
				{/if}
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
			{#if overlay.legend}
				<div class="absolute right-2 bottom-2 inline-flex items-center gap-1.5 bg-surface/75 px-2 py-1 text-[0.65rem] text-secondary">
					{#if overlay.legend.pixels > 0}
						<span class="inline-block border-t border-secondary" style:width="{overlay.legend.pixels}px"></span>
					{/if}
					{overlay.legend.label}
				</div>
			{/if}
			{#if interaction.controlsVisible}
				<div class="absolute bottom-2 left-2 hidden bg-surface/65 px-2 py-1 text-[0.65rem] text-secondary sm:block">
					{#if focusedName}<span class="font-medium text-heading">Focused: {focusedName}</span> · {/if}
					{view === 'plan'
						? 'Drag to pan · Scroll to change scale · Double-click to focus'
						: 'Drag to orbit · Right-drag to pan · Scroll to travel · Double-click to focus'}
				</div>
			{/if}
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

	{#if hoveredSkySource && hoverPosition && !unavailableReason}
		<div
			class="pointer-events-none absolute z-20 w-56 border px-2.5 py-1.5 shadow-lg"
			style="{tooltipStyle}background:{theme.surface};border-color:{theme.accentLight};"
			data-testid="sky-tooltip"
		>
			<div class="text-xs font-semibold text-heading">{hoveredSkySource.rootName}</div>
			{#if hoveredSkyDistance}<div class="text-xs text-secondary">{hoveredSkyDistance}</div>{/if}
			<div class="text-[0.68rem] text-secondary">
				Unresolved authored {hoveredSkySource.stars.length === 1 ? 'star' : `${hoveredSkySource.stars.length}-star system`}
				{#if hoveredSkyMagnitude} · apparent magnitude {hoveredSkyMagnitude}{/if}
			</div>
			<div class="mt-1 text-[0.68rem] text-secondary">
				{hoveredSkySource.stars.slice(0, 3).map(star => star.name).join(' · ')}
				{#if hoveredSkySource.stars.length > 3} · +{hoveredSkySource.stars.length - 3} more{/if}
			</div>
			{#if hoveredSkySource.brightnessStatus !== 'complete'}
				<div class="mt-1 text-[0.68rem] text-accent">
					{hoveredSkySource.brightnessStatus === 'unavailable'
						? 'Brightness unavailable; enhanced appearance is illustrative.'
						: 'Brightness uses only members with physical inputs.'}
				</div>
			{/if}
			<div class="mt-1 text-[0.65rem] text-dim">Double-click to enter this root.</div>
		</div>
	{/if}

	{#if unavailableReason}
		<div class="absolute inset-0 z-30 overflow-auto bg-page/95 p-5" role="status">
			<h3 class="font-display text-lg font-semibold text-heading">Interactive map unavailable</h3>
			<p class="mt-1 max-w-2xl text-sm text-secondary">{unavailableReason}</p>
			<ul class="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
				{#each fallbackEntities as entity (entity.key)}
					<li class="flex items-center justify-between gap-2 border border-faint/40 bg-surface/60 px-2 py-1.5 text-sm">
						{#if interaction.selectionInspection}<button
							class="truncate text-left text-heading hover:text-accent"
							onclick={() => {
								selectedId = entity.key
								if (entity.kind === 'sky') {
									follow = false
									focusId = null
								}
							}}
						>
							{entity.name}
						</button>{:else}<span class="truncate text-heading">{entity.name}</span>{/if}
						{#if interaction.objectNavigation}
						<a
							class="shrink-0 text-xs text-link hover:text-link-hover"
							href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${entity.slug}` })}
						>Open</a>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
