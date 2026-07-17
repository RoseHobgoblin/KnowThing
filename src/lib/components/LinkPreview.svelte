<script lang="ts">
	let {
		slug,
		domain = 'know',
		x,
		y,
	}: {
		slug: string
		domain?: string
		x: number
		y: number
	} = $props()

	let title = $state('')
	let summary = $state('')
	let image = $state<string | null>(null)
	let imageWidth = $state<number | null>(null)
	let imageHeight = $state<number | null>(null)
	let loading = $state(true)
	let error = $state(false)
	let popupElement: HTMLDivElement | undefined = $state()

	const STACKED_WIDTH = 320
	const SIDE_TEXT_WIDTH = 240
	const SIDE_IMAGE_HEIGHT = 200
	const POPUP_HEIGHT_MAX = 400

	// Side-by-side (image left, text right) when portrait; stacked otherwise.
	const isPortrait = $derived(
		!!image && imageWidth != null && imageHeight != null && imageHeight > imageWidth,
	)
	const sideImageWidth = $derived(
		isPortrait && imageWidth && imageHeight
			? Math.round(SIDE_IMAGE_HEIGHT * (imageWidth / imageHeight))
			: 140,
	)
	const popupWidth = $derived(isPortrait ? SIDE_TEXT_WIDTH + sideImageWidth : STACKED_WIDTH)
	const stackedAspect = $derived(
		!isPortrait && image && imageWidth && imageHeight ? `${imageWidth} / ${imageHeight}` : null,
	)

	const style = $derived.by(() => {
		const viewportW = globalThis.window === undefined ? 1200 : window.innerWidth
		const viewportH = globalThis.window === undefined ? 800 : window.innerHeight

		let left = x + 12
		let top = y + 16

		if (left + popupWidth > viewportW - 16) {
			left = x - popupWidth - 12
		}
		if (top + POPUP_HEIGHT_MAX > viewportH - 16) {
			top = y - POPUP_HEIGHT_MAX - 8
		}
		if (left < 8) left = 8
		if (top < 8) top = 8

		return `left: ${left}px; top: ${top}px; width: ${popupWidth}px;`
	})

	$effect(() => {
		const currentSlug = slug
		loading = true
		error = false
		title = ''
		summary = ''
		image = null
		imageWidth = null
		imageHeight = null

		const controller = new AbortController()

		fetch(`/api/pages/summary?slug=${encodeURIComponent(currentSlug)}&domain=${encodeURIComponent(domain)}`, {
			signal: controller.signal,
		})
			.then((r) => {
				if (!r.ok) throw new Error('Not found')
				return r.json()
			})
			.then((data) => {
				title = data.title
				summary = data.summary
				image = data.image ?? null
				imageWidth = data.imageWidth ?? null
				imageHeight = data.imageHeight ?? null
				loading = false
			})
			.catch((error_) => {
				if (error_.name !== 'AbortError') {
					error = true
					loading = false
				}
			})

		return () => controller.abort()
	})
</script>

{#if !error}
	<div
		bind:this={popupElement}
		class="link-preview fixed z-50 bg-surface shadow-lg overflow-hidden"
		style={style}
		role="tooltip"
	>
		{#if loading}
			<div class="p-4">
				<div class="h-4 w-3/4 bg-skeleton rounded-sm animate-pulse mb-2"></div>
				<div class="h-3 w-full bg-skeleton-shimmer rounded-sm animate-pulse mb-1"></div>
				<div class="h-3 w-5/6 bg-skeleton-shimmer rounded-sm animate-pulse"></div>
			</div>
		{:else if isPortrait && image}
			<div class="flex">
				<img
					src={image}
					alt=""
					class="block shrink-0 bg-skeleton"
					style="width: {sideImageWidth}px; height: {SIDE_IMAGE_HEIGHT}px;"
					loading="lazy"
				/>
				<div class="p-4 min-w-0 flex-1">
					<h3 class="font-semibold text-heading text-sm/tight mb-1.5">{title}</h3>
					{#if summary}
						<p class="text-xs/relaxed text-body">{summary}</p>
					{:else}
						<p class="text-xs text-secondary italic">No summary available.</p>
					{/if}
				</div>
			</div>
		{:else}
			{#if image}
				<img
					src={image}
					alt=""
					class="block w-full bg-skeleton"
					style={stackedAspect ? `aspect-ratio: ${stackedAspect};` : 'height: 128px; object-fit: cover;'}
					loading="lazy"
				/>
			{/if}
			<div class="p-4">
				<h3 class="font-semibold text-heading text-sm/tight mb-1.5">{title}</h3>
				{#if summary}
					<p class="text-xs/relaxed text-body">{summary}</p>
				{:else}
					<p class="text-xs text-secondary italic">No summary available.</p>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.link-preview {
		max-height: 280px;
		pointer-events: none;
		animation: preview-fade-in 0.15s ease-out;
		/* Reset cascade — preview can be a DOM child of centered/bold cells like .infobox-title */
		text-align: left;
		font-weight: 400;
		font-style: normal;
		font-family: var(--font-body);
		text-transform: none;
		letter-spacing: normal;
	}

	@keyframes preview-fade-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
