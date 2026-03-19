<script lang="ts">
	import type { GalleryItem } from '$lib/parser/types.js';
	import { getWikiContext } from '../context.js';

	let { items }: { items: GalleryItem[] } = $props();

	const ctx = getWikiContext();
</script>

<div class="know-gallery flex flex-wrap gap-3 my-4">
	{#each items as item}
		<figure class="border border-stone-300 bg-stone-50 p-1 text-center">
			<img
				src="{ctx.mediaBaseUrl}/{encodeURIComponent(item.filename)}"
				alt={item.caption || item.filename}
				class="block max-w-[180px] max-h-[180px] object-contain"
			/>
			{#if item.caption}
				<figcaption class="text-xs text-stone-600 pt-1 px-1">{item.caption}</figcaption>
			{/if}
		</figure>
	{/each}
</div>
