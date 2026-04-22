<script lang="ts">
	type WorldRegion = {
		id: number
		hexColor: string
		label: string
		countryName: string
		pageSlug: string | null
		paths: string[]
	}

	let {
		width,
		height,
		waterHex = '#000000',
		regions,
	}: {
		width: number
		height: number
		waterHex?: string
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

	const viewBoxValue = $derived(`${viewX} ${viewY} ${viewWidth} ${viewHeight}`)
	const zoomLevel = $derived(Math.min(maxZoom, Math.max(minZoom, width / viewWidth)))

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
		const nextWidth = Math.min(width, Math.max(width / maxZoom, viewWidth / factor))
		const nextHeight = (nextWidth / width) * height

		const relX = (anchorX - viewX) / viewWidth
		const relY = (anchorY - viewY) / viewHeight

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
		dragging = true
		dragStartX = event.clientX
		dragStartY = event.clientY
		dragOriginViewX = viewX
		dragOriginViewY = viewY
		const target = event.currentTarget as SVGSVGElement | null
		target?.setPointerCapture(event.pointerId)
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging || !svgEl) return
		const rect = svgEl.getBoundingClientRect()
		const dx = ((event.clientX - dragStartX) / rect.width) * viewWidth
		const dy = ((event.clientY - dragStartY) / rect.height) * viewHeight

		const maxX = width - viewWidth
		const maxY = height - viewHeight
		viewX = Math.max(0, Math.min(maxX, dragOriginViewX - dx))
		viewY = Math.max(0, Math.min(maxY, dragOriginViewY - dy))
	}

	function onPointerUp(event: PointerEvent) {
		dragging = false
		const target = event.currentTarget as SVGSVGElement | null
		target?.releasePointerCapture(event.pointerId)
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between gap-3">
		<p class="text-sm text-secondary">
			Zoom: {zoomLevel.toFixed(2)}x · Regions: {regions.length}
		</p>
		<button
			type="button"
			class="px-3 py-1.5 text-xs border border-border bg-surface hover:bg-raised text-body"
			onclick={resetView}
		>
			Reset view
		</button>
	</div>

	<div class="border border-border bg-raised overflow-hidden">
		<svg
			bind:this={svgEl}
			viewBox={viewBoxValue}
			class="w-full h-auto touch-none select-none"
			style={`aspect-ratio: ${width} / ${height}; cursor: ${dragging ? 'grabbing' : 'grab'};`}
			onwheel={onWheel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			role="img"
			aria-label="Interactive world map"
		>
			<rect x="0" y="0" width={width} height={height} fill={waterHex} />

			{#each regions as region (region.id)}
				{@const hasTarget = Boolean(region.pageSlug)}
				{#if hasTarget}
					<a
						href={`/know/${region.pageSlug}`}
						aria-label={region.countryName}
					>
						<title>{region.countryName}</title>
						{#each region.paths as d, index (`${region.id}-${index}`)}
							<path
								d={d}
								fill={region.hexColor}
								stroke="var(--color-border)"
								stroke-width="0.8"
								vector-effect="non-scaling-stroke"
								class="world-region-path"
							/>
						{/each}
					</a>
				{:else}
					<g>
						<title>{region.countryName}</title>
						{#each region.paths as d, index (`${region.id}-${index}`)}
							<path
								d={d}
								fill={region.hexColor}
								stroke="var(--color-border)"
								stroke-width="0.8"
								vector-effect="non-scaling-stroke"
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
	.world-region-path {
		transition: stroke-width 120ms ease, stroke 120ms ease;
	}

	a .world-region-path:hover,
	a:focus .world-region-path {
		stroke: var(--color-heading);
		stroke-width: 1.8;
	}
</style>
