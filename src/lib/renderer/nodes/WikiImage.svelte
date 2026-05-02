<script lang="ts">
	import type { ImageOption } from '$lib/parser/types.js'
	import MediaImage from '$lib/components/MediaImage.svelte'

	let { filename, options }: { filename: string, options: ImageOption[] } = $props()

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

	const displayWidth = $derived(width?.value ?? (isThumb || isFrame ? 320 : undefined))
	const imageSizes = $derived(
		alignment === 'center'
			? '(max-width: 640px) calc(100vw - 3rem), min(90vw, 320px)'
			: '(max-width: 640px) calc(100vw - 3rem), 320px',
	)
	const inlineSizes = $derived(
		width?.value
			? `${width.value}px`
			: '(max-width: 640px) calc(100vw - 3rem), min(90vw, 600px)',
	)

	const alignClass = $derived(
		alignment === 'left'
			? 'float-left mr-4'
			: (alignment === 'center'
				? 'mx-auto clear-both'
				: 'float-right ml-4'),
	)
</script>

{#if isThumb || isFrame}
	<figure class="know-image-frame border border-border-strong bg-page p-1 mb-4 overflow-hidden max-w-full {alignClass}">
		<MediaImage
			{filename}
			{alt}
			caption={caption?.text ?? ''}
			displayWidth={displayWidth}
			sizes={imageSizes}
			class="block h-auto w-full"
		/>
		{#if caption}
			<figcaption class="text-xs text-secondary px-1 pt-1">{caption.text}</figcaption>
		{/if}
	</figure>
{:else}
	<MediaImage
		{filename}
		{alt}
		caption={caption?.text ?? ''}
		displayWidth={width?.value}
		sizes={inlineSizes}
		class="know-image inline-block h-auto max-w-full"
	/>
{/if}
