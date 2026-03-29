<script lang="ts">
	import type { ImageOption } from '$lib/parser/types.js'
	import { getKnowContext } from '../context.js'

	let { filename, options }: { filename: string, options: ImageOption[] } = $props()

	const ctx = getKnowContext()
	const baseUrl = $derived(`${ctx.mediaBaseUrl}/${encodeURIComponent(filename)}`)

	const isThumb = $derived(options.some(o => o.type === 'thumb'))
	const isFrame = $derived(options.some(o => o.type === 'frame'))
	const alignment = $derived(
		options.find(o => o.type === 'right' || o.type === 'left' || o.type === 'center')?.type || 'right',
	)
	const width = $derived(options.find(o => o.type === 'width') as { type: 'width', value: number } | undefined)
	const caption = $derived(options.find(o => o.type === 'caption') as { type: 'caption', text: string } | undefined)
	const alt = $derived(
		(options.find(o => o.type === 'alt') as { type: 'alt', text: string } | undefined)?.text ||
			caption?.text ||
			filename,
	)

	// Pick the right thumbnail size based on requested width
	function pickThumbSize(requestedWidth: number | undefined, isThumb: boolean): number | null {
		if (!requestedWidth && isThumb) return 300 // Default thumb size
		if (!requestedWidth) return null // Inline image, serve original
		if (requestedWidth <= 150) return 150
		if (requestedWidth <= 300) return 300
		if (requestedWidth <= 600) return 600
		return null // Larger than our biggest thumb, serve original
	}

	const thumbSize = $derived(pickThumbSize(width?.value, isThumb || isFrame))
	const source = $derived(thumbSize ? `${baseUrl}?w=${thumbSize}` : baseUrl)

	const alignClass = $derived(
		alignment === 'left'
			? 'float-left mr-4'
			: (alignment === 'center'
				? 'mx-auto'
				: 'float-right ml-4'),
	)
</script>

{#if isThumb || isFrame}
	<figure class="know-image-frame border border-border-strong bg-page p-1 mb-2 max-w-xs {alignClass}">
		<img
			src={source}
			{alt}
			loading="lazy"
			class="block"
			style={width ? `max-width: ${width.value}px` : 'max-width: 220px'}
		/>
		{#if caption}
			<figcaption class="text-xs text-secondary px-1 pt-1">{caption.text}</figcaption>
		{/if}
	</figure>
{:else}
	<img
		src={source}
		{alt}
		loading="lazy"
		class="know-image inline-block"
		style={width ? `max-width: ${width.value}px` : undefined}
	/>
{/if}
