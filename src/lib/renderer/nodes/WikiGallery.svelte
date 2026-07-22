<script lang="ts">
	import type { GalleryItem } from '$lib/parser/types.js'
	import { getKnowContext } from '../context.js'

	let { items }: { items: GalleryItem[] } = $props()

	const ctx = getKnowContext()
</script>

<div class="know-gallery flex flex-wrap gap-3 my-4">
	{#each items as item, index (index)}
		<figure class="bg-page p-1 text-center">
			<img
				src="{ctx.mediaBaseUrl}/{encodeURIComponent(item.filename)}?w=150"
				alt={item.caption || item.filename}
				loading="lazy"
				class="block max-w-[180px] max-h-[180px] object-contain"
			/>
			{#if item.caption}
				<figcaption class="text-xs text-secondary pt-1 px-1">{item.caption}</figcaption>
			{/if}
		</figure>
	{/each}
</div>
