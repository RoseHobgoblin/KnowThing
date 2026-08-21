<script lang="ts">
	import { resolve } from '$app/paths'
	import { m } from '$lib/paraglide/messages.js'

	type WorldRegion = {
		id: number
		hexColor: string
		label: string
		countryName: string
		pageSlug: string | null
		paths: Array<{ d: string, transform: string | null }>
	}

	let {
		width,
		height,
		waterHex = '#000000',
		imageSrc = null,
		transparentRegions = false,
		highlightRegionId = null,
		regions,
	}: {
		width: number
		height: number
		waterHex?: string
		imageSrc?: string | null
		transparentRegions?: boolean
		highlightRegionId?: number | null
		regions: WorldRegion[]
	} = $props()

	let svgEl = $state<SVGSVGElement | null>(null)

	let viewX = $state(0)
	let viewY = $state(0)
	let viewWidth = $state(0)
	let viewHeight = $state(0)

	let dragging = $state(false)
	let dragStartX = $state(0)
	let dragStartY = $state(0)
	let dragOriginViewX = $state(0)
	let dragOriginViewY = $state(0)

	const minZoom = 1
	const maxZoom = 24

	const effectiveViewWidth = $derived(viewWidth || width)
	const effectiveViewHeight = $derived(viewHeight || height)
	const viewBoxValue = $derived(`${viewX} ${viewY} ${effectiveViewWidth} ${effectiveViewHeight}`)
	const zoomLevel = $derived(Math.min(maxZoom, Math.max(minZoom, width / effectiveViewWidth)))
	const renderRegions = $derived(
		regions.toSorted((left, right) => getRegionPaintWeight(right) - getRegionPaintWeight(left) || left.id - right.id),
	)

	function regionOpacity(isNothing: boolean, isHighlighted: boolean, transparent: boolean) {
		if (isNothing) return { fill: 0, stroke: 0 }
		if (isHighlighted) return { fill: 0.2, stroke: 1 }
		return transparent ? { fill: 0, stroke: 0 } : { fill: 1, stroke: 1 }
	}

	// Initialize the mutable viewport once; later writes are explicit pointer or
	// zoom events and must not be overwritten when parent props re-evaluate.
	$effect(() => {
		if (viewWidth === 0 || viewHeight === 0) {
			viewWidth = width
			viewHeight = height
		}
	})

	function resetView() {
		viewX = 0
		viewY = 0
		viewWidth = width
		viewHeight = height
	}

	function toSvgSpace(clientX: number, clientY: number) {
		if (!svgEl) {
			return { x: viewX + viewWidth / 2, y: viewY + viewHeight / 2 }
		}
		const rect = svgEl.getBoundingClientRect()
		const x = viewX + ((clientX - rect.left) / rect.width) * viewWidth
		const y = viewY + ((clientY - rect.top) / rect.height) * viewHeight
		return { x, y }
	}

	function zoomAt(factor: number, anchorX: number, anchorY: number) {
		const currentViewWidth = viewWidth || width
		const currentViewHeight = viewHeight || height
		const nextWidth = Math.min(width, Math.max(width / maxZoom, currentViewWidth / factor))
		const nextHeight = (nextWidth / width) * height

		const relX = (anchorX - viewX) / currentViewWidth
		const relY = (anchorY - viewY) / currentViewHeight

		viewX = anchorX - relX * nextWidth
		viewY = anchorY - relY * nextHeight
		viewWidth = nextWidth
		viewHeight = nextHeight

		const maxX = width - viewWidth
		const maxY = height - viewHeight
		viewX = Math.max(0, Math.min(maxX, viewX))
		viewY = Math.max(0, Math.min(maxY, viewY))
	}

	function onWheel(event: WheelEvent) {
		event.preventDefault()
		const anchor = toSvgSpace(event.clientX, event.clientY)
		zoomAt(event.deltaY > 0 ? 1 / 1.18 : 1.18, anchor.x, anchor.y)
	}

	function onPointerDown(event: PointerEvent) {
		const target = event.target as Element | null
		if (target?.closest('a')) {
			return
		}

		dragging = true
		dragStartX = event.clientX
		dragStartY = event.clientY
		dragOriginViewX = viewX
		dragOriginViewY = viewY
		svgEl?.setPointerCapture(event.pointerId)
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging || !svgEl) return
		const rect = svgEl.getBoundingClientRect()
		const currentViewWidth = viewWidth || width
		const currentViewHeight = viewHeight || height
		const dx = ((event.clientX - dragStartX) / rect.width) * currentViewWidth
		const dy = ((event.clientY - dragStartY) / rect.height) * currentViewHeight

		const maxX = width - currentViewWidth
		const maxY = height - currentViewHeight
		viewX = Math.max(0, Math.min(maxX, dragOriginViewX - dx))
		viewY = Math.max(0, Math.min(maxY, dragOriginViewY - dy))
	}

	function onPointerUp(event: PointerEvent) {
		dragging = false
		if (svgEl?.hasPointerCapture(event.pointerId)) {
			svgEl.releasePointerCapture(event.pointerId)
		}
	}

	function getRegionPaintWeight(region: WorldRegion) {
		return region.paths.reduce((total, pathData) => total + pathData.d.length, 0)
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between gap-3">
		<p class="text-sm text-secondary">
			{m.map_zoom_regions({ zoom: zoomLevel.toFixed(2), count: regions.length })}
		</p>
		<button
			type="button"
			class="px-3 py-1.5 text-xs bg-surface text-body hover:bg-raised"
			onclick={resetView}
		>
			{m.map_reset_view()}
		</button>
	</div>

	<div class="bg-raised overflow-hidden">
		<svg
			bind:this={svgEl}
			viewBox={viewBoxValue}
			width={width}
			height={height}
			class="w-full h-auto touch-none select-none"
			style={`aspect-ratio: ${width} / ${height}; cursor: ${dragging ? 'grabbing' : 'grab'};`}
			onwheel={onWheel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			role="img"
			aria-label={m.map_interactive_world_map()}
		>
			<rect x="0" y="0" width={width} height={height} fill={waterHex} />

			{#if imageSrc}
				<image
					href={imageSrc}
					x="0"
					y="0"
					width={width}
					height={height}
					preserveAspectRatio="none"
					opacity="1"
					pointer-events="none"
				/>
			{/if}

			{#each renderRegions as region (region.id)}
				{@const isNothing = region.pageSlug === 'NOTHING'}
				{@const hasTarget = Boolean(region.pageSlug) && !isNothing}
				{@const isHighlighted = highlightRegionId === region.id}
				{@const regionFill = transparentRegions ? region.hexColor : region.hexColor}
				{@const regionStroke = transparentRegions ? 'transparent' : 'var(--color-border)'}
				{@const pointerEventsValue = isNothing ? 'none' : (transparentRegions ? 'all' : 'visiblePainted')}
				{@const opacity = regionOpacity(isNothing, isHighlighted, transparentRegions)}
				{@const fillOp = opacity.fill}
				{@const strokeOp = opacity.stroke}
				{@const strokeColor = isHighlighted ? 'var(--color-heading)' : regionStroke}
				{@const strokeWidth = isHighlighted ? 2.2 : 0.8}

				{#if hasTarget}
					<a
						href={resolve('/know/[slug]', { slug: region.pageSlug! })}
						aria-label={region.countryName}
						class="world-region-link"
					>
						<title>{region.countryName}</title>
						{#each region.paths as pathData, index (`${region.id}-${index}`)}
							<path
								d={pathData.d}
								transform={pathData.transform}
								fill={regionFill}
								fill-opacity={fillOp}
								stroke={strokeColor}
								stroke-opacity={strokeOp}
								stroke-width={strokeWidth}
								vector-effect="non-scaling-stroke"
								pointer-events={pointerEventsValue}
								class="world-region-path"
							/>
						{/each}
					</a>
				{:else}
					<g>
						<title>{region.countryName}</title>
						{#each region.paths as pathData, index (`${region.id}-${index}`)}
							<path
								d={pathData.d}
								transform={pathData.transform}
								fill={regionFill}
								fill-opacity={fillOp}
								stroke={strokeColor}
								stroke-opacity={strokeOp}
								stroke-width={strokeWidth}
								vector-effect="non-scaling-stroke"
								pointer-events={pointerEventsValue}
								class="world-region-path"
							/>
						{/each}
					</g>
				{/if}
			{/each}
		</svg>
	</div>
</div>

<style>
	.world-region-link {
		cursor: pointer;
	}

	.world-region-path {
		transition: stroke-width 120ms ease, stroke 120ms ease;
	}

	.world-region-link:hover .world-region-path,
	.world-region-link:focus .world-region-path {
		stroke: var(--color-heading);
		stroke-width: 1.8;
	}
</style>
