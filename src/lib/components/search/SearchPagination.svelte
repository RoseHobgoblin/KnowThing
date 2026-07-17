<script lang="ts">
	let {
		page,
		totalPages,
		totalResults,
		hasPreviousPage,
		hasNextPage,
		prevHref,
		nextHref,
	}: {
		page: number
		totalPages: number
		totalResults: number
		hasPreviousPage: boolean
		hasNextPage: boolean
		prevHref: string
		nextHref: string
	} = $props()
</script>

{#if totalResults > 0 && totalPages > 1}
	<div class="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
		<div class="text-sm text-dim">
			Page {page} of {totalPages}
		</div>
		<div class="flex items-center gap-2">
			{#if hasPreviousPage}
				<a href={prevHref} class="px-3 py-1.5 text-sm text-secondary hover:bg-page">Previous</a>
			{:else}
				<span class="px-3 py-1.5 text-sm text-secondary opacity-50">Previous</span>
			{/if}
			{#if hasNextPage}
				<a href={nextHref} class="px-3 py-1.5 text-sm text-secondary hover:bg-page">Next</a>
			{:else}
				<span class="px-3 py-1.5 text-sm text-secondary opacity-50">Next</span>
			{/if}
		</div>
	</div>
{/if}
