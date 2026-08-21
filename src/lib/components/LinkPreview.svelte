<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query'
	import { loadPageSummary } from '$lib/renderer/render-client.js'

	let {
		slug,
		domain = 'know',
	}: {
		slug: string
		domain?: string
	} = $props()

	type PageSummary = {
		title: string
		summary: string
		image?: string | null
		imageWidth?: number | null
		imageHeight?: number | null
	}

	const query = createQuery(() => ({
		queryKey: ['page-summary', domain, slug],
		queryFn: () => loadPageSummary<PageSummary>(slug, domain),
	}))

	const title = $derived(query.data?.title ?? '')
	const summary = $derived(query.data?.summary ?? '')
	const image = $derived(query.data?.image ?? null)
	const imageWidth = $derived(query.data?.imageWidth ?? null)
	const imageHeight = $derived(query.data?.imageHeight ?? null)

	const STACKED_WIDTH = 320
	const SIDE_TEXT_WIDTH = 240
	const SIDE_IMAGE_HEIGHT = 200

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
</script>

{#if !query.isError}
	<div
		class="link-preview bg-surface shadow-lg overflow-hidden"
		style="width: {popupWidth}px"
		role="tooltip"
	>
		{#if query.isPending}
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
		/* Reset cascade — preview can be a DOM child of centered/bold cells like .infobox-title */
		text-align: left;
		font-weight: 400;
		font-style: normal;
		font-family: var(--font-body);
		text-transform: none;
		letter-spacing: normal;
	}
</style>
