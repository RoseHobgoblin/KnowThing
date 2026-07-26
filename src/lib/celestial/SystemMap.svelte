<script lang="ts">
	import { onMount } from 'svelte'
	import type { ScaleMode, LabelMode, TrailMode } from './map-settings.js'
	import type { MapBody, EntityKey, ThemePalette } from './system-layout.js'
	import type { SystemMapRenderer } from './pixi/map-renderer.js'

	const DEFAULT_THEME: ThemePalette = {
		page: '#12131D',
		surface: '#1A1B26',
		accent: '#FFE088',
		accentLight: '#E9C349',
		secondary: '#A09882',
		dim: '#7A7264',
		heading: '#F0E6D0',
		faint: '#55504A',
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
		selectedId?: EntityKey | null
	} = $props()

	let wrapperElement: HTMLDivElement | null = null
	let canvasHost: HTMLDivElement | null = null
	let renderer = $state<SystemMapRenderer | null>(null)
	let theme = $state<ThemePalette>(DEFAULT_THEME)
	let displaySize = $state(800)
	let hoveredBody = $state<MapBody | null>(null)
	let hoverPosition = $state<{ x: number, y: number } | null>(null)
	let viewState = $state({ zoomLevel: 1, isMoved: false })

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
		// Only publish a new palette object when a value actually changed, so the
		// theme $effect doesn't trigger a renderer rebuild on every resize.
		if (JSON.stringify(next) !== JSON.stringify(theme)) theme = next
	}

	// The renderer (and pixi.js itself) loads only in the browser: onMount never
	// runs during SSR, and the dynamic import keeps pixi out of the server graph.
	onMount(() => {
		let cancelled = false
		let created: SystemMapRenderer | null = null

		;(async () => {
			const { createSystemMapRenderer } = await import('./pixi/map-renderer.js')
			if (cancelled || !canvasHost) return
			readTheme()
			const instance = await createSystemMapRenderer(canvasHost, theme, {
				onHover: (body, position) => {
					hoveredBody = body
					hoverPosition = position
				},
				onSelect: (id) => {
					selectedId = id
				},
				onViewChange: (view) => {
					viewState = view
				},
			})
			if (cancelled || !canvasHost) {
				instance.destroy()
				return
			}
			created = instance
			instance.canvas.style.display = 'block'
			instance.canvas.style.width = '100%'
			// The host div exists only to receive Pixi's canvas — Svelte renders
			// nothing inside it, so imperative DOM control is safe here. The
			// replaceChildren guards against HMR double-mounts leaving a stale canvas.
			// eslint-disable-next-line svelte/no-dom-manipulating
			canvasHost.replaceChildren()
			// eslint-disable-next-line svelte/no-dom-manipulating
			canvasHost.append(instance.canvas)
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
			const width = Math.max(1, Math.round(rect.width))
			displaySize = width
			readTheme()
			renderer?.resize(width)
		}

		updateRect()
		const observer = new ResizeObserver(() => updateRect())
		observer.observe(host)
		return () => observer.disconnect()
	})

	// Prop forwarding — these re-run once `renderer` becomes non-null, so early
	// prop changes are never lost. Data goes last so the initial build happens
	// with settings, day, selection, and theme already in place.
	$effect(() => {
		renderer?.setSettings({ scale, labels, trails, follow })
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
		renderer?.canvas.setAttribute('aria-label', `System map of ${systemName}`)
	})

	const tooltipStyle = $derived.by(() => {
		if (!hoverPosition) return ''
		const tipWidth = 160
		const tipHeight = 52
		const placeRight = hoverPosition.x + 16 + tipWidth < displaySize
		const left = placeRight ? hoverPosition.x + 16 : hoverPosition.x - tipWidth - 16
		const top = Math.min(Math.max(hoverPosition.y - tipHeight / 2, 4), displaySize - tipHeight - 4)
		return `left:${left}px;top:${top}px;`
	})
</script>

<div class="relative w-full" bind:this={wrapperElement}>
	<div
		bind:this={canvasHost}
		class="w-full bg-page"
		style="aspect-ratio: 1 / 1;"
		role="img"
		aria-label="System map of {systemName}"
	></div>

	{#if viewState.isMoved}
		<button
			class="absolute top-2 right-2 px-1.5 py-0.5 text-xs font-medium text-dim bg-surface/80 transition-colors hover:text-accent"
			onclick={() => renderer?.resetView()}
		>
			{viewState.zoomLevel.toFixed(1)}x
		</button>
	{/if}

	{#if hoveredBody && hoverPosition}
		<div
			class="pointer-events-none absolute border px-2.5 py-1.5 shadow-lg"
			style="{tooltipStyle}background:{theme.surface};border-color:{theme.accentLight};"
		>
			<div class="text-xs font-semibold text-heading whitespace-nowrap">
				{hoveredBody.name}
				{#if hoveredBody.spectralType}
					<span class="font-normal text-secondary">({hoveredBody.spectralType})</span>
				{/if}
			</div>
			{#if hoveredBody.semiMajorAxisAu}
				<div class="text-xs text-secondary">{hoveredBody.semiMajorAxisAu.toFixed(3)} AU</div>
			{/if}
		</div>
	{/if}
</div>
