<script lang="ts">
	import { slugify } from '$lib/renderer/context.js'

	let { categories }: { categories: string[] } = $props()
</script>

{#if categories.length > 0}
	<div class="mt-8 pt-4 border-t border-border">
		<div class="flex items-center gap-2 flex-wrap">
			<span class="text-xs font-semibold text-dim uppercase tracking-wide">Categories</span>
			{#each categories as cat}
				<a
					href="/know/category:{slugify(cat)}"
					class="
						inline-block bg-raised text-secondary rounded-full px-3 py-1 text-xs transition-colors
						hover:bg-accent-subtle hover:text-link
					"
				>
					{cat}
				</a>
			{/each}
		</div>
	</div>
{/if}
