<script lang="ts">
	import type { ImageOption } from '$lib/parser/types.js';
	import { getWikiContext } from '../context.js';

	let { filename, options }: { filename: string; options: ImageOption[] } = $props();

	const ctx = getWikiContext();
	const src = $derived(`${ctx.mediaBaseUrl}/${encodeURIComponent(filename)}`);

	const isThumb = $derived(options.some((o) => o.type === 'thumb'));
	const isFrame = $derived(options.some((o) => o.type === 'frame'));
	const alignment = $derived(
		options.find((o) => o.type === 'right' || o.type === 'left' || o.type === 'center')?.type || 'right'
	);
	const width = $derived(options.find((o) => o.type === 'width') as { type: 'width'; value: number } | undefined);
	const caption = $derived(options.find((o) => o.type === 'caption') as { type: 'caption'; text: string } | undefined);
	const alt = $derived(
		(options.find((o) => o.type === 'alt') as { type: 'alt'; text: string } | undefined)?.text ||
			caption?.text ||
			filename
	);

	const alignClass = $derived(
		alignment === 'left'
			? 'float-left mr-4'
			: alignment === 'center'
				? 'mx-auto'
				: 'float-right ml-4'
	);
</script>

{#if isThumb || isFrame}
	<figure class="know-image-frame border border-stone-300 bg-stone-50 p-1 mb-2 max-w-xs {alignClass}">
		<img
			{src}
			{alt}
			class="block"
			style={width ? `max-width: ${width.value}px` : 'max-width: 220px'}
		/>
		{#if caption}
			<figcaption class="text-xs text-stone-600 px-1 pt-1">{caption.text}</figcaption>
		{/if}
	</figure>
{:else}
	<img
		{src}
		{alt}
		class="know-image inline-block"
		style={width ? `max-width: ${width.value}px` : undefined}
	/>
{/if}
