<script lang="ts">
	import { onMount, tick } from 'svelte'
	import { useResizeObserver } from 'runed'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { cn } from '$lib/utils.js'
	import type { ThemePalette } from './system-layout.js'
	import {
		formatSectorPosition,
		type PositionedSectorRoot,
		type SectorCameraState,
		type SectorOverlaySnapshot,
		type SectorRenderer,
		type SectorRootView,
	} from './sector-view.js'

	const DEFAULT_THEME: ThemePalette = {
		page: '#12131D', surface: '#1A1B26', accent: '#FFE088', accentLight: '#E9C349',
		secondary: '#A09882', dim: '#7A7264', heading: '#F0E6D0', faint: '#55504A',
	}
	const EMPTY_OVERLAY: SectorOverlaySnapshot = { labels: [], legend: null, status: 'initializing' }

	let {
		sectorName,
		sectorSlug,
		units,
		roots,
		selectedSlug = $bindable(null),
		focusSlug = null,
	}: {
		sectorName: string
		sectorSlug: string
		units: string
		roots: SectorRootView[]
		selectedSlug?: string | null
		/** Root to select on load (deep link / return-from-system context). */
		focusSlug?: string | null
	} = $props()

	let wrapperElement: HTMLDivElement | null = null
	let canvasHost: HTMLDivElement | null = null
	let renderer = $state<SectorRenderer | null>(null)
	let theme = $state<ThemePalette>(DEFAULT_THEME)
	let displayWidth = $state(800)
	let displayHeight = $state(600)
	let hoveredRoot = $state<PositionedSectorRoot | null>(null)
	let hoverPosition = $state<{ x: number, y: number } | null>(null)
	let overlay = $state.raw<SectorOverlaySnapshot>(EMPTY_OVERLAY)
	let unavailableReason = $state<string | null>(null)

	// The sector camera "return state": leaving for a system and coming back
	// restores the exact view (Sector-and-System-Model transition contract).
	const cameraStorageKey = $derived(`knowthing:sector-camera:${sectorSlug}`)

	function saveCameraState(instance: SectorRenderer) {
		const state = instance.getCameraState()
		if (!state) return
		try {
			sessionStorage.setItem(cameraStorageKey, JSON.stringify(state))
		} catch {
			// Storage full/blocked — losing the return camera is acceptable.
		}
	}

	function readSavedCameraState(): SectorCameraState | null {
		try {
			const raw = sessionStorage.getItem(cameraStorageKey)
			if (!raw) return null
			const parsed = JSON.parse(raw) as SectorCameraState
			if (!Array.isArray(parsed.position) || !Array.isArray(parsed.target)) return null
			return parsed
		} catch {
			return null
		}
	}

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

	function enterSystem(slug: string) {
		if (renderer) saveCameraState(renderer)
		goto(resolve('/[...ns_path=namespaced]', { ns_path: `Celestial:${slug}` }))
	}

	// Three.js remains strictly browser-only.
	onMount(() => {
		let cancelled = false
		let created: SectorRenderer | null = null

		;(async () => {
			const { createSectorRenderer } = await import('./three/sector-renderer.js')
			if (cancelled || !canvasHost) return
			readTheme()
			const instance = createSectorRenderer(canvasHost, theme, {
				onHover: (root, position) => {
					hoveredRoot = root
					hoverPosition = position
				},
				onSelect: (slug) => { selectedSlug = slug },
				onActivate: slug => enterSystem(slug),
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
			instance.canvas.setAttribute('aria-label', `Sector map of ${sectorName}`)
			// The host has no Svelte children; imperative ownership is deliberate.
			// eslint-disable-next-line svelte/no-dom-manipulating
			canvasHost.replaceChildren(instance.canvas)
			renderer = instance
			resizeRenderer()

			// `renderer` wakes the synchronization effects below. Wait until their
			// initial setData/reset pass has completed before restoring the return
			// camera or applying a deep-link focus; otherwise setData wins on the
			// next microtask and silently replaces both states.
			await tick()
			if (cancelled || renderer !== instance) return

			// Return-context restore: a saved camera wins over re-framing; a deep
			// link with ?focus centres its root only when no saved view exists.
			const saved = readSavedCameraState()
			if (saved) instance.setCameraState(saved)
			if (focusSlug && roots.some(root => root.slug === focusSlug)) {
				selectedSlug = focusSlug
				if (!saved) instance.focusRoot(focusSlug)
			}
		})()

		return () => {
			cancelled = true
			renderer = null
			if (created) {
				saveCameraState(created)
				created.destroy()
			}
		}
	})

	$effect(() => {
		renderer?.setData(roots, units)
	})
	$effect(() => {
		renderer?.setSelected(selectedSlug ?? null)
	})
	$effect(() => {
		renderer?.setTheme(theme)
	})

	const hoveredPosition = $derived(hoveredRoot ? formatSectorPosition(hoveredRoot, units) : null)

	const tooltipStyle = $derived.by(() => {
		if (!hoverPosition) return ''
		const tipWidth = 220
		const tipHeight = 76
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
>
	<div bind:this={canvasHost} class="absolute inset-0" aria-hidden={unavailableReason != null}></div>

	{#if !unavailableReason}
		<button
			class="absolute top-2 right-2 z-10 bg-surface/85 px-2 py-1 text-xs font-medium text-dim transition-colors hover:text-accent"
			onclick={() => renderer?.resetView()}
			aria-label="Reset sector view"
		>Reset view</button>

		<div class="pointer-events-none absolute inset-0 z-5 overflow-hidden" aria-hidden="true">
			{#each overlay.labels as label (label.slug)}
				<div
					class={cn(
						'absolute -translate-x-1/2 text-[0.68rem] whitespace-nowrap drop-shadow-md',
						label.selected ? 'font-semibold text-accent' : 'text-heading',
					)}
					style:left="{label.x}px"
					style:top="{label.y}px"
				>{label.name}</div>
			{/each}
			<div class="absolute right-2 bottom-2 bg-surface/75 px-2 py-1 text-right text-[0.65rem] text-secondary">
				{#if overlay.legend}
					<span class="inline-flex items-center gap-1.5">
						{#if overlay.legend.pixels > 0}
							<span class="inline-block border-t border-secondary" style:width="{overlay.legend.pixels}px"></span>
						{/if}
						{overlay.legend.label}
					</span>
				{/if}
			</div>
			<div class="absolute bottom-2 left-2 hidden bg-surface/60 px-2 py-1 text-[0.65rem] text-secondary sm:block">
				Drag to orbit · Double-click a system to enter it
			</div>
		</div>
	{/if}

	{#if hoveredRoot && hoverPosition && !unavailableReason}
		<div
			class="pointer-events-none absolute z-20 w-56 border px-2.5 py-1.5 shadow-lg"
			style="{tooltipStyle}background:{theme.surface};border-color:{theme.accentLight};"
			data-testid="sector-tooltip"
		>
			<div class="text-xs font-semibold text-heading">{hoveredRoot.name}</div>
			{#if hoveredPosition}<div class="text-xs text-secondary">{hoveredPosition}</div>{/if}
			<div class="text-[0.68rem] text-secondary">
				{hoveredRoot.starCount} {hoveredRoot.starCount === 1 ? 'star' : 'stars'}
				· {hoveredRoot.planetCount} {hoveredRoot.planetCount === 1 ? 'body' : 'bodies'}
			</div>
			{#if hoveredRoot.positionProvenance === 'legacy'}
				<div class="mt-1 text-[0.68rem] text-accent">Legacy coordinates — frame semantics inherited, not authored.</div>
			{/if}
		</div>
	{/if}

	{#if unavailableReason}
		<div class="absolute inset-0 z-30 overflow-auto bg-page/95 p-5" role="status">
			<h3 class="font-display text-lg font-semibold text-heading">Sector map unavailable</h3>
			<p class="mt-1 max-w-2xl text-sm text-secondary">{unavailableReason}</p>
			<ul class="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
				{#each roots as root (root.slug)}
					<li class="flex items-center justify-between gap-2 border border-faint/40 bg-surface/60 px-2 py-1.5 text-sm">
						<button class="truncate text-left text-heading hover:text-accent" onclick={() => { selectedSlug = root.slug }}>
							{root.name}
						</button>
						<a
							class="shrink-0 text-xs text-link hover:text-link-hover"
							href={resolve('/[...ns_path=namespaced]', { ns_path: `Celestial:${root.slug}` })}
						>Open</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
