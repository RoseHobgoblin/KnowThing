<script lang="ts">
	let {
		slug,
		x,
		y,
	}: {
		slug: string
		x: number
		y: number
	} = $props()

	let title = $state('')
	let summary = $state('')
	let loading = $state(true)
	let error = $state(false)
	let popupEl: HTMLDivElement | undefined = $state()

	const POPUP_WIDTH = 320
	const POPUP_HEIGHT_MAX = 200

	// Position: prefer below and to the right, but flip if near edges
	const style = $derived.by(() => {
		const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200
		const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800

		let left = x + 12
		let top = y + 16

		// Flip horizontally if too close to right edge
		if (left + POPUP_WIDTH > viewportW - 16) {
			left = x - POPUP_WIDTH - 12
		}

		// Flip vertically if too close to bottom
		if (top + POPUP_HEIGHT_MAX > viewportH - 16) {
			top = y - POPUP_HEIGHT_MAX - 8
		}

		// Clamp
		if (left < 8) left = 8
		if (top < 8) top = 8

		return `left: ${left}px; top: ${top}px; width: ${POPUP_WIDTH}px;`
	})

	$effect(() => {
		const currentSlug = slug
		loading = true
		error = false
		title = ''
		summary = ''

		const controller = new AbortController()

		fetch(`/api/pages/summary?slug=${encodeURIComponent(currentSlug)}`, {
			signal: controller.signal,
		})
			.then(r => {
				if (!r.ok) throw new Error('Not found')
				return r.json()
			})
			.then(data => {
				title = data.title
				summary = data.summary
				loading = false
			})
			.catch(err => {
				if (err.name !== 'AbortError') {
					error = true
					loading = false
				}
			})

		return () => controller.abort()
	})
</script>

{#if !error}
	<div
		bind:this={popupEl}
		class="link-preview fixed z-50 border border-border bg-surface shadow-lg overflow-hidden"
		style={style}
		role="tooltip"
	>
		{#if loading}
			<div class="p-4">
				<div class="h-4 w-3/4 bg-skeleton rounded animate-pulse mb-2"></div>
				<div class="h-3 w-full bg-skeleton-shimmer rounded animate-pulse mb-1"></div>
				<div class="h-3 w-5/6 bg-skeleton-shimmer rounded animate-pulse"></div>
			</div>
		{:else}
			<div class="p-4">
				<h3 class="font-semibold text-heading text-sm mb-1.5 leading-tight">{title}</h3>
				{#if summary}
					<p class="text-xs text-body leading-relaxed">{summary}</p>
				{:else}
					<p class="text-xs text-faint italic">No summary available.</p>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.link-preview {
		max-height: 200px;
		pointer-events: none;
		animation: preview-fade-in 0.15s ease-out;
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
