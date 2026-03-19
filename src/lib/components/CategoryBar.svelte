<script lang="ts">
	import { slugify } from '$lib/renderer/context.js';

	let { categories }: { categories: string[] } = $props();
</script>

{#if categories.length > 0}
	<div class="mt-8 pt-4 border-t border-stone-200">
		<div class="flex items-center gap-2 flex-wrap">
			<span class="text-xs font-semibold text-stone-500 uppercase tracking-wide">Categories</span>
			{#each categories as cat}
				<a
					href="/know/category:{slugify(cat)}"
					class="inline-block bg-stone-100 text-stone-700 rounded-full px-3 py-1 text-xs hover:bg-amber-50 hover:text-amber-700 transition-colors"
				>
					{cat}
				</a>
			{/each}
		</div>
	</div>
{/if}
